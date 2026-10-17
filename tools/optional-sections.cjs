function optionalCSS(t) {
  const rgb=String(t.accent).startsWith('#')?String(t.accent).replace('#','').match(/.{2}/g)?.map(x=>parseInt(x,16)):String(t.accent).match(/[\d.]+/g)?.slice(0,3).map(Number);
  const headingInk=rgb&&(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])>145?'#151515':'#ffffff';
  const styles = {
    rule:'border-block-end:1px solid var(--os-accent);padding-block-end:9px;',
    band:'background:var(--os-accent);color:var(--os-heading-ink);padding:9px 12px;',
    marker:'border-inline-start:5px solid var(--os-accent);padding-inline-start:12px;',
    pill:'background:var(--os-accent);color:var(--os-heading-ink);border:1px solid var(--os-ink);border-radius:30px;padding:7px 13px;inline-size:fit-content;',
    outline:'border:1px solid var(--os-accent);padding:9px 12px;border-radius:var(--os-radius);',
    label:'background:var(--os-accent);color:var(--os-heading-ink);border:1px solid var(--os-ink);box-shadow:3px 3px 0 var(--os-ink);padding:7px 12px;inline-size:fit-content;'
  };
  const quoted=s=>String(s).replace(/[{};<>]/g,'');
  return `/* Optional sections only: original template styles are preserved. */
.opt-sheet { --os-accent:${quoted(t.accent)};--os-paper:${quoted(t.paper)};--os-ink:${quoted(t.ink)};--os-heading-ink:${headingInk};--os-radius:${Number(t.radius)||0}px;position:relative;box-sizing:border-box;display:block;inline-size:210mm;block-size:297mm;padding:15mm 16mm 18mm;margin:24px auto;background:var(--os-paper);color:var(--os-ink);font:13px/1.65 ${quoted(t.font)};text-align:start;overflow:visible;isolation:isolate;box-shadow:0 5px 25px #0002;}
.opt-sheet *, .opt-sheet *::before, .opt-sheet *::after { box-sizing:border-box;font-variant-ligatures:none; }
.opt-sheet h2,.opt-sheet h3,.opt-sheet p,.opt-sheet ul,.opt-sheet blockquote,.opt-sheet figure { margin:0;padding:0;border:0;background:none;box-shadow:none;position:static;transform:none;letter-spacing:normal;white-space:normal;min-block-size:0; }
.opt-sheet .opt-running { display:flex;justify-content:space-between;align-items:baseline;gap:16px;border-block-end:1px solid var(--os-accent);padding-block-end:14px;margin-block-end:24px;font-size:10px;letter-spacing:.8px; }
.opt-sheet .opt-running strong { font-size:20px;line-height:1.4;font-weight:600;overflow-wrap:anywhere; }
.opt-sheet .opt-content { display:flow-root; }
.opt-sheet .opt-section { display:block;position:static;inline-size:100%;margin:0;padding:0;border:0;background:transparent; }
.opt-sheet .opt-section+.opt-section { margin-block-start:${Number(t.spacing)||22}px; }
.opt-sheet .opt-heading { font-family:${quoted(t.headingFont)};font-size:18px;font-weight:${quoted(t.headingWeight)};line-height:1.4;letter-spacing:${quoted(t.headingSpacing)};text-transform:${quoted(t.headingTransform)};color:var(--os-ink);margin-block-end:16px;overflow-wrap:anywhere;${styles[t.headingStyle]||styles.rule} }
.opt-sheet .opt-heading::before,.opt-sheet .opt-heading::after { content:none; }
.opt-sheet .opt-entry { display:flow-root;position:static;inline-size:100%;margin:0;padding:0;border:0;break-inside:avoid;overflow-wrap:anywhere; }
.opt-sheet .opt-entry+.opt-entry { margin-block-start:17px; }
.opt-sheet .opt-title { font-family:inherit;font-size:15px;line-height:1.5;font-weight:600;text-transform:none;letter-spacing:normal;color:var(--os-ink); }
.opt-sheet .opt-meta { font-size:11px;line-height:1.7;margin-block-start:4px;opacity:.85; }
.opt-sheet .opt-copy { font-family:inherit;font-size:13px;line-height:1.7;color:var(--os-ink);margin-block-start:6px; }
.opt-sheet .opt-url { color:var(--os-ink);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere;display:block;font-size:12px;margin-block-start:5px; }
.opt-sheet .opt-level { font-weight:500;font-size:13px;line-height:1.7; }
.opt-sheet .opt-bar { block-size:5px;max-inline-size:260px;background:color-mix(in srgb,var(--os-ink) 15%,transparent);border-radius:5px;margin-block-start:6px; }
.opt-sheet .opt-bar span { display:block;block-size:100%;inline-size:var(--amount,0%);background:var(--os-accent);border-radius:5px; }
.opt-sheet .opt-image { display:block;max-inline-size:100%;inline-size:auto;max-block-size:120px;object-fit:contain;margin-block-end:8px; }
.opt-sheet .opt-cover { float:inline-start;inline-size:65px;max-block-size:95px;margin-inline-end:15px; }
.opt-sheet .opt-signature { max-inline-size:240px;max-block-size:90px; }
.opt-sheet .opt-footer { position:absolute;inset-block-end:8mm;inset-inline:16mm;display:flex;justify-content:space-between;gap:12px;font:9px/1.4 ${quoted(t.font)};color:var(--os-ink); }
@media screen and (max-width:820px) { .opt-sheet { inline-size:100%;block-size:auto;min-block-size:0;margin:20px 0;padding:28px 24px 65px;box-shadow:none; }.opt-sheet .opt-running { flex-wrap:wrap; }.opt-sheet .opt-footer { inset-inline:24px;inset-block-end:15px; } }
@page { size:A4;margin:0; }
@media print { .opt-sheet { inline-size:210mm;block-size:297mm;margin:0;box-shadow:none;break-before:page;break-after:page;break-inside:avoid; }.opt-sheet:last-child { break-after:auto; }* { print-color-adjust:exact;-webkit-print-color-adjust:exact; } }
`;
}

// This function executes only during generation/preview, never in exported CV HTML.
function renderOptional({record,definitions,theme}) {
  const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const node=html=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;};
  document.querySelectorAll('.opt-sheet').forEach(e=>e.remove());
  document.documentElement.dir=record.direction==='rtl'?'rtl':'ltr';
  document.documentElement.lang=record.language || (record.direction==='rtl'?'fa':'en');
  if(record.direction==='rtl')document.querySelectorAll('[style]').forEach(el=>{
    if(el.closest('.opt-sheet'))return;
    const start=el.style.getPropertyValue('left'),end=el.style.getPropertyValue('right');
    if(start||end){el.style.setProperty('left','auto','important');el.style.setProperty('right','auto','important');if(start)el.style.setProperty('inset-inline-start',start,'important');if(end)el.style.setProperty('inset-inline-end',end,'important');}
  });
  const pages=[];
  const baseNodes=[...document.querySelectorAll('.a4-page,.cv-page')].filter(e=>!e.closest('.opt-sheet'));
  const basePages=baseNodes.length || 1;
  function newPage(){
    const p=node(`<article class="opt-sheet" aria-label="CV continuation"><div class="opt-running"><strong>${escape(record.name || 'Curriculum vitae')}</strong><span>CURRICULUM VITAE / CONTINUED</span></div><div class="opt-content"></div><div class="opt-footer"><span>Curriculum vitae</span><span class="opt-page-number"></span></div></article>`);
    document.body.append(p);pages.push(p);return p;
  }
  const fits=p=>p.querySelector('.opt-content').getBoundingClientRect().bottom <= p.querySelector('.opt-footer').getBoundingClientRect().top-24;
  let current=null;
  const emitted=[];
  for(const s of record.optionalSections || []){
    if(s.enabled===false)continue;
    const def=definitions[s.type];if(!def)continue;
    const items=(s.items||[]).filter(item=>Object.values(item).some(v=>typeof v==='string'?v.trim():typeof v==='number'));
    if(!items.length)continue;
    const entries=items.map((item,i)=>{
      const texts=[];
      const titleFields=Object.entries(def.fields).filter(([,f])=>f.role==='title');
      let title=titleFields.map(([k])=>item[k]).filter(Boolean).join(' — ');
      const level=Object.entries(def.fields).find(([,f])=>f.role==='level');
      if(level&&item[level[0]])title=[title,item[level[0]]].filter(Boolean).join(' — ');
      if(s.type==='myTime' && item.percent!==undefined)title=`${item.activity || ''} ${item.percent}%`;
      for(const [k,f] of Object.entries(def.fields)){
        const v=item[k];if(v===undefined||v===''||f.role==='title'||f.role==='level'||(s.type==='myTime'&&k==='percent'))continue;
        if(f.type==='image'){
          const valid=/^data:image\/(png|jpeg|webp);base64,/.test(v)||/^assets\/upload-[a-f0-9]{24}\.(png|jpg|webp)$/.test(v);
          if(valid)texts.unshift(`<img class="opt-image ${s.type==='books'?'opt-cover':'opt-signature'}" src="${escape(v)}" alt="${escape(s.type==='books'?'Book cover':'Signature')}" width="${s.type==='books'?65:220}" height="${s.type==='books'?95:70}">`);
        }else if(f.type==='url'){
          if(/^https?:\/\//i.test(v))texts.push(`<a class="opt-url" href="${escape(v)}" rel="noopener noreferrer">${escape(v)}</a>`);
        }else texts.push(`<p class="${f.role==='meta'?'opt-meta':'opt-copy'}">${escape(v)}</p>`);
      }
      const bar=s.type==='myTime'?`<div class="opt-bar" aria-hidden="true"><span style="--amount:${Math.max(0,Math.min(100,+item.percent||0))}%"></span></div>`:'';
      return node(`<article class="opt-entry" data-entry-id="${escape(s.id)}-${i}">${title?`<h3 class="opt-title">${escape(title)}</h3>`:''}${texts.join('')}${bar}</article>`);
    });
    const title=s.title?.trim()||def.title;
    const createSection=continued=>node(`<section class="opt-section" data-optional-id="${escape(s.id)}" data-optional-type="${escape(s.type)}"><h2 class="opt-heading">${escape(title)}${continued?' / continued':''}</h2></section>`);
    if(!current)current=newPage();
    let section=createSection(false);entries.forEach(e=>section.append(e));current.querySelector('.opt-content').append(section);
    if(!fits(current)){
      section.remove();
      if(current.querySelector('.opt-content').children.length)current=newPage();
      current.querySelector('.opt-content').append(section);
      if(!fits(current)){
        entries.forEach(e=>e.remove());
        for(const entry of entries){
          section.append(entry);
          if(!fits(current)){
            entry.remove();
            if(!section.querySelector('.opt-entry'))section.remove();
            current=newPage();section=createSection(true);current.querySelector('.opt-content').append(section);section.append(entry);
            if(!fits(current))throw new Error(`An entry in “${title}” is longer than one A4 sheet. Shorten that entry.`);
          }
        }
      }
    }
    emitted.push(s.id);
  }
  for(const p of [...pages])if(!p.querySelector('.opt-entry')){p.remove();pages.splice(pages.indexOf(p),1);}
  const total=basePages+pages.length;
  baseNodes.forEach((p,i)=>p.setAttribute('aria-label',`A4 page ${i+1} of ${total}`));
  pages.forEach((p,i)=>{p.setAttribute('aria-label',`A4 page ${basePages+i+1} of ${total}`);p.querySelector('.opt-page-number').textContent=`${basePages+i+1} / ${total}`;});
  document.querySelectorAll('.cv-page-footer,.page-footer').forEach((f,i)=>{const last=f.lastElementChild;if(last){const previous=last.textContent;last.textContent=/\d+\s*\/\s*\d+\s*$/.test(previous)?previous.replace(/\d+\s*\/\s*\d+\s*$/,`${i+1} / ${total}`):`${i+1} / ${total}`;}});
  return {basePages,optionalPages:pages.length,totalPages:total,emitted};
}
module.exports={optionalCSS,renderOptional};
