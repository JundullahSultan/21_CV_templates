"""Independent PDF checks: actual embedded font programs, page boxes, raster colors,
and Arabic contextual glyphs. PyMuPDF renders the PDF (not a browser screenshot).
"""
import collections,json,sys,re
from pathlib import Path
import pymupdf as fitz
from fontTools.ttLib import TTFont
import uharfbuzz as hb

audit=Path(sys.argv[1]);report=json.loads(audit.read_text(encoding='utf-8'))
root=Path(__file__).resolve().parent.parent
font_data=(root/'public/fonts/Amiri-Regular.ttf').read_bytes()
arabic_font=TTFont(root/'public/fonts/Amiri-Regular.ttf')
hbfont=hb.Font(hb.Face(font_data));hb.ot_font_set_funcs(hbfont)

for result in report['results']:
 if not result['passed']:continue
 try:
  pdf=fitz.open(root/result['pdf']);fonts={};trace=[]
  for page in pdf:
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1,'Non-A4 PDF box'
   for record in page.get_fonts(full=True):fonts[record[0]]=record
   if result.get('expectedArabic'):trace.extend(page.get_texttrace())
  embedded=[]
  for xref,record in fonts.items():
   name,ext,kind,data=pdf.extract_font(xref)
   if not data and record[2]=='Type3':
    embedded_program=pdf.xref_get_key(xref,'CharProcs')[1]
    assert ' R' in embedded_program and pdf.xref_get_key(xref,'ToUnicode')[0]!='null','Type3 font lacks embedded programs or Unicode mapping'
    embedded.append({'name':'Embedded Type3 glyph programs','format':'Type3','glyphPrograms':len(re.findall(r'\d+ \d+ R',embedded_program))})
   else:
    assert len(data)>0,f'Unembedded font: {name}'
    embedded.append({'name':name,'bytes':len(data),'format':ext})
  assert embedded,'No embedded fonts'
  pix=pdf[0].get_pixmap(matrix=fitz.Matrix(1,1),alpha=False)
  pixels=pix.samples
  colors=collections.Counter(tuple(pixels[i:i+3]) for i in range(0,len(pixels),300))
  nonwhite=sum(n for rgb,n in colors.items() if min(rgb)<235)/sum(colors.values())
  assert nonwhite>.005,'No printed backgrounds or text detected'
  preview_path=(root/result['pdf']).parent/'preview.png'
  preview=fitz.Pixmap(str(preview_path))
  if preview.alpha:preview=fitz.Pixmap(preview,0)
  raster=pdf[0].get_pixmap(matrix=fitz.Matrix(96/72,96/72),alpha=False)
  source,target=preview.samples,raster.samples
  matched=0;colored_source=0;colored_target=0;points=0
  for row in range(1,40):
   for col in range(1,30):
    x,y=col/30,row/40
    a=(int(y*preview.height)*preview.width+int(x*preview.width))*3
    b=(int(y*raster.height)*raster.width+int(x*raster.width))*3
    left,right=source[a:a+3],target[b:b+3]
    matched+=max(abs(l-r) for l,r in zip(left,right))<40
    # Colored text edge antialiasing differs between Windows screenshots and
    # PDF rasterizers. Only count flat colored areas (fills, rules and bars).
    neighbors=[source[a+dx*3:a+dx*3+3] for dx in [-1,0,1]]
    flat=all(max(abs(l-r) for l,r in zip(left,n))<3 for n in neighbors)
    if flat and max(left)-min(left)>18:
     colored_source+=1
     colored_target+=max(abs(l-r) for l,r in zip(left,right))<30
    points+=1
  agreement=matched/points
  assert agreement>.85,f'PDF raster differs from preview: {agreement:.1%} pixel agreement'
  if colored_source>5:assert colored_target>=colored_source*.8,'Printed background/accent colors are missing'
  result['previewRasterAgreement']=round(agreement,4)
  result['backgroundColorsPreserved']=True
  if result.get('expectedArabic'):
   arabic=[span for span in trace if 'Amiri' in span['font']]
   assert arabic,'Arabic script used no embedded Amiri font'
   # Chrome retains original glyph indices in its TrueType subsets. Contextual
   # GSUB glyphs cannot be produced by painting isolated Unicode letter glyphs.
   cmap=arabic_font.getBestCmap();isolated={arabic_font.getGlyphID(cmap[c]) for c in range(0x600,0x700) if c in cmap}
   contextual=[ch[1] for span in arabic for ch in span['chars'] if 0x600<=ch[0]<=0x6ff and ch[1] not in isolated and ch[1]!=0]
   assert contextual,'No contextual Arabic letter glyphs found'
   assert all(ch[1]!=0 for span in arabic for ch in span['chars'] if 0x600<=ch[0]<=0x6ff),'Missing Arabic glyph (.notdef)'
   buf=hb.Buffer();buf.add_str('تجربې');buf.guess_segment_properties();hb.shape(hbfont,buf)
   reference={g.codepoint for g in buf.glyph_infos};actual={ch[1] for span in arabic for ch in span['chars']}
   assert len(reference.intersection(actual))>=2,'PDF contextual glyphs disagree with the HarfBuzz reference'
   search_word='پژوهش' if result['scenario']=='fa' else 'تجربې'
   hits=sum(len(page.search_for(search_word)) for page in pdf)
   assert hits>0,'Native PDF text search failed for '+search_word
   result['arabicShaping']={'embeddedAmiri':True,'contextualGlyphCount':len(contextual),'harfbuzzReferenceGlyphs':sorted(reference),'referenceMatches':len(reference.intersection(actual)),'nativeSearchHits':hits}
  # Save representative PDF raster evidence for visual review.
  if result['id'] in ['01','13','21'] and result['scenario'] in ['sample','ps','fa','mixed','all-sections']:
   pdf[0].get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False).save(str((root/result['pdf']).parent/'pdf-page-1.png'))
  result['fontEmbedding']=embedded;result['rasterNonwhiteFraction']=round(nonwhite,4)
  pdf.close()
 except Exception as error:
  result['passed']=False;result['error']=str(error);report['failures'].append({'id':result['id'],'scenario':result['scenario'],'error':str(error)})
audit.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Independent font/raster/shaping inspection complete.')
