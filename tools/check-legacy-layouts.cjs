const fs=require('fs');
const path=require('path');
const os=require('os');
const assert=require('assert/strict');
const {pathToFileURL}=require('url');
const e=require('./cv-engine.cjs');
const {renderOptional,optionalCSS}=require('./optional-sections.cjs');
const compact=s=>s.normalize('NFKC').replace(/\s/g,'').toLowerCase();
function selections(defs){return Object.entries(defs).map(([type,d])=>({id:'test-'+type,type,items:structuredClone(d.sample)}));}
function scenarios(defs){
 const all=selections(defs),cases=[{name:'baseline',sections:[]}];
 for(const s of all)cases.push({name:s.type,sections:[s]});
 cases.push({name:'all-sections',sections:all});
 const stress=all.map(s=>({...s,items:Array.from({length:4},(_,i)=>Object.fromEntries(Object.entries(defs[s.type].fields).map(([k,f])=>{let v=s.items[0]?.[k]??'';if(f.type==='number')v=25;else if(f.type==='image')v=defs.signature.sample[0].image;else if(f.type!=='url'){const text=f.type==='multiline'?'Carefully documented practical work with collaborators and clear outcomes. ':'Detailed professional contribution ';v=(text.repeat(100)).slice(0,f.maxLength-5)+' '+i;}return[k,v];})))}));
 cases.push({name:'long-text-many-items',sections:stress});
 cases.push({name:'empty-data',sections:all.map(s=>({...s,items:[]}))});
 cases.push({name:'blank-fields',sections:all.map(s=>({...s,items:[{}]}))});
 cases.push({name:'removed-sections',sections:all.map(s=>({...s,enabled:false}))});
 for(const language of ['ps','fa'])cases.push({name:'rtl-'+language,language,direction:'rtl',sections:all.map(s=>({...s,title:language==='ps'?'زما مسلکي تجربې':'تجربه و مهارت های من',items:s.items.map(item=>Object.fromEntries(Object.entries(item).map(([k,v])=>[k,typeof v==='string'&&!/^(data:|https?:)/.test(v)?(language==='ps'?'زما د زده کړې او کار تجربې':'همکاری و تجربه های حرفه ای'):v])))}))});
 cases.push({name:'uploaded-images',sections:[{...all.find(s=>s.type==='books'),items:[{...defs.books.sample[0],cover:defs.signature.sample[0].image}]},all.find(s=>s.type==='signature')]});
 return cases;
}
async function geometry(page){return page.evaluate(()=>{
 const pages=[...document.querySelectorAll('.a4-page,.cv-page,.opt-sheet')];
 const core=['contact','summary','experience','education','skills'];
 const missing=core.filter(k=>!document.querySelector(`[data-cv-section="${k}"],[data-section="${k}"]`));
 const overflow=[],dimensions=[];
 for(const p of pages){const r=p.getBoundingClientRect();dimensions.push([Math.round(r.width),Math.round(r.height)]);
 const optional=p.matches('.opt-sheet');const footer=p.querySelector('.opt-footer');
 const entries=optional?[...p.querySelectorAll('.opt-entry,.opt-heading')]:[...p.querySelectorAll('[data-cv-job],[data-cv-degree],[data-cv-section],[data-section]')];
 for(const s of entries){const a=s.getBoundingClientRect();if(a.bottom>(footer?footer.getBoundingClientRect().top-12:r.bottom-15)||a.right>r.right+2||a.left<r.left-2)overflow.push({text:s.textContent.slice(0,60),page:pages.indexOf(p)+1});}
 }
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id),duplicateIds=ids.filter((id,i)=>ids.indexOf(id)!==i);
 const jobs=[...document.querySelectorAll('[data-cv-job],.job')].filter(n=>n.closest('[data-cv-section="experience"],[data-section="experience"]'));
 return{pages:pages.length,dimensions,missing,overflow,duplicateIds,entryIds:[...document.querySelectorAll('.opt-entry')].map(n=>n.dataset.entryId),scripts:document.querySelectorAll('script').length,optionalPages:document.querySelectorAll('.opt-sheet').length,direction:getComputedStyle(document.querySelector('.opt-sheet')||document.body).direction,invalidBullets:jobs.filter(n=>n.querySelectorAll('li').length<2||n.querySelectorAll('li').length>4).length};
});}
async function main(){
 const data=e.load(),defs=data.sectionDefinitions,found=e.discover(),args=process.argv.slice(2),selected=args.filter(a=>!a.startsWith('--')),templates=selected.length?found.filter(id=>selected.includes(id)):found;
 const report={generatedAt:new Date().toISOString(),templatesFound:found,sectionTypes:Object.keys(defs),cases:[],failures:[],unitChecks:[]};
 const unit=(name,fn)=>{try{fn();report.unitChecks.push({name,passed:true});}catch(err){report.failures.push({name,error:err.message});}};
 unit('reject overlong fields',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'custom',items:[{title:'Long entry',body:'x'.repeat(1201)}]}],defs)));
 unit('reject unknown sections',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'bad',items:[]}],defs)));
 unit('reject executable URLs',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'online',items:[{label:'Unsafe link',url:'javascript:alert(1)'}]}],defs)));
 unit('reject SVG uploads',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'signature',items:[{image:'data:image/svg+xml;base64,AAAA'}]}],defs)));
 unit('reject invalid percentages',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'myTime',items:[{activity:'Design',percent:101}]}],defs)));
 unit('reusable custom instances',()=>e.validateSelections([{id:'one',type:'custom',items:[{title:'One'}]},{id:'two',type:'custom',items:[{title:'Two'}]}],defs));
 unit('signature requires an uploaded image',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'signature',items:[{name:'No image'}]}],defs)));
 unit('reject duplicate section IDs',()=>assert.throws(()=>e.validateSelections([{id:'x',type:'custom',items:[]},{id:'x',type:'custom',items:[]}],defs)));
 let localPDFJS;try{localPDFJS=require.resolve('pdfjs-dist/legacy/build/pdf.mjs');}catch{}
 const pdfjsPath=process.env.PDFJS_MODULE||localPDFJS||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
 const pdfjs=await import(pathToFileURL(pdfjsPath).href);
 const browser=await e.playwright().chromium.launch(e.browserOptions());
 const filter=args.find(a=>a.startsWith('--scenario='))?.split('=')[1];const cases=scenarios(defs).filter(s=>!filter||s.name.startsWith(filter));let next=0;
 async function worker(){
 const page=await browser.newPage({viewport:{width:1400,height:1600}});
 while(next<templates.length){const id=templates[next++];console.log('Checking template '+id+' ('+cases.length+' scenarios)');
 try{const baseline=await e.openSource(page,id),theme=await e.resolveTheme(page,id);
 for(const scenario of cases){const item={template:id,scenario:scenario.name};
 try{
  await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1400,height:1600});
  await page.setContent(baseline,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  const record={...data[id],optionalSections:scenario.sections,direction:scenario.direction||'ltr',language:scenario.language||'en'};
  e.validateSelections(record.optionalSections,defs);await page.addStyleTag({content:optionalCSS(theme)});
  const result=await page.evaluate(renderOptional,{record,definitions:defs,theme});
  await page.evaluate(async()=>{for(const image of document.querySelectorAll('.opt-image'))await image.decode();});
  const g=await geometry(page);assert.equal(g.scripts,0,'Generated CV must contain no JavaScript');assert.deepEqual(g.missing,[],'Missing core section');assert.deepEqual(g.duplicateIds,[],'Duplicate element IDs');assert.equal(g.invalidBullets,0,'Work history needs 2–4 bullets');assert.deepEqual(g.overflow,[],'Content crosses sheet bounds');
  assert(g.dimensions.every(([w,h])=>Math.abs(w-794)<=1&&Math.abs(h-1123)<=1),'Non-A4 dimensions');
  const expected=scenario.sections.filter(s=>s.enabled!==false).reduce((sum,s)=>sum+s.items.filter(it=>Object.values(it).some(v=>typeof v==='string'?v.trim():typeof v==='number')).length,0);
  assert.equal(g.entryIds.length,expected,'Lost or duplicated entries during pagination');assert.equal(new Set(g.entryIds).size,expected,'An entry was duplicated');
  if(['empty-data','blank-fields','removed-sections'].includes(scenario.name))assert.equal(g.optionalPages,0,'Empty sections leave a gap');
  if(scenario.direction)assert.equal(g.direction,'rtl');
  await page.emulateMedia({media:'print'});const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
  const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
  assert.equal(pdf.numPages,result.totalPages,'PDF page count differs from rendered sheet count');
  let selectable='';
  for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:1});assert(Math.abs(v.width-595.28)<1&&Math.abs(v.height-841.89)<1,'PDF is not A4');if(n>result.basePages)selectable+=(await p.getTextContent()).items.map(x=>x.str).join(' ');}
  if(!scenario.direction){for(const s of scenario.sections.filter(s=>s.enabled!==false)){if(!s.items.length)continue;const first=s.items[0];const titleField=Object.entries(defs[s.type].fields).find(([,f])=>f.role==='title');if(titleField&&first[titleField[0]])assert(compact(selectable).includes(compact(first[titleField[0]]).slice(0,35)),'PDF text is not selectable');}
   if(scenario.sections.some(s=>s.type==='languages'&&s.enabled!==false&&s.items.some(i=>i.language)))assert(compact(selectable).includes('english—proficient')||scenario.name==='long-text-many-items','Language level missing from PDF text');
   if(scenario.sections.some(s=>s.type==='myTime'&&s.enabled!==false&&s.items.some(i=>i.activity))&&scenario.name!=='long-text-many-items')assert(compact(selectable).includes('design40%'),'Time percentage missing from PDF text');
  }else assert(/[\u0600-\u06ff]/.test(selectable.normalize('NFKC')),'RTL PDF has no selectable Arabic-script text');
  item.pdfPages=pdf.numPages;await pdf.destroy();
  await page.emulateMedia({media:'screen'});await page.setViewportSize({width:390,height:844});
  item.mobile=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth}));assert(item.mobile.width<=item.mobile.viewport+1,'Mobile horizontal overflow');
  item.passed=true;item.optionalEntries=expected;
 }catch(err){item.passed=false;item.error=err.message;report.failures.push({template:id,scenario:scenario.name,error:err.message});console.log('FAIL '+id+' '+scenario.name+': '+err.message.slice(0,160));}
 report.cases.push(item);
 }
 }catch(err){report.failures.push({template:id,error:err.message});}
 }
 await page.close();
 }
 try{await Promise.all([worker(),worker()]);
 // A future numbered folder with no theme or data registration must be picked up automatically.
 const future=String(Math.max(...found.map(Number))+1000),target=path.join(e.root,future),source=path.join(__dirname,'layout-sources',future+'.html');
 assert(!fs.existsSync(target),'Future-template fixture already exists');
 try{fs.mkdirSync(target);const ref=templates[0];for(const file of fs.readdirSync(path.join(e.root,ref))){const from=path.join(e.root,ref,file);if(fs.statSync(from).isFile()&&file!=='theme.json')fs.copyFileSync(from,path.join(target,file));}
 assert(e.discover().includes(future),'Directory discovery missed a future template');const p=await browser.newPage({viewport:{width:1400,height:1600}});await e.render(p,future,{name:'Future template',optionalSections:selections(defs)},defs);assert(fs.existsSync(path.join(target,'theme.json')));assert.equal(await p.locator('.opt-section').count(),Object.keys(defs).length);await p.close();report.unitChecks.push({name:'future numbered template without registration/theme',passed:true});
 }finally{const resolved=path.resolve(target);if(resolved.startsWith(e.root+path.sep)&&path.basename(resolved)===future)fs.rmSync(resolved,{recursive:true,force:true});if(fs.existsSync(source))fs.unlinkSync(source);}
 }finally{await browser.close();}
 if((selected.length||filter)&&fs.existsSync(path.join(__dirname,'layout-audit.json'))){const previous=JSON.parse(fs.readFileSync(path.join(__dirname,'layout-audit.json'),'utf8'));const keys=new Set(report.cases.map(c=>c.template+':'+c.scenario));report.cases=[...(previous.cases||[]).filter(c=>found.includes(c.template)&&!keys.has(c.template+':'+c.scenario)),...report.cases];report.failures=[...(previous.failures||[]).filter(c=>c.template&&found.includes(c.template)&&!keys.has(c.template+':'+c.scenario)),...report.failures];}
 report.cases.sort((a,b)=>+a.template-+b.template||a.scenario.localeCompare(b.scenario));
 report.summary={templates:new Set(report.cases.map(c=>c.template)).size,sectionTypes:Object.keys(defs).length,scenariosPerTemplate:scenarios(defs).length,testCases:report.cases.length,passed:report.cases.filter(c=>c.passed).length,failed:report.failures.length};
 fs.writeFileSync(path.join(__dirname,'layout-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.failures.length)process.exitCode=1;
}
main().catch(err=>{console.error(err);process.exitCode=1;});
