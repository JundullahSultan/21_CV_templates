const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const engine = require("./cv-engine.cjs");
const { optionalCSS } = require("./optional-sections.cjs");
const root = path.resolve(__dirname, "..");
function scopeCSS(css, id) {
  const scope = `.tpl-${id}`;
  const tree = postcss.parse(css);
  // The editor scales a physical A4 canvas. Legacy viewport-based reflow must
  // not change its typography or pagination when the surrounding app is narrow.
  tree.walkAtRules("media", (rule) => {
    if (/width\s*:/i.test(rule.params) && !/print/i.test(rule.params))
      rule.remove();
  });
  const names = new Map();
  tree.walkAtRules("keyframes", (r) => {
    const old = r.params;
    r.params = `tpl-${id}-${old}`;
    names.set(old, r.params);
  });
  tree.walkAtRules("font-face", (r) =>
    r.walkDecls("font-family", (d) => {
      const old = d.value.replace(/["']/g, "");
      names.set(old, `tpl-${id}-${old.replace(/\s+/g, "-")}`);
      d.value = `"${names.get(old)}"`;
    }),
  );
  tree.walkAtRules("font-face", (rule) => {
    if (rule.toString().includes("Rubik-Variable.ttf")) rule.remove();
  });
  tree.walkDecls((d) => {
    if (/^(font|font-family|animation|animation-name)$/.test(d.prop))
      for (const [old, value] of names)
        d.value = d.value.replace(
          new RegExp(
            `(?<![\\w-])${old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
            "g",
          ),
          value,
        );
  });
  tree.walkAtRules("import", (r) => r.remove());
  tree.walkDecls((d) => {
    d.value = d.value.replace(
      /url\((['"]?)(?!data:|https?:|\/|#)([^)'"\s]+)\1\)/g,
      (_, q, url) => `url("/templates/${id}/${url}")`,
    );
  });
  tree.walkRules((rule) => {
    if (rule.parent.type === "atrule" && /keyframes/.test(rule.parent.name))
      return;
    rule.selector = postcss.list
      .comma(rule.selector)
      .map((raw) => {
        let s = raw.trim();
        s = s
          .replace(/html\[dir="rtl"\]/g, `${scope}[dir="rtl"]`)
          .replace(/(?<![\w-])(?:html|body)(?![\w-])|:root/g, scope);
        s = s.replace(new RegExp(`\\.tpl-${id}\\s+\\.tpl-${id}`, "g"), scope);
        return s.includes(scope) ? s : `${scope} ${s}`;
      })
      .join(",");
  });
  return tree.toString();
}
async function compile() {
  require("./font-styles.cjs").writeFontStyles(engine.discover());
  const out = path.join(root, "public"),
    templates = path.join(out, "templates");
  fs.mkdirSync(templates, { recursive: true });
  const data = engine.load(),
    defs = data.sectionDefinitions,
    manifest = [];
  fs.writeFileSync(path.join(out, "sections.json"), JSON.stringify(defs));
  const browser = await engine
    .playwright()
    .chromium.launch(engine.browserOptions());
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1500 },
    });
    for (const id of engine.discover()) {
      await engine.openSource(page, id);
      const sample = await page.evaluate((record) => {
        const text = (e) => e?.textContent.trim() || "";
        const section = (k) =>
          document.querySelector(
            `[data-cv-section="${k}"],[data-section="${k}"]`,
          );
        const contact = section("contact") || document;
        const jobs = [...document.querySelectorAll("[data-cv-job]")];
        const jobNodes = jobs.length
          ? jobs
          : [
              ...(section("experience")?.querySelectorAll(
                ".job,.timeline-entry",
              ) || []),
            ];
        const degrees = [...document.querySelectorAll("[data-cv-degree]")];
        const degreeNodes = degrees.length
          ? degrees
          : [...(section("education")?.querySelectorAll("article") || [])];
        return {
          ...record,
          name: record.name || text(document.querySelector("h1")),
          role:
            record.role ||
            text(
              document.querySelector(
                ".profession,.role,.job-role,.subtitle,.target-role,.identity>p",
              ),
            ) ||
            "Creative professional",
          summary:
            text(section("summary")?.querySelector("p")) ||
            record.summary ||
            text(section("summary")),
          phone: record.phone || text(contact.querySelector('a[href^="tel:"]')),
          email:
            record.email || text(contact.querySelector('a[href^="mailto:"]')),
          city:
            record.city ||
            text(
              contact.querySelector(
                ".location,.contact-location,[data-location],span:last-child",
              ),
            ) ||
            "London, United Kingdom",
          portfolio: contact.querySelector('a[href^="http"]')?.href || "",
          jobs:
            record.jobs ||
            jobNodes.map((n) => ({
              title: text(n.querySelector("h4") || n.querySelector("h3")),
              organization: text(
                n.querySelector("[data-organization],.organization,.company") ||
                  (n.querySelector("h4") ? n.querySelector("h3") : null),
              ),
              dates: text(n.querySelector("[data-dates],.date,time")),
              bullets: [...n.querySelectorAll("li")].map(text),
            })),
          education:
            record.education ||
            degreeNodes.map((n) => ({
              degree: text(n.querySelector("h4") || n.querySelector("h3")),
              institution: text(
                n.querySelector(".organization,.school") ||
                  (n.querySelector("h4")
                    ? n.querySelector("h3")
                    : [...n.querySelectorAll("p")].find(
                        (p) => !p.classList.contains("date"),
                      )),
              ),
              year: (text(n).match(/20\d{2}|19\d{2}/) || ["2020"])[0],
            })),
          skills:
            record.skills ||
            [...(section("skills")?.querySelectorAll("li") || [])].map(text),
          optionalSections: record.optionalSections || [],
        };
      }, data[id] || {});
      engine.validateSelections(sample.optionalSections || [], defs);
      const theme = await engine.resolveTheme(page, id, false);
      const compiled = await page.evaluate(
        ({ sample, id }) => {
          const text = (e) => e?.textContent.trim() || "";
          const section = (k) =>
            document.querySelector(
              `[data-cv-section="${k}"],[data-section="${k}"]`,
            );
          const put = (e, p) => {
            if (e) e.dataset.bind = p;
          };
          const textBindings = new Map();
          const textNodes = (e) => {
            if (!e) return [];
            const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT),
              nodes = [];
            while (walker.nextNode())
              if (walker.currentNode.textContent.trim())
                nodes.push(walker.currentNode);
            return nodes;
          };
          for (const [prefix, field] of [
            ["tel:", "phone"],
            ["mailto:", "email"],
          ])
            document
              .querySelectorAll(`a[href^="${prefix}"]`)
              .forEach((link) => {
                const nodes = textNodes(link).filter(
                  (n) => !n.parentElement.closest('svg,[aria-hidden="true"]'),
                );
                const n = nodes.sort(
                  (a, b) => b.textContent.length - a.textContent.length,
                )[0];
                if (n) textBindings.set(n, field);
              });
          document
            .querySelectorAll(
              '[data-cv-section="contact"],[data-section="contact"]',
            )
            .forEach((contact) => {
              const candidates = textNodes(contact).filter(
                (n) =>
                  !n.parentElement.closest(
                    'a,h1,h2,h3,svg,[aria-hidden="true"]',
                  ) &&
                  n.textContent.trim().length > 5 &&
                  !/@|phone|email|website|linkedin|portfolio|contact|replace/i.test(
                    n.textContent,
                  ),
              );
              const city =
                candidates.find(
                  (n) => sample.city && n.textContent.includes(sample.city),
                ) ||
                candidates.find((n) => n.textContent.includes(",")) ||
                candidates.at(-1);
              if (city) textBindings.set(city, "city");
            });
          document.querySelectorAll("h1").forEach((e) => put(e, "name"));
          document
            .querySelectorAll(
              ".profession,.role,.job-role,.subtitle,.target-role,.identity>p",
            )
            .forEach((e) => put(e, "role"));
          const summary = section("summary");
          if (summary) put(summary.querySelector("p") || summary, "summary");
          document.querySelectorAll('a[href^="mailto:"]').forEach((e) => {
            e.dataset.hrefBind = "email";
          });
          document.querySelectorAll('a[href^="tel:"]').forEach((e) => {
            e.dataset.hrefBind = "phone";
          });
          document
            .querySelectorAll(
              '[data-cv-section="contact"] a[href^="http"],[data-section="contact"] a[href^="http"]',
            )
            .forEach((e) => {
              e.dataset.hrefBind = "portfolio";
              e.dataset.editBind = "portfolio";
            });
          const exp = [...document.querySelectorAll("[data-cv-job]")];
          const jobs = exp.length
            ? exp
            : [
                ...(section("experience")?.querySelectorAll(
                  ".job,.timeline-entry",
                ) || []),
              ];
          jobs.forEach((e, i) => {
            e.dataset.recordIndex = i;
            e.dataset.recordType = "jobs";
            put(
              e.querySelector("h4") || e.querySelector("h3"),
              `jobs.${i}.title`,
            );
            put(
              e.querySelector("[data-organization],.organization,.company") ||
                (e.querySelector("h4") ? e.querySelector("h3") : null),
              `jobs.${i}.organization`,
            );
            put(e.querySelector("[data-dates],.date,time"), `jobs.${i}.dates`);
            const ul = e.querySelector("ul");
            if (ul) ul.dataset.listBind = `jobs.${i}.bullets`;
          });
          const ed = [...document.querySelectorAll("[data-cv-degree]")];
          const degrees = ed.length
            ? ed
            : [...(section("education")?.querySelectorAll("article") || [])];
          degrees.forEach((e, i) => {
            e.dataset.recordIndex = i;
            e.dataset.recordType = "education";
            put(
              e.querySelector("h4") || e.querySelector("h3"),
              `education.${i}.degree`,
            );
            const p = [...e.querySelectorAll("p")];
            put(
              e.querySelector(".organization,.school") ||
                (e.querySelector("h4")
                  ? e.querySelector("h3")
                  : p.find((p) => !p.classList.contains("date"))),
              `education.${i}.institution`,
            );
            put(
              e.querySelector(".date") || p[p.length - 1],
              `education.${i}.year`,
            );
          });
          const skills = section("skills")?.querySelector("ul");
          if (skills) skills.dataset.listBind = "skills";
          else if (section("skills"))
            section("skills").dataset.skillsOriginal = JSON.stringify(
              sample.skills,
            );
          if (!skills && section("skills")) {
            const rows = [
              ...section("skills").querySelectorAll(
                ".skill,.skill-panel > div,.tags > span",
              ),
            ];
            rows.forEach((row, i) => {
              const label =
                row.querySelector(".sr-only,h3") ||
                row.querySelector("span:not([aria-hidden])") ||
                row;
              const index = sample.skills.findIndex(
                (s) => s.toLowerCase() === text(label).toLowerCase(),
              );
              if (index >= 0) {
                put(label, `skills.${index}`);
                const icon = row.querySelector(".app");
                if (icon) icon.dataset.editBind = `skills.${index}`;
              }
            });
          }
          const replacements = [];
          for (const key of ["name", "phone", "email", "city", "portfolio"])
            if (sample[key]) replacements.push([sample[key], key]);
          (sample.skills || []).forEach((skill, i) =>
            replacements.push([skill, `skills.${i}`]),
          );
          // Preserve legacy extra text (headings, achievements, courses, etc.)
          // without forcing it into a core field or flattening composite markup.
          const editableDefaults = {};
          let extraIndex = 0;
          document
            .querySelectorAll("h2,h3,h4,p,li,span,strong,b,a,address")
            .forEach((element) => {
              const value = element.textContent;
              if (
                element.children.length ||
                !/\p{L}/u.test(value) ||
                element.closest(
                  '[data-bind],[data-edit-bind],svg,[aria-hidden="true"],.page-footer,.cv-page-footer,.opt-running,.opt-footer',
                ) ||
                textNodes(element).some((n) => textBindings.has(n)) ||
                replacements.some(([text]) => value.includes(text))
              )
                return;
              const date = /\b\d{4}\s*[-–—]\s*(?:\d{4}|present|current)/i.test(
                  value,
                ),
                year = !date && element.classList.contains("date");
              const field = `templateText.${id}.extra${extraIndex++}${date ? ".dates" : year ? ".year" : ""}`;
              element.dataset.editPath = field;
              editableDefaults[field] = value;
            });
          let legacyIndex = 0;
          document.querySelectorAll("section").forEach((section) => {
            if (
              !section.closest("[data-cv-section],[data-section]") &&
              !section.querySelector("[data-cv-section],[data-section],h1") &&
              section.querySelector("[data-edit-path]")
            )
              section.dataset.cvSection = `legacy-${legacyIndex++}`;
          });
          const editableFields = new Map();
          const sampleValue = (path) =>
            path.split(".").reduce((value, key) => value?.[key], sample);
          const register = (
            path,
            element,
            value,
            kind = "text",
            extra = {},
          ) => {
            if (element.parentElement?.closest("[data-bind],[data-list-bind]"))
              return;
            if (
              element.parentElement?.closest("[data-skills-original]") &&
              !element.closest("h2")
            )
              return;
            if (editableFields.has(path)) return;
            const container = element.closest("section,header,footer");
            const heading = container?.querySelector("h2,h3");
            const group =
              text(heading) ||
              (container?.tagName === "HEADER"
                ? "Profile"
                : container?.tagName === "FOOTER"
                  ? "Contact and links"
                  : "Other details");
            const names = {
              name: "Full name",
              role: "Target role",
              phone: "Phone",
              email: "Email",
              city: "City / country",
              portfolio: "Portfolio link",
              summary: "Professional summary",
              title: "Job title",
              organization: "Organization",
              dates: "Dates",
              bullets: "Achievements",
              degree: "Degree / qualification",
              institution: "Institution",
              year: "Graduation year",
              skills: "Skills",
            };
            const last = path.split(".").at(-1);
            const label = path.startsWith("templateText.")
              ? String(value).replace(/\s+/g, " ").trim().slice(0, 90)
              : names[last] ||
                (path.startsWith("skills.")
                  ? `Skill ${Number(last) + 1}`
                  : last);
            editableFields.set(path, {
              path,
              group,
              label: label || "Details",
              kind,
              defaultValue: value,
              ...extra,
            });
          };
          document
            .querySelectorAll("[data-edit-path],[data-bind],[data-list-bind]")
            .forEach((element) => {
              const path =
                element.dataset.editPath ||
                element.dataset.bind ||
                element.dataset.listBind;
              const value =
                editableDefaults[path] ?? sampleValue(path) ?? text(element);
              register(
                path,
                element,
                value,
                Array.isArray(value) ? "lines" : "text",
              );
            });
          if (section("skills") && !editableFields.has("skills"))
            register("skills", section("skills"), sample.skills || [], "lines");
          // Bind remaining text nodes individually, including numbers and text
          // around inline markup, without flattening the original design.
          let textIndex = 0,
            linkIndex = 0,
            levelIndex = 0;
          const excluded =
            'script,style,svg,[aria-hidden="true"],.page-footer,.cv-page-footer,.opt-running,.opt-footer';
          for (const current of textNodes(document.body)) {
            const element = current.parentElement;
            if (
              element.closest(excluded) ||
              element.closest(
                '[data-bind],[data-edit-path],[data-list-bind],[data-skills-original],meter,progress,[style*="--level"]',
              ) ||
              textBindings.has(current) ||
              !/[\p{L}\p{N}]/u.test(current.textContent)
            )
              continue;
            if (
              replacements.some(([value]) =>
                current.textContent.includes(value),
              )
            )
              continue;
            const path = `templateText.${id}.text${textIndex++}`;
            editableDefaults[path] = current.textContent.trim();
            textBindings.set(current, path);
            register(path, element, editableDefaults[path]);
          }
          document.querySelectorAll("a[href]").forEach((element) => {
            if (
              element.dataset.hrefBind ||
              element.closest(excluded) ||
              element.getAttribute("href").startsWith("#")
            )
              return;
            const path = `templateText.${id}.link${linkIndex++}`;
            element.dataset.urlPath = path;
            editableDefaults[path] = element.getAttribute("href");
            register(path, element, editableDefaults[path], "url", {
              label: `${text(element) || "Contact"} — link`,
            });
          });
          document
            .querySelectorAll('meter,progress,[style*="--level"]')
            .forEach((element) => {
              const path = `templateText.${id}.level${levelIndex++}`;
              const value = element.hasAttribute("value")
                ? Number(element.getAttribute("value"))
                : parseFloat(element.style.getPropertyValue("--level"));
              element.dataset.valuePath = path;
              if (element.style.getPropertyValue("--level"))
                element.dataset.levelStyle = "true";
              editableDefaults[path] = value;
              register(path, element, value, "number", {
                label: element.getAttribute("aria-label") || "Proficiency",
                min: Number(element.getAttribute("min") || 0),
                max: Number(element.getAttribute("max") || 100),
              });
            });
          // Give every design a shared photo slot, preserving its original frame.
          const portraits = [
            ...document.querySelectorAll('img[src*="portrait.jpg"]'),
          ];
          portraits.forEach((image) => (image.dataset.cvPhoto = "true"));
          document
            .querySelectorAll('[aria-label="Profile photo placeholder"]')
            .forEach((frame) => {
              const holder = frame.querySelector(".avatar") || frame;
              const placeholder = holder.querySelector("svg");
              if (placeholder) placeholder.dataset.cvPhotoPlaceholder = "true";
              const image = document.createElement("img");
              image.dataset.cvPhoto = "true";
              image.dataset.cvPhotoOptional = "true";
              image.style.cssText =
                "width:100%;height:100%;object-fit:cover;display:block";
              holder.append(image);
            });
          if (!document.querySelector("[data-cv-photo]")) {
            const image = document.createElement("img");
            image.dataset.cvPhoto = "true";
            image.dataset.cvPhotoOptional = "true";
            image.style.cssText =
              "width:80px;height:80px;object-fit:cover;float:inline-end;margin:0 0 12px 16px;border-radius:8px";
            document.querySelector("h1")?.before(image);
          }
          function node(n) {
            if (n.nodeType === 3) {
              let value = n.textContent;
              if (textBindings.has(n)) {
                const path = textBindings.get(n);
                register(
                  path,
                  n.parentElement,
                  editableDefaults[path] ?? sampleValue(path) ?? value.trim(),
                );
                return {
                  text: value,
                  replace: value.trim(),
                  bind: path,
                };
              }
              const match = replacements.find(([s]) => value.includes(s));
              if (match && !n.parentElement.closest(excluded))
                register(
                  match[1],
                  n.parentElement,
                  sampleValue(match[1]) ?? match[0],
                );
              return match
                ? { text: value, replace: match[0], bind: match[1] }
                : value;
            }
            if (
              n.nodeType !== 1 ||
              ["SCRIPT", "LINK", "STYLE"].includes(n.tagName)
            )
              return null;
            const attrs = {};
            for (const a of n.attributes) {
              if (a.name.startsWith("on")) continue;
              let v = a.value;
              if (
                ["src", "poster"].includes(a.name) &&
                !/^data:|https?:|\//.test(v)
              )
                v = `/templates/${id}/${v}`;
              attrs[a.name] = v;
            }
            return {
              tag: n.tagName.toLowerCase(),
              attrs,
              children: [...n.childNodes].map(node).filter((x) => x !== null),
            };
          }
          return {
            tree: [...document.body.childNodes]
              .map(node)
              .filter((x) => x !== null),
            rootStyle: document.documentElement.getAttribute("style") || "",
            jobCount: jobs.length,
            educationCount: degrees.length,
            editableDefaults,
            editableFields: [...editableFields.values()],
          };
        },
        { sample, id },
      );
      const dir = path.join(templates, id);
      fs.mkdirSync(dir, { recursive: true });
      for (const entry of fs.readdirSync(path.join(root, id), {
        withFileTypes: true,
      })) {
        if (
          entry.isDirectory() &&
          fs.existsSync(
            path.join(root, id, entry.name, ".cv-studio-font-bundle"),
          )
        )
          continue;
        if (entry.isDirectory())
          fs.cpSync(
            path.join(root, id, entry.name),
            path.join(dir, entry.name),
            { recursive: true },
          );
        else if (!/\.(html|css|json)$/.test(entry.name))
          fs.copyFileSync(
            path.join(root, id, entry.name),
            path.join(dir, entry.name),
          );
      }
      const source = fs.readFileSync(
        path.join(root, "tools/layout-sources", `${id}.html`),
        "utf8",
      );
      let css = [...source.matchAll(/href="([^"/]+\.css)"/g)]
        .map((m) => m[1])
        .filter((f) => !["logical.css", "sections.css"].includes(f))
        .map((f) => fs.readFileSync(path.join(root, id, f), "utf8"))
        .join("\n");
      css +=
        "\n" +
        (await page.evaluate(require("./logical-css.cjs").logicalCSS, css)) +
        "\n" +
        optionalCSS(theme);
      css += `\nbody {margin:0!important;padding:0!important;background:transparent!important;display:block!important;min-height:0!important;}\n.a4-page,.cv-page,.opt-sheet {flex:none;}\n`;
      fs.writeFileSync(path.join(dir, "template.css"), scopeCSS(css, id));
      fs.writeFileSync(
        path.join(dir, "template.json"),
        JSON.stringify({ id, ...compiled, sample, theme }),
      );
      const pageCount = (await page.locator(".a4-page,.cv-page").count()) || 1;
      manifest.push({
        id,
        displayName: `${sample.name} · ${id}`,
        thumbnail: `/thumbnails/${id}.webp`,
        supportedSections: Object.keys(defs),
        pageCount,
      });
      console.log(`Compiled React template ${id}`);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(out, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return manifest;
}
if (require.main === module)
  compile().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { compile, scopeCSS };
