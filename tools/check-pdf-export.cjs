const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { execFileSync } = require("child_process");
const e = require("./cv-engine.cjs"),
  { withRenderer, waitRender } = require("./build-app.cjs");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "test-results/pdf-export");
const samples = {
  ps: {
    name: "مریم احمد",
    role: "د کارن تجربې ډیزاینر",
    city: "کابل، افغانستان",
    summary:
      "زه د کارن تجربې ډیزاینر یم. د څېړنې او ګډ کار له لارې روښانه حلونه جوړوم.",
    skill: "څېړنه او ډیزاین",
    job: "د ډیزاین مشر",
    degree: "د کمپیوټر ساینس لېسانس",
  },
  fa: {
    name: "مریم احمد",
    role: "طراح تجربهٔ کاربری",
    city: "کابل، افغانستان",
    summary:
      "من طراح تجربهٔ کاربری هستم و با پژوهش و همکاری راه‌حل‌های روشن می‌سازم.",
    skill: "پژوهش و طراحی",
    job: "مدیر طراحی",
    degree: "کارشناسی علوم کامپیوتر",
  },
  mixed: {
    name: "Mariam Ahmad",
    role: "UX Designer / ډیزاینر",
    city: "Kabul / کابل، افغانستان",
    summary:
      "زه د UX Design او React په برخه کې کار کوم — Portfolio 2026. د کارن تجربې څېړنه زما مسلک دی.",
    skill: "UX Research / څېړنه",
    job: "Senior Designer / ډیزاینر",
    degree: "BSc Computer Science / لېسانس",
  },
};
const normalize = (s) =>
  s
    .normalize("NFKC")
    .replace(/[\s\u200c-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .toLowerCase();
async function check() {
  fs.mkdirSync(out, { recursive: true });
  const defs = e.load().sectionDefinitions,
    all = Object.entries(defs).map(([type, d]) => ({
      id: "export-" + type,
      type,
      items: structuredClone(d.sample),
    }));
  const ids = e
      .discover()
      .filter(
        (id) => !process.env.PDF_TEMPLATE || id === process.env.PDF_TEMPLATE,
      ),
    cases = [
      "sample",
      "all-sections",
      "edited",
      "long",
      "ps",
      "fa",
      "mixed",
    ].filter((c) => !process.env.PDF_CASE || c === process.env.PDF_CASE);
  const report = {
    date: new Date().toISOString(),
    strategy: "browser-print",
    templates: ids,
    scenarios: cases,
    results: [],
    failures: [],
    mobile: {
      verified: false,
      reason:
        "Physical Android Chrome and iOS Safari need user testing; see docs/pdf-mobile-tests.md.",
    },
  };
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
        viewport: { width: 1400, height: 1600 },
      }),
      print = await browser.newPage({
        viewport: { width: 1000, height: 1300 },
      });
    await page.route("https://**/*", (r) => r.abort());
    await print.route("https://**/*", (r) => r.abort());
    for (const id of ids) {
      const template = JSON.parse(
        fs.readFileSync(
          path.join(root, "public/templates", id, "template.json"),
        ),
      );
      await page.goto(base + "/render/" + id);
      await waitRender(page);
      for (const scenario of cases) {
        const result = { id, scenario, passed: false };
        let prepared = false;
        try {
          const record = structuredClone(template.sample);
          record._pdfScenario = scenario;
          record.optionalSections =
            scenario === "sample" ? [] : structuredClone(all);
          if (scenario === "edited") {
            record.name = "Amina Edited Profile";
            record.email = "amina.edited@example.com";
            record.summary =
              "Edited profile: I lead practical research and deliver clear, accessible digital services.";
            record.jobs[0].title = "Edited Design Lead";
            record.jobs[0].bullets = [
              "Delivered an accessible onboarding service for a growing team.",
              "Improved project handovers through clear documentation and shared reviews.",
            ];
          }
          if (scenario === "long") {
            const custom = record.optionalSections.find(
              (s) => s.type === "custom",
            );
            custom.items = Array.from({ length: 16 }, (_, i) => ({
              title: `Long content entry ${i + 1}`,
              body: "I collaborated with researchers, designers, and engineers to document practical outcomes and improve accessible services. ".repeat(
                7,
              ),
            }));
          }
          if (samples[scenario]) {
            const s = samples[scenario];
            Object.assign(record, {
              ...s,
              language: scenario === "fa" ? "fa" : "ps",
              direction: "rtl",
            });
            record.jobs = record.jobs.map((j, i) => ({
              ...j,
              title: s.job,
              organization:
                scenario === "fa"
                  ? "مؤسسهٔ خدمات دیجیتال"
                  : "د ډیجیټلي خدمتونو اداره",
              bullets: [s.summary, s.skill],
            }));
            record.education = record.education.map((d) => ({
              ...d,
              degree: s.degree,
              institution:
                scenario === "fa" ? "دانشگاه کابل" : "د کابل پوهنتون",
            }));
            record.skills = [s.skill, "React / ډیجیټلي خدمتونه"];
            const custom = record.optionalSections.find(
              (s) => s.type === "custom",
            );
            custom.title =
              scenario === "fa" ? "دیدگاه حرفه‌ای" : "مسلکي لیدلوری";
            custom.items = [{ title: "د کارن تجربې", body: s.summary }];
          }
          await page.evaluate((data) => {
            window.cvRender.ready = false;
            window.cvRender.setData(data);
          }, record);
          await waitRender(page);
          const screenCount = await page
            .locator(
              ".cv-render>.opt-sheet,.cv-render .a4-page,.cv-render .cv-page",
            )
            .count();
          const dir = path.join(out, id, scenario);
          fs.mkdirSync(dir, { recursive: true });
          await page
            .locator(".cv-render .a4-page,.cv-render .cv-page")
            .first()
            .screenshot({ path: path.join(dir, "preview.png") });
          const meta = await page.evaluate(
            async ({ template, data, definitions }) => {
              const { pdfExporter, suggestedPdfName } =
                await import("/src/pdf/PdfExporter.jsx");
              window.pdfPrepared = await pdfExporter.prepare({
                template,
                data,
                definitions,
              });
              const d = pdfPrepared.frame.contentDocument;
              return {
                html: "<!doctype html>" + d.documentElement.outerHTML,
                filename: pdfPrepared.filename,
                pages: pdfPrepared.sheetCount,
                scripts: d.scripts.length,
                editor: d.querySelectorAll(
                  "[data-bind],[contenteditable],button,input,textarea,.chat-panel,.editor-toolbar",
                ).length,
                fontStatus: d.fonts.status,
                counters: [...d.querySelectorAll(".cv-page-counter")]
                  .map((n) =>
                    n.textContent
                      .match(/(\d+)\s*\/\s*(\d+)\s*$/)
                      ?.slice(1)
                      .map(Number),
                  )
                  .filter(Boolean),
                fallbackName: suggestedPdfName(""),
              };
            },
            { template, data: record, definitions: defs },
          );
          prepared = true;
          assert.equal(meta.scripts, 0);
          assert.equal(meta.editor, 0);
          assert(!/\sdata-[\w-]+\s*=/.test(meta.html));
          assert.equal(meta.pages, screenCount);
          assert.deepEqual(
            meta.counters,
            Array.from({ length: screenCount }, (_, i) => [i + 1, screenCount]),
            "Printed page counters disagree with the sheets",
          );
          assert.equal(meta.fontStatus, "loaded");
          assert.equal(meta.fallbackName, "CV.pdf");
          assert(meta.filename.endsWith("_CV.pdf"));
          const htmlPath = path.join(dir, "print.html"),
            pdfPath = path.join(dir, meta.filename);
          fs.writeFileSync(htmlPath, meta.html);
          await print.route("**/__pdf_print.html", (r) =>
            r.fulfill({ contentType: "text/html", body: meta.html }),
          );
          await print.goto(base + "/__pdf_print.html");
          await print.evaluate(async () => {
            document.body.offsetHeight;
            await document.fonts.ready;
            await Promise.all([...document.images].map((i) => i.decode()));
          });
          const geometry = await print
            .locator(".a4-page,.cv-page,.opt-sheet")
            .evaluateAll((nodes) =>
              nodes.map((n) => {
                const r = n.getBoundingClientRect();
                return {
                  width: r.width,
                  height: r.height,
                  canvases: [...n.querySelectorAll(".original-layout")].map(
                    (e) => {
                      const b = e.getBoundingClientRect();
                      return { start: b.left - r.left, end: b.right - r.left };
                    },
                  ),
                  headings: [...n.querySelectorAll("h1")].flatMap((h) => {
                    const walker = document.createTreeWalker(
                        h,
                        NodeFilter.SHOW_TEXT,
                      ),
                      rects = [];
                    while (walker.nextNode()) {
                      if (!walker.currentNode.textContent.trim()) continue;
                      const range = document.createRange();
                      range.selectNodeContents(walker.currentNode);
                      rects.push(
                        ...[...range.getClientRects()].map((b) => ({
                          start: b.left - r.left,
                          end: b.right - r.left,
                        })),
                      );
                    }
                    return rects;
                  }),
                  entries: [...n.querySelectorAll(".opt-entry")].map((e) => ({
                    top: e.getBoundingClientRect().top - r.top,
                    bottom: e.getBoundingClientRect().bottom - r.top,
                  })),
                };
              }),
            );
          for (const g of geometry) {
            assert(Math.abs(g.width - 793.7) < 2);
            assert(Math.abs(g.height - 1122.5) < 2);
            assert(
              g.canvases.every((b) => b.start >= -2 && b.end <= g.width + 2),
              "Original canvas is horizontally clipped",
            );
            assert(
              g.headings.every((b) => b.start >= -4 && b.end <= g.width + 4),
              "Name heading is horizontally clipped",
            );
            assert(
              g.entries.every((v) => v.top >= 0 && v.bottom < 1080),
              "Clipped optional entry",
            );
          }
          const bytes = await print.pdf({
            path: pdfPath,
            preferCSSPageSize: true,
            printBackground: true,
            displayHeaderFooter: false,
            scale: 1,
          });
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"),
            task = pdfjs.getDocument({
              data: new Uint8Array(bytes),
              useSystemFonts: true,
            }),
            pdf = await task.promise;
          assert.equal(
            pdf.numPages,
            screenCount,
            `PDF ${pdf.numPages} vs screen ${screenCount}`,
          );
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i),
              v = p.getViewport({ scale: 1 });
            assert(Math.abs(v.width - 595.28) < 1);
            assert(Math.abs(v.height - 841.89) < 1);
            text +=
              " " +
              (await p.getTextContent()).items.map((i) => i.str).join(" ");
          }
          for (const value of [
            // PDF.js splits this font's Arabic presentation glyphs into visual
            // order. Check Pashto Unicode text with the native PDF reader below.
            ...(record.language === "ps" ? [] : [record.name]),
            record.email,
            ...(samples[scenario]
              ? []
              : record.jobs.flatMap((j) => [j.title, ...j.bullets])),
          ])
            assert(
              normalize(text).includes(normalize(value)),
              "Searchable text missing: " + value,
            );
          if (samples[scenario] && record.language !== "ps") {
            const words =
              scenario === "fa" ? ["پژوهش", "همکاری"] : ["تجربې", "څېړنه"];
            for (const word of words)
              assert(
                normalize(text).includes(normalize(word)),
                "Arabic search word missing: " + word,
              );
          }
          assert(!text.includes("YOUR PERSONAL EDITOR"));
          assert(!text.includes("Save answer"));
          assert(!text.includes("Change template"));
          await task.destroy?.();
          await print.unroute("**/__pdf_print.html");
          const first = print.locator(".a4-page,.cv-page,.opt-sheet").first();
          await first.screenshot({ path: path.join(dir, "screen.png") });
          result.passed = true;
          Object.assign(result, {
            pages: screenCount,
            filename: meta.filename,
            pdf: path.relative(root, pdfPath),
            html: path.relative(root, htmlPath),
            selectableText: true,
            noScriptsOrEditorAttributes: true,
            a4: true,
            screenPageCount: screenCount,
            language: record.language || "en",
            expectedArabic: !!samples[scenario],
            expectedName: record.name,
          });
        } catch (error) {
          result.error = error.message;
          report.failures.push({ id, scenario, error: error.message });
          console.error("FAIL", id, scenario, error.message);
          await print.unroute("**/__pdf_print.html").catch(() => {});
        } finally {
          if (prepared)
            await page
              .evaluate(() => window.pdfPrepared.dispose())
              .catch(() => {});
          report.results.push(result);
        }
      }
      console.log("PDF export checked", id);
    }
  });
  fs.writeFileSync(
    path.join(out, "audit-input.json"),
    JSON.stringify(report, null, 2),
  );
  execFileSync(
    "python",
    [
      path.join(__dirname, "inspect-export-pdfs.py"),
      path.join(out, "audit-input.json"),
    ],
    { stdio: "inherit" },
  );
  const inspected = JSON.parse(
    fs.readFileSync(path.join(out, "audit-input.json"), "utf8"),
  );
  inspected.passed = inspected.results.filter((r) => r.passed).length;
  inspected.failed = inspected.results.filter((r) => !r.passed).length;
  const auditPath = path.join(__dirname, "layout-audit.json"),
    old = fs.existsSync(auditPath)
      ? JSON.parse(fs.readFileSync(auditPath, "utf8"))
      : {};
  old.pdfExport = inspected;
  fs.writeFileSync(auditPath, JSON.stringify(old, null, 2) + "\n");
  fs.writeFileSync(
    path.join(__dirname, "pdf-export-audit.json"),
    JSON.stringify(inspected, null, 2) + "\n",
  );
  console.log(
    "PDF export summary",
    inspected.passed,
    "passed;",
    inspected.failed,
    "failed",
  );
  if (inspected.failed) process.exitCode = 1;
  return inspected;
}
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { check };
