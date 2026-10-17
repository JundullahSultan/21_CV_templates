const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
const { renderOptional, optionalCSS } = require('./optional-sections.cjs');
const { logicalCSS } = require('./logical-css.cjs');
const root = path.resolve(__dirname, '..');
const dataPath = path.join(__dirname, 'cv-content.json');
const discover = () => fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && /^\d+$/.test(e.name)).map(e => e.name).sort((a,b) => +a - +b || a.localeCompare(b));
function playwright() {
  for (const modulePath of [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(modulePath); } catch {}
  }
  throw new Error('Install Playwright (npm install playwright) or set PLAYWRIGHT_MODULE.');
}
function browserOptions() {
  const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
  return { headless: true, ...(executablePath ? {executablePath} : {}) };
}
const load = () => JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const save = d => { const temp = dataPath + '.tmp'; fs.writeFileSync(temp, JSON.stringify(d,null,2)+'\n'); fs.renameSync(temp,dataPath); };
function validateSelections(sections, defs) {
  if (!Array.isArray(sections) || sections.length > 80) throw new Error('Choose up to 80 optional sections.');
  const ids = new Set();
  const validateText = (value, max, field) => { if (typeof value !== 'string' || value.length > max) throw new Error(`${field}: use text up to ${max} characters.`); };
  const safeImage = value => {
    if (!value) return;
    // Only uploaded raster data or generated local assets are supported. No SVG/HTML or remote tracking images.
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && !/^assets\/upload-[a-f0-9]{24}\.(png|jpg|webp)$/.test(value)) throw new Error('Upload a PNG, JPEG, or WebP image.');
    if (value.length > 2800000) throw new Error('Image is too large (maximum 2 MB).');
  };
  for (const s of sections) {
    const def = defs[s.type]; if (!def) throw new Error('Unknown section type.');
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(s.id || '') || ids.has(s.id)) throw new Error('Each section needs a unique ID.');
    ids.add(s.id);
    if (s.title !== undefined) validateText(s.title,80,'Section title');
    if (!Array.isArray(s.items) || s.items.length > def.maxItems) throw new Error(`${def.title}: maximum ${def.maxItems} entries.`);
    for (const item of s.items) {
      const filled=Object.values(item).some(v=>typeof v==='string'?v.trim():typeof v==='number');
      if(filled)for(const [key,field] of Object.entries(def.fields))if(field.required&&(item[key]===undefined||item[key]===''))throw new Error(`${field.label} is required.`);
      for (const [key,field] of Object.entries(def.fields)) {
      const value = item[key]; if (value === undefined || value === '') continue;
      if (field.type === 'image') safeImage(value);
      else if (field.type === 'number') { if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${field.label}: use a number from 0 to 100.`); }
      else { validateText(value,field.maxLength,key); if (field.type === 'url' && !/^https?:\/\//i.test(value)) throw new Error('Links must start with https:// or http://.'); }
      }
    }
  }
}
async function openSource(page,id) {
  const filename = path.join(root,id,'index.html');
  const source = path.join(__dirname,'layout-sources',`${id}.html`);
  // New numbered folders are registered automatically; existing generated output is never used as the next source.
  if (!fs.existsSync(source)) fs.copyFileSync(filename,source);
  const html = fs.readFileSync(source,'utf8');
  await page.goto(pathToFileURL(filename).href,{waitUntil:'load'});
  await page.setContent(html,{waitUntil:'load'});
  await page.evaluate(() => document.fonts.ready);
  const css=[...html.matchAll(/href="([^"/]+\.css)"/g)].map(m=>m[1]).filter(f=>!['logical.css','sections.css'].includes(f)).map(f=>fs.readFileSync(path.join(root,id,f),'utf8')).join('\n');
  const adapter=await page.evaluate(logicalCSS,css);
  const logicalStyle=await page.addStyleTag({content:adapter});await logicalStyle.evaluate(el=>el.dataset.logicalStyles='true');
  return await page.content();
}
async function resolveTheme(page,id,write=false) {
  const themePath = path.join(root,id,'theme.json');
  const inferred = await page.evaluate(() => {
    const body = getComputedStyle(document.body), css = getComputedStyle(document.documentElement);
    const cover = document.querySelector('.original-layout,.cv-page,.sheet,body > main');
    const c = getComputedStyle(cover || document.body);
    const heading = getComputedStyle(document.querySelector('h2') || document.body);
    const accent = ['--cv-accent','--accent','--red','--green','--blue','--lime','--orange'].map(k => css.getPropertyValue(k).trim()).find(Boolean) || heading.color;
    return {accent, paper:css.getPropertyValue('--cv-paper').trim() || c.backgroundColor, ink:css.getPropertyValue('--cv-ink').trim() || body.color,font:body.fontFamily,headingFont:heading.fontFamily,headingWeight:heading.fontWeight,headingTransform:heading.textTransform,headingSpacing:heading.letterSpacing,spacing:22,headingStyle:'rule',radius:0};
  });
  if (inferred.paper === 'rgba(0, 0, 0, 0)') inferred.paper='#ffffff';
  const theme = {...inferred,...(fs.existsSync(themePath) ? JSON.parse(fs.readFileSync(themePath,'utf8')) : {})};
  if (write || !fs.existsSync(themePath)) fs.writeFileSync(themePath,JSON.stringify(theme,null,2)+'\n');
  return theme;
}
async function render(page,id,record,definitions,{write=false}={}) {
  validateSelections(record.optionalSections || [],definitions);
  await openSource(page,id);
  const theme=await resolveTheme(page,id,write);
  const style=await page.addStyleTag({content:optionalCSS(theme)});
  await style.evaluate(e=>e.dataset.optionalStyles='true');
  const result=await page.evaluate(renderOptional,{record,definitions,theme});
  await page.evaluate(async()=>{for(const image of document.querySelectorAll('.opt-image')){try{await image.decode();}catch{throw new Error('An uploaded image could not be decoded. Use a valid PNG, JPEG, or WebP.');}}});
  if (write) {
    let html=await page.content();
    html=html.replace(/<style[^>]*data-optional-styles="true"[^>]*>[\s\S]*?<\/style>/,'<link rel="stylesheet" href="sections.css" data-optional-styles="true">');
    const logical=await page.locator('style[data-logical-styles]').textContent();
    html=html.replace(/<style[^>]*data-logical-styles="true"[^>]*>[\s\S]*?<\/style>/,'<link rel="stylesheet" href="logical.css" data-logical-styles="true">');
    fs.writeFileSync(path.join(root,id,'logical.css'),logical);
    // Store image uploads as assets so generated CVs remain ordinary static HTML/CSS.
    const assetDir=path.join(root,id,'assets');
    html=html.replace(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/g,(uri,type,base64)=>{
      const bytes=Buffer.from(base64,'base64'); const hash=require('crypto').createHash('sha256').update(bytes).digest('hex').slice(0,24);const name=`upload-${hash}.${type==='jpeg'?'jpg':type}`;
      fs.mkdirSync(assetDir,{recursive:true});fs.writeFileSync(path.join(assetDir,name),bytes);return `assets/${name}`;
    });
    fs.writeFileSync(path.join(root,id,'sections.css'),optionalCSS(theme));
    fs.writeFileSync(path.join(root,id,'index.html'),html);
  }
  return {id,...result,theme};
}
module.exports={root,dataPath,discover,load,save,playwright,browserOptions,validateSelections,openSource,resolveTheme,render};
