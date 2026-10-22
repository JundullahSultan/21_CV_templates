const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const engine = require("./cv-engine.cjs");
const { withRenderer } = require("./build-app.cjs");

async function check() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const print = await browser.newPage();
    const output = path.resolve(__dirname, "../test-results/photos");
    fs.mkdirSync(output, { recursive: true });
    for (const id of engine.discover()) {
      await page.goto(base);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${base}/edit/${id}`);
      const button = page.getByRole("button", { name: "Replace picture" });
      await button.click();
      // A corrupt upload must leave the form available for retry.
      await page
        .locator("#answer")
        .setInputFiles({
          name: "bad.png",
          mimeType: "image/png",
          buffer: Buffer.from("invalid"),
        });
      await page
        .getByRole("status")
        .filter({ hasText: "could not be opened" })
        .waitFor();
      await page
        .locator("#answer")
        .setInputFiles(path.resolve(__dirname, "sample-signature.png"));
      await page.waitForFunction(() =>
        JSON.parse(
          localStorage.getItem("cv-studio-v3"),
        )?.data.photo?.startsWith("data:image/png"),
      );
      await page.reload();
      const photo = page
        .locator(".cv-render > :not(.cv-measure) img[data-cv-photo]")
        .first();
      await photo.waitFor();
      await photo.evaluate((image) => image.decode());
      const photoSrc = await photo.getAttribute("src");
      assert(photoSrc.startsWith("data:image/png"));
      const meta = await page.evaluate(async (id) => {
        const template = await fetch(`/templates/${id}/template.json`).then(
          (r) => r.json(),
        );
        const definitions = await fetch("/sections.json").then((r) => r.json());
        const data = JSON.parse(localStorage.getItem("cv-studio-v3")).data;
        const { pdfExporter } = await import("/src/pdf/PdfExporter.jsx");
        window.prepared = await pdfExporter.prepare({
          template,
          data,
          definitions,
        });
        const doc = prepared.frame.contentDocument;
        const image = [...doc.images].find((i) => i.src === data.photo);
        if (!image || !image.naturalWidth)
          throw Error("Uploaded photo missing from print document");
        const rect = image.getBoundingClientRect();
        const sheet = image
          .closest(".a4-page,.cv-page")
          .getBoundingClientRect();
        if (!(
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= sheet.left - 1 &&
          rect.right <= sheet.right + 1 &&
          rect.top >= sheet.top - 1 &&
          rect.bottom <= sheet.bottom + 1
        ))
          throw Error("Photo is outside its page");
        return {
          html: "<!doctype html>" + doc.documentElement.outerHTML,
          pages: prepared.sheetCount,
        };
      }, id);
      await print.route("**/__photo_print.html", (r) =>
        r.fulfill({ contentType: "text/html", body: meta.html }),
      );
      await print.goto(`${base}/__photo_print.html`);
      await print.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.decode()));
      });
      const bytes = await print.pdf({
        path: path.join(output, `${id}.pdf`),
        preferCSSPageSize: true,
        printBackground: true,
      });
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(bytes),
        useSystemFonts: true,
      }).promise;
      assert.equal(pdf.numPages, meta.pages);
      const ops = await (await pdf.getPage(1)).getOperatorList();
      assert(
        ops.fnArray.some((op) =>
          [
            pdfjs.OPS.paintImageXObject,
            pdfjs.OPS.paintInlineImageXObject,
          ].includes(op),
        ),
        "PDF contains no photo image",
      );
      await pdf.cleanup();
      await page.evaluate(() => prepared.dispose());
      await print.unroute("**/__photo_print.html");
      console.log(
        `PASS ${id}: upload validation, saved photo, print bounds and PDF image`,
      );
    }
  });
}
check().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
