const fs = require("fs");
const path = require("path");
const engine = require("./cv-engine.cjs");
const { compile } = require("./compile-templates.cjs");
const root = path.resolve(__dirname, "..");
async function withRenderer(action) {
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    server: { port: 5187, strictPort: true, hmr: false },
    logLevel: "error",
  });
  await server.listen();
  const browser = await engine
    .playwright()
    .chromium.launch(engine.browserOptions());
  try {
    return await action(browser, "http://127.0.0.1:5187");
  } finally {
    await browser.close();
    await server.close();
  }
}
async function waitRender(page) {
  await page.waitForFunction(() => window.cvRender?.ready === true, {
    timeout: 30000,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
  if (await page.locator(".layout-error").count()) {
    throw new Error(await page.locator(".layout-error").textContent());
  }
}
async function renderAssets({ exportHTML = false, selected = [] } = {}) {
  const manifest = await compile();
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 1300 },
      deviceScaleFactor: 1,
    });
    await page.route("https://**/*", (r) => r.abort());
    fs.mkdirSync(path.join(root, "public/thumbnails"), { recursive: true });
    for (const m of manifest.filter(
      (m) => !selected.length || selected.includes(m.id),
    )) {
      await page.goto(`${base}/render/${m.id}`);
      await waitRender(page);
      const first = page
        .locator(".cv-render .a4-page,.cv-render .cv-page")
        .first();
      const png = await first.screenshot({ type: "png" });
      const webp = await page.evaluate(async (b64) => {
        const image = new Image();
        image.src = "data:image/png;base64," + b64;
        await image.decode();
        const c = document.createElement("canvas");
        c.width = 280;
        c.height = 396;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 280, 396);
        ctx.drawImage(image, 0, 0, 280, 396);
        return c.toDataURL("image/webp", 0.72).split(",")[1];
      }, png.toString("base64"));
      fs.writeFileSync(
        path.join(root, "public/thumbnails", `${m.id}.webp`),
        Buffer.from(webp, "base64"),
      );
      m.pageCount = await page
        .locator(
          ".cv-render>.opt-sheet,.cv-render .a4-page,.cv-render .cv-page",
        )
        .count();
      if (exportHTML) {
        const fontDir = path.join(root, m.id, "fonts");
        fs.cpSync(path.join(root, "public/fonts"), fontDir, {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(fontDir, "fonts.css"),
          fs
            .readFileSync(path.join(root, "public/fonts/fonts.css"), "utf8")
            .replaceAll("/fonts/", ""),
        );
        fs.writeFileSync(
          path.join(fontDir, ".cv-studio-font-bundle"),
          "Generated shared font assets.\n",
        );
        let html = await page.locator(".cv-render").evaluate(async (e) => {
          const { cleanSnapshot } = await import("/src/pdf/PdfExporter.jsx");
          return cleanSnapshot(e).outerHTML;
        });
        html = html.replaceAll(`/templates/${m.id}/`, "");
        let css = fs
          .readFileSync(
            path.join(root, "public/templates", m.id, "template.css"),
            "utf8",
          )
          .replaceAll(`/templates/${m.id}/`, "");
        css +=
          "\n" +
          fs.readFileSync(path.join(root, "src/document.css"), "utf8") +
          "\n@media screen and (max-width:820px){.cv-render{zoom:calc((100vw - 8px)/794px)}}";
        fs.writeFileSync(path.join(root, m.id, "react.css"), css);
        fs.writeFileSync(
          path.join(root, m.id, "index.html"),
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${m.displayName.replace(/[<>&"]/g, "")} — CV</title><link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="react.css"></head><body>${html}</body></html>`,
        );
      }
      console.log(
        `${m.id}: thumbnail ${Math.round(Buffer.from(webp, "base64").length / 1024)} KB; ${m.pageCount} pages${exportHTML ? "; static HTML exported" : ""}`,
      );
    }
  });
  fs.writeFileSync(
    path.join(root, "public/manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return manifest;
}
async function build() {
  await renderAssets();
  process.env.NODE_ENV = "production";
  const { build } = await import("vite");
  await build({ root });
}
if (require.main === module)
  build().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { build, renderAssets, withRenderer, waitRender };
