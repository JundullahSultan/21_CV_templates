const fs = require("fs"),
  path = require("path");
function writeFontStyles(ids) {
  const latin = [
    "Arial",
    "Helvetica",
    "Helvetica Neue",
    "Arial Black",
    "Arial Narrow",
    "Montserrat",
    "DM Sans",
    "Archivo Black",
    "Poppins",
    "Roboto",
    "Be Vietnam Pro",
    "Inter",
    "Barlow Condensed",
    "CV Sans",
  ];
  const mono = ["Courier New", "Share Tech Mono", "VT323"],
    serif = ["Georgia", "Times New Roman", "Pirata One"];
  let css =
    "/* Self-hosted OFL static fonts: no variable-font PDF outlines. */\n";
  const arabic = "U+0600-06FF,U+0750-077F,U+0800-08FF,U+FB50-FDFF,U+FE70-FEFF",
    latinRange = "U+0000-05FF,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F";
  const face = (family, file, weight, range) =>
    `@font-face{font-family:"${family}";src:url('/fonts/${file}') format('truetype');font-weight:${weight};font-style:normal;font-display:block;${range ? "unicode-range:" + range + ";" : ""}}\n`;
  for (const [families, kind] of [
    [latin, "Arimo"],
    [mono, "Cousine"],
    [serif, "Tinos"],
    [["Rubik", ...ids.map((id) => `tpl-${id}-Rubik`)], "Rubik"],
  ])
    for (const family of families)
      for (const weight of [300, 400, 500, 600, 700, 800, 900]) {
        const file =
          kind === "Arimo"
            ? `Arimo-${Math.min(700, Math.max(400, weight))}.ttf`
            : kind === "Rubik"
              ? `Rubik-${weight}.ttf`
              : `${kind}.ttf`;
        css +=
          face(family, file, weight, latinRange) +
          face(
            family,
            weight >= 600 ? "Amiri-Bold.ttf" : "Amiri-Regular.ttf",
            weight,
            arabic,
          );
      }
  css +=
    face("CV Arabic", "Amiri-Regular.ttf", 400, "") +
    face("CV Arabic", "Amiri-Bold.ttf", 700, "") +
    face("CV Pashto", "ps_da.ttf", 400, "") +
    '.cv-render[dir="rtl"] *{letter-spacing:normal!important}\n.cv-render:lang(fa),.cv-render:lang(fa) *{font-family:"CV Arabic"!important}\nhtml:lang(ps),html:lang(ps) body,html:lang(ps) #root *, .cv-render:lang(ps),.cv-render:lang(ps) *{font-family:"CV Pashto",sans-serif!important;letter-spacing:normal!important}\n.cv-render a[href^="tel:"],.cv-render a[href^="mailto:"],.cv-render a[href^="http"]{direction:ltr;unicode-bidi:isolate}\n.cv-render[dir="rtl"] :is(p,h1,h2,h3,li){unicode-bidi:plaintext}\n';
  fs.writeFileSync(path.join(__dirname, "../public/fonts/fonts.css"), css);
}
module.exports = { writeFontStyles };
if (require.main === module)
  writeFontStyles(require("./cv-engine.cjs").discover());
