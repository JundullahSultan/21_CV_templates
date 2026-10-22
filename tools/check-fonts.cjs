const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const engine = require("./cv-engine.cjs");
const { withRenderer } = require("./build-app.cjs");
const root = path.resolve(__dirname, "..");

async function check() {
  const ids = engine.discover();
  for (const directory of ["public/fonts", ...ids.map((id) => `${id}/fonts`)]) {
    const css = fs.readFileSync(
      path.join(root, directory, "fonts.css"),
      "utf8",
    );
    const used = new Set(
      [...css.matchAll(/url\(['"]?([^)'"\s]+\.ttf)/g)].map((m) =>
        path.basename(m[1]),
      ),
    );
    for (const name of used)
      assert(
        fs.existsSync(path.join(root, directory, name)),
        `Missing ${directory}/${name}`,
      );
    for (const name of fs
      .readdirSync(path.join(root, directory))
      .filter((name) => /\.(ttf|woff2?|otf)$/i.test(name))) {
      assert(used.has(name), `Unused font: ${directory}/${name}`);
    }
  }
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
    });
    const missing = [];
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        /\.(ttf|woff2?|css)(?:\?|$)/.test(response.url())
      )
        missing.push(response.url());
    });
    await page.goto(base);
    await page
      .getByRole("combobox", { name: "App language" })
      .selectOption("ps");
    await page.waitForFunction(() => document.documentElement.lang === "ps");
    assert(
      (
        await page
          .locator(".app-header")
          .evaluate((el) => getComputedStyle(el).fontFamily)
      ).includes("CV Pashto"),
    );
    await page.evaluate(() =>
      document.fonts.load('16px "CV Pashto"', "پښتو ژبه"),
    );
    assert(
      await page.evaluate(() =>
        [...document.fonts].some(
          (f) => f.family.includes("CV Pashto") && f.status === "loaded",
        ),
      ),
    );
    for (const id of ids) {
      await page.goto(`${base}/edit/${id}`);
      await page.waitForSelector(".cv-render h1");
      await page.evaluate(() => document.fonts.ready);
      const checkDirection = async (language) => {
        assert.equal(
          await page
            .locator(".chat-panel")
            .evaluate((el) => getComputedStyle(el).direction),
          "rtl",
          `${id}: ${language} editor must be RTL`,
        );
        assert.equal(
          await page.locator(".cv-render").getAttribute("dir"),
          "ltr",
          `${id}: ${language} must not mirror the CV`,
        );
        assert.equal(
          await page
            .locator(".cv-render h1")
            .first()
            .evaluate((el) => getComputedStyle(el).direction),
          "ltr",
        );
        // Capture the actual Download PDF request without opening an OS dialog.
        await page.evaluate(async () => {
          const { pdfExporter } = await import("/src/pdf/PdfExporter.jsx");
          pdfExporter.export = async (request) => {
            window.directionPrepared = await pdfExporter.prepare(request);
          };
        });
        await page.locator(".editor-toolbar button").last().click();
        await page.waitForFunction(() => !!window.directionPrepared);
        assert.equal(
          await page.evaluate(
            () => directionPrepared.frame.contentDocument.documentElement.dir,
          ),
          "ltr",
        );
        assert.equal(
          await page.evaluate(
            () =>
              directionPrepared.frame.contentDocument.querySelector(
                ".cv-render",
              ).dir,
          ),
          "ltr",
        );
        await page.evaluate(() => {
          directionPrepared.dispose();
          delete window.directionPrepared;
        });
      };
      await checkDirection("ps");
      assert(
        (
          await page
            .locator(".cv-render h1")
            .first()
            .evaluate((el) => getComputedStyle(el).fontFamily)
        ).includes("CV Pashto"),
        `${id}: wrong Pashto font`,
      );
      await page
        .getByRole("combobox", { name: "App language" })
        .selectOption("fa");
      await page.waitForFunction(() => document.documentElement.lang === "fa");
      await checkDirection("fa");
      assert(
        (
          await page
            .locator(".cv-render h1")
            .first()
            .evaluate((el) => getComputedStyle(el).fontFamily)
        ).includes("CV Arabic"),
        `${id}: Dari font changed`,
      );
      await page
        .getByRole("combobox", { name: "App language" })
        .selectOption("en");
      await page.waitForFunction(() => document.documentElement.lang === "en");
      assert(
        !(
          await page
            .locator(".cv-render h1")
            .first()
            .evaluate((el) => getComputedStyle(el).fontFamily)
        ).includes("CV Pashto"),
        `${id}: Pashto font persisted in English`,
      );
      await page
        .getByRole("combobox", { name: "App language" })
        .selectOption("ps");
      await page.waitForFunction(() => document.documentElement.lang === "ps");
      console.log(
        `PASS ${id}: language fonts, RTL editor, LTR CV preview and PDF`,
      );
    }
    assert.deepEqual(missing, [], "Font or stylesheet requests failed");
  });
  console.log("PASS: every bundled font exists and is referenced");
}
check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
