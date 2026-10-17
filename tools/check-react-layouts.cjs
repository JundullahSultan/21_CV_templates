const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const e = require("./cv-engine.cjs"),
  { withRenderer, waitRender } = require("./build-app.cjs");
const root = path.resolve(__dirname, "..");
async function check() {
  const defs = e.load().sectionDefinitions,
    ids = e.discover(),
    report = {
      date: new Date().toISOString(),
      renderer: "src/renderer.jsx",
      templates: ids,
      results: [],
      failures: [],
    };
  const all = Object.entries(defs).map(([type, d]) => ({
    id: "test-" + type,
    type,
    items: structuredClone(d.sample),
  }));
  const cases = [
    { name: "baseline", sections: [] },
    { name: "edited-shared-data", sections: [] },
    ...all.map((s) => ({ name: s.type, sections: [s] })),
    { name: "all-sections", sections: all },
    { name: "empty", sections: all.map((s) => ({ ...s, items: [] })) },
    {
      name: "many-items",
      sections: [
        {
          ...all[0],
          items: Array.from({ length: 40 }, (_, i) => ({
            ...all[0].items[0],
            title: "Entry " + i,
            body: "Collaborated with colleagues to improve practical outcomes. ".repeat(
              16,
            ),
          })),
        },
      ],
    },
    ...["ps", "fa"].map((language) => ({
      name: "rtl-" + language,
      language,
      sections: all.map((s) => ({
        ...s,
        title: language === "ps" ? "مسلکي معلومات" : "اطلاعات حرفه‌ای",
      })),
    })),
  ];
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1400 },
    });
    await page.route("https://**/*", (r) => r.abort());
    for (const id of ids) {
      const template = JSON.parse(
        fs.readFileSync(
          path.join(root, "public/templates", id, "template.json"),
        ),
      );
      await page.goto(`${base}/render/${id}`);
      await waitRender(page);
      for (const c of cases.filter(
        (c) => !process.env.CV_SCENARIO || c.name === process.env.CV_SCENARIO,
      )) {
        try {
          const data = {
            ...template.sample,
            _renderVersion: id + c.name,
            optionalSections: c.sections,
            language: c.language || "en",
            direction: c.language ? "rtl" : "ltr",
          };
          if (c.name === "edited-shared-data") {
            Object.assign(data, {
              name: "Rana Shared Editor",
              phone: "+1 202 555 0999",
              email: "edited@example.com",
              city: "Kabul, Afghanistan",
              summary:
                "Edited professional summary for a collaborative leadership role.",
              skills: ["Edited research skill", "Edited planning skill"],
              jobs: template.sample.jobs.map((j, i) => ({
                ...j,
                title: "Edited role " + i,
                organization: "Edited organization " + i,
                dates: "2024 ? 2026",
                bullets: [
                  "Delivered a practical improvement with the team.",
                  "Improved documentation and customer communication.",
                ],
              })),
              education: template.sample.education.map((d, i) => ({
                ...d,
                degree: "Edited degree " + i,
                institution: "Edited institution " + i,
                year: "2024",
              })),
            });
          }
          await page.evaluate((data) => {
            window.cvRender.ready = false;
            window.cvRender.setData(data);
          }, data);
          await waitRender(page);
          assert.equal(await page.locator(".layout-error").count(), 0);
          if (c.name === "edited-shared-data") {
            const text = (await page.locator(".cv-render").textContent())
              .replace(/\s/g, "")
              .toLowerCase();
            for (const value of [
              data.name,
              data.phone,
              data.email,
              data.city,
              data.summary,
              ...data.skills,
              ...data.jobs.map((j) => j.title),
              ...data.education.map((d) => d.degree),
            ])
              assert(
                text.includes(value.replace(/\s/g, "").toLowerCase()),
                "Missing edited field: " + value,
              );
          }
          const geometry = await page
            .locator(
              ".cv-render>.opt-sheet,.cv-render .a4-page,.cv-render .cv-page",
            )
            .evaluateAll((nodes) =>
              nodes.map((n) => {
                const r = n.getBoundingClientRect();
                return {
                  w: r.width,
                  h: r.height,
                  overflow: n.scrollHeight > n.clientHeight + 2,
                  entries: [...n.querySelectorAll(".opt-entry")].map(
                    (e) => e.getBoundingClientRect().bottom - r.top,
                  ),
                };
              }),
            );
          for (const g of geometry) {
            assert(Math.abs(g.w - 793.7) < 2, `width ${g.w}`);
            assert(Math.abs(g.h - 1122.5) < 2, `height ${g.h}`);
            assert(
              g.entries.every((b) => b < 1080),
              "entry exceeds printable area",
            );
          }
          const expected = c.sections.filter(
            (s) => s.items.length && s.enabled !== false,
          ).length;
          const emitted = await page
            .locator(".cv-render>[data-continuation] [data-optional-section]")
            .evaluateAll(
              (nodes) =>
                new Set(nodes.map((n) => n.dataset.optionalSection)).size,
            );
          assert.equal(emitted, expected);
          if (
            [
              "baseline",
              "all-sections",
              "many-items",
              "rtl-ps",
              "rtl-fa",
            ].includes(c.name)
          ) {
            const pdf = await page.pdf({
              preferCSSPageSize: true,
              printBackground: true,
            });
            const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
            const task = pdfjs.getDocument({
              data: new Uint8Array(pdf),
              useSystemFonts: true,
            });
            const doc = await task.promise;
            assert.equal(
              doc.numPages,
              geometry.length,
              `PDF ${doc.numPages} vs DOM ${geometry.length}`,
            );
            let text = "";
            for (let i = 1; i <= doc.numPages; i++)
              text += (await (await doc.getPage(i)).getTextContent()).items
                .map((x) => x.str)
                .join(" ");
            assert(
              text
                .replace(/\s/g, "")
                .toLowerCase()
                .includes(
                  template.sample.name.replace(/\s/g, "").toLowerCase(),
                ),
              "selectable name missing from PDF",
            );
            await task.destroy?.();
          }
          report.results.push({
            id,
            scenario: c.name,
            passed: true,
            pages: geometry.length,
          });
        } catch (err) {
          report.failures.push({ id, scenario: c.name, error: err.message });
          report.results.push({
            id,
            scenario: c.name,
            passed: false,
            error: err.message,
          });
          console.error("FAIL", id, c.name, err.message);
        }
      }
      console.log(`React layouts ${id} checked`);
    }
  });
  if (
    process.env.CV_SCENARIO &&
    fs.existsSync(path.join(root, "tools/react-layout-audit.json"))
  ) {
    const previous = JSON.parse(
      fs.readFileSync(path.join(root, "tools/react-layout-audit.json"), "utf8"),
    );
    const keys = new Set(report.results.map((r) => r.id + ":" + r.scenario));
    report.results = [
      ...previous.results.filter(
        (r) => ids.includes(r.id) && !keys.has(r.id + ":" + r.scenario),
      ),
      ...report.results,
    ];
    report.failures = report.results.filter((r) => !r.passed);
  }
  report.passed = report.results.filter((r) => r.passed).length;
  report.failed = report.failures.length;
  fs.writeFileSync(
    path.join(root, "tools/react-layout-audit.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "tools/layout-audit.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (report.failed) process.exitCode = 1;
  return report;
}
if (require.main === module)
  check().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
module.exports = { check };
