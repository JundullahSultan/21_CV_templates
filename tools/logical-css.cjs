// Adapt existing physical legacy declarations only in RTL. Original LTR layouts stay intact.
function logicalCSS(css) {
  const sheet=new CSSStyleSheet();sheet.replaceSync(css.replace(/@import[^;]+;/g,''));
  const map={'left':'inset-inline-start','right':'inset-inline-end','margin-left':'margin-inline-start','margin-right':'margin-inline-end','padding-left':'padding-inline-start','padding-right':'padding-inline-end','border-left':'border-inline-start','border-right':'border-inline-end','border-left-width':'border-inline-start-width','border-right-width':'border-inline-end-width','border-left-style':'border-inline-start-style','border-right-style':'border-inline-end-style','border-left-color':'border-inline-start-color','border-right-color':'border-inline-end-color'};
  function rules(list){return[...list].map(rule=>{
    if(rule.type===CSSRule.MEDIA_RULE)return `@media ${rule.conditionText}{${rules(rule.cssRules)}}`;
    if(rule.type!==CSSRule.STYLE_RULE)return '';
    const declarations=[];
    if(rule.style.getPropertyValue('left')||rule.style.getPropertyValue('right'))declarations.push('left:auto!important;right:auto!important;');
    for(const p of rule.style){const v=rule.style.getPropertyValue(p);if(map[p])declarations.push(`${map[p]}:${v}!important;`);
      else if(p==='text-align'&&['left','right'].includes(v))declarations.push(`text-align:${v==='left'?'start':'end'}!important;`);
      else if(p==='float'&&['left','right'].includes(v))declarations.push(`float:${v==='left'?'inline-start':'inline-end'}!important;`);
    }
    if(!declarations.length)return '';
    return rule.selectorText.split(',').map(s=>'html[dir="rtl"] '+s.trim()).join(',')+'{'+declarations.join('')+'}';
  }).join('\n');}
  return 'html[dir="rtl"] .original-layout{transform-origin:100% 0!important;}\n'+rules(sheet.cssRules);
}
module.exports={logicalCSS};
