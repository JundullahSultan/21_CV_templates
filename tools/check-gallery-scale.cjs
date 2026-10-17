const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const e = require("./cv-engine.cjs"),
  { renderAssets } = require("./build-app.cjs"),
  { staticServer } = require("./check-app.cjs");
const root = path.resolve(__dirname, "..");
async function check() {
  const found = e.discover(),
    added = [],
    originalManifest = fs.readFileSync(path.join(root, "public/manifest.json"));
  const count = Math.max(1, 32 - found.length),
    report = {
      date: new Date().toISOString(),
      initialTemplates: found.length,
      fixtureTemplates: found.length + count,
    };
  let server, browser;
  try {
    for (let i = 1; i <= count; i++) {
      const id = String(Math.max(...found.map(Number)) + 1000 + i);
      const dir = path.join(root, id);
      assert(!fs.existsSync(dir));
      fs.mkdirSync(dir);
      added.push(id);
      for (const file of fs.readdirSync(path.join(root, found[0])))
        if (!["index.html", "theme.json"].includes(file))
          fs.cpSync(path.join(root, found[0], file), path.join(dir, file), {
            recursive: true,
          });
      fs.copyFileSync(
        path.join(root, "tools/layout-sources", found[0] + ".html"),
        path.join(dir, "index.html"),
      );
    }
    const manifest = await renderAssets({ selected: added });
    assert.deepEqual(
      manifest.map((m) => m.id),
      e.discover(),
    );
    process.env.NODE_ENV = "production";
    await (await import("vite")).build({ root, logLevel: "error" });
    server = staticServer(path.join(root, "dist"));
    await new Promise((r) => server.listen(5191, "127.0.0.1", r));
    browser = await e.playwright().chromium.launch(e.browserOptions());
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 90000,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    const start = Date.now();
    await page.goto("http://127.0.0.1:5191/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-template-card]");
    report.firstGalleryRenderMs = Date.now() - start;
    assert.equal(
      await page.locator("[data-template-card]").count(),
      found.length + count,
    );
    assert.equal(await page.locator(".cv-render,iframe").count(), 0);
    assert(!requests.some((url) => /template\.json|template\.css/.test(url)));
    assert(
      report.firstGalleryRenderMs < 12000,
      `Gallery took ${report.firstGalleryRenderMs}ms`,
    );
    report.throttle = {
      cpu: 4,
      latencyMs: 150,
      downloadBytesPerSecond: 200000,
    };
    report.requestsBeforeFirstRender = requests.length;
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page
      .locator(`[data-template-card="${added[0] || found[0]}"]`)
      .click();
    await page.waitForSelector(`.tpl-${added[0] || found[0]}`, {
      state: "attached",
    });
    report.futureTemplateWithoutAppChanges = true;
    report.passed = true;
  } catch (err) {
    report.passed = false;
    report.error = err.message;
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
    for (const id of added) {
      for (const target of [
        path.join(root, id),
        path.join(root, "public/templates", id),
        path.join(root, "dist/templates", id),
      ]) {
        const absolute = path.resolve(target);
        assert(absolute.startsWith(root + path.sep));
        if (fs.existsSync(absolute)) fs.rmSync(absolute, { recursive: true });
      }
      for (const file of [
        path.join(root, "tools/layout-sources", id + ".html"),
        path.join(root, "public/thumbnails", id + ".webp"),
        path.join(root, "dist/thumbnails", id + ".webp"),
      ])
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.writeFileSync(path.join(root, "public/manifest.json"), originalManifest);
    fs.writeFileSync(path.join(root, "dist/manifest.json"), originalManifest);
    fs.writeFileSync(
      path.join(root, "tools/gallery-scale-audit.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  console.log(report);
  return report;
}
if (require.main === module)
  check().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
