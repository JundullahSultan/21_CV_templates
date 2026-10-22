const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const engine = require("./cv-engine.cjs");
const { withRenderer } = require("./build-app.cjs");
const root = path.resolve(__dirname, "..");
const get = (data, key) =>
  key.split(".").reduce((value, part) => value?.[part], data);

function assertCoverage(template) {
  const walk = (node, covered = false) => {
    if (typeof node === "string") {
      assert(
        covered || !/[\p{L}\p{N}]/u.test(node),
        `${template.id}: content has no editing control: ${node.trim()}`,
      );
      return;
    }
    if (!node.tag) return;
    const attrs = node.attrs || {};
    covered =
      covered ||
      attrs["aria-hidden"] === "true" ||
      node.tag === "svg" ||
      attrs["data-bind"] ||
      attrs["data-edit-path"] ||
      attrs["data-list-bind"] ||
      attrs["data-skills-original"] ||
      attrs["data-value-path"] ||
      /\b(page-footer|cv-page-footer|opt-running|opt-footer)\b/.test(
        attrs.class || "",
      );
    for (const child of node.children || []) walk(child, covered);
  };
  template.tree.forEach((node) => walk(node));
}

async function check() {
  const results = [];
  const output = path.join(root, "test-results/sections");
  fs.mkdirSync(output, { recursive: true });
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });
    const print = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const id of engine.discover()) {
      const template = JSON.parse(
        fs.readFileSync(
          path.join(root, "public/templates", id, "template.json"),
        ),
      );
      const fields = template.editableFields;
      assertCoverage(template);
      assert(fields.length > 0, `${id}: no editable fields`);
      await page.goto(base);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${base}/edit/${id}`);
      await page.waitForSelector(".cv-render");
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator(".cv-render .a4-page,.cv-render .cv-page")
        .first()
        .screenshot({ path: path.join(output, `${id}-before.png`) });
      assert.equal(
        await page.locator("[data-template-field]").count(),
        fields.length,
      );
      await page
        .locator(".template-section")
        .evaluateAll((nodes) => nodes.forEach((node) => (node.open = true)));
      let index = 0;
      for (const field of fields) {
        const marker = `X${String(index++).padStart(3, "0")}Z`;
        const expected =
          field.kind === "number"
            ? Math.min(field.max, Math.max(field.min, 37))
            : field.kind === "url" || field.path === "portfolio"
              ? `https://example.com/${id}/${marker}`
              : field.kind === "lines"
                ? Array.from(
                    { length: Math.max(2, field.defaultValue?.length || 0) },
                    (_, n) => `${marker}${n}`,
                  )
                : marker;
        const control = page.locator(`[data-template-field="${field.path}"]`);
        await control.evaluate((button) => button.click());
        await page
          .locator("#answer")
          .fill(
            Array.isArray(expected) ? expected.join("\n") : String(expected),
          );
        await page.locator('.question button[type="submit"]').click();
        await page.waitForFunction(
          ({ key, value }) => {
            const record = JSON.parse(
              localStorage.getItem("cv-studio-v3"),
            ).data;
            const saved = key.split(".").reduce((v, part) => v?.[part], record);
            return JSON.stringify(saved) === JSON.stringify(value);
          },
          { key: field.path, value: expected },
        );
        const applied = await page.locator(".cv-render").evaluate(
          (render, { field, expected }) => {
            const clone = render.cloneNode(true);
            clone
              .querySelectorAll(".cv-measure")
              .forEach((node) => node.remove());
            if (field.kind === "url")
              return [...clone.querySelectorAll("a")].some(
                (a) => a.getAttribute("href") === expected,
              );
            if (field.kind === "number")
              return [...clone.querySelectorAll("[data-value-path]")].some(
                (node) =>
                  node.dataset.valuePath === field.path &&
                  (node.dataset.levelStyle
                    ? node.style.getPropertyValue("--level") === `${expected}%`
                    : node.getAttribute("value") === String(expected)),
              );
            const values = Array.isArray(expected) ? expected : [expected];
            return values.every((value) => clone.textContent.includes(value));
          },
          { field, expected },
        );
        assert(applied, `${id}: ${field.path} saved but did not update the CV`);
      }
      await page.reload();
      await page.waitForSelector(".cv-render");
      const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem("cv-studio-v3")).data,
      );
      for (const field of fields)
        assert.notEqual(get(saved, field.path), undefined);
      const meta = await page.evaluate(async (id) => {
        const template = await fetch(`/templates/${id}/template.json`).then(
          (r) => r.json(),
        );
        const definitions = await fetch("/sections.json").then((r) => r.json());
        const data = {
          ...JSON.parse(localStorage.getItem("cv-studio-v3")).data,
          language: "en",
          direction: "ltr",
        };
        const { pdfExporter, cleanSnapshot } =
          await import("/src/pdf/PdfExporter.jsx");
        window.sectionPrepared = await pdfExporter.prepare({
          template,
          data,
          definitions,
        });
        const document = sectionPrepared.frame.contentDocument;
        const printed = document.querySelector(".cv-render");
        if (
          cleanSnapshot(window.document.querySelector(".cv-render"))
            .textContent !== printed.textContent
        )
          throw Error("PDF content differs from edited preview");
        return {
          html: "<!doctype html>" + document.documentElement.outerHTML,
          pages: sectionPrepared.sheetCount,
        };
      }, id);
      await print.route("**/__section_print.html", (route) =>
        route.fulfill({ contentType: "text/html", body: meta.html }),
      );
      await print.goto(`${base}/__section_print.html`);
      await print.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await print.pdf({
        path: path.join(output, `${id}-edited.pdf`),
        preferCSSPageSize: true,
        printBackground: true,
      });
      await page
        .locator(".cv-render .a4-page,.cv-render .cv-page")
        .first()
        .screenshot({ path: path.join(output, `${id}-after.png`) });
      await page.evaluate(() => sectionPrepared.dispose());
      await print.unroute("**/__section_print.html");
      results.push({
        id,
        fields: fields.length,
        groups: new Set(fields.map((field) => field.group)).size,
        pdfPages: meta.pages,
        passed: true,
      });
      console.log(
        `PASS ${id}: ${fields.length} fields edited through forms, persisted and exported`,
      );
    }
    assert.deepEqual(errors, []);
  });
  fs.writeFileSync(
    path.join(output, "audit.json"),
    JSON.stringify(results, null, 2),
  );
}
if (require.main === module)
  check().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { check, assertCoverage };
