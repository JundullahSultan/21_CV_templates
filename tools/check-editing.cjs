const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const engine = require("./cv-engine.cjs");
const { withRenderer } = require("./build-app.cjs");
async function check() {
  const report = {
    date: new Date().toISOString(),
    mode: "chat forms with read-only CV preview",
    templates: engine.discover(),
    checks: [],
    failures: [],
  };
  const test = async (name, fn) => {
    try {
      await fn();
      report.checks.push({ name, passed: true });
      console.log("PASS", name);
    } catch (e) {
      report.checks.push({ name, passed: false, error: e.message });
      report.failures.push({ name, error: e.message });
      console.error("FAIL", name, e.message);
    }
  };
  await withRenderer(async (browser, base) => {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const id of report.templates)
      await test(`${id}: preview clicks do not edit; Edit CV saves through chat`, async () => {
        await page.goto(base);
        await page.evaluate(() => localStorage.clear());
        await page.goto(`${base}/edit/${id}`);
        await page.waitForSelector(".cv-render");
        await page.evaluate(() => document.fonts.ready);
        assert(await page.locator(".chat-panel").isVisible());
        assert.equal(
          await page
            .locator(
              ".preview-panel [data-field],.preview-panel [contenteditable],.edit-stage,.field-dialog,.chat-scrim",
            )
            .count(),
          0,
        );
        const title = page.locator(".cv-render h1").first();
        await title.scrollIntoViewIfNeeded();
        const rect = await title.boundingBox();
        await page.mouse.click(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        assert.equal(
          await page
            .locator(".preview-panel [contenteditable],.field-dialog")
            .count(),
          0,
        );
        assert.equal(await page.locator("#answer").count(), 0);
        await page
          .getByRole("button", { name: "Edit CV", exact: true })
          .click();
        await page.locator("#answer").fill(`Chat Profile ${id}`);
        await page
          .getByRole("button", { name: "Save answer", exact: false })
          .click();
        await page.waitForFunction(
          (name) =>
            JSON.parse(localStorage.getItem("cv-studio-v3")).data.name === name,
          `Chat Profile ${id}`,
        );
        assert(
          (await page.locator(".cv-render").textContent())
            .replace(/\s/g, "")
            .includes(`ChatProfile${id}`),
        );
        assert.equal(
          await page
            .locator(".editor")
            .evaluate((el) => getComputedStyle(el).display),
          "grid",
        );
      });
    await test("Phone uses Chat / Preview tabs and Edit CV returns to form, never a bottom sheet", async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${base}/edit/${report.templates[0]}`);
      await page.waitForSelector(".cv-render", { state: "attached" });
      assert(await page.locator(".chat-panel").isVisible());
      await page.getByRole("tab", { name: "Preview", exact: true }).click();
      assert(!(await page.locator(".chat-panel").isVisible()));
      assert(await page.locator(".preview-panel").isVisible());
      const title = page.locator(".cv-render h1").first();
      await title.scrollIntoViewIfNeeded();
      const r = await title.boundingBox();
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      assert.equal(
        await page.locator("[contenteditable],.field-dialog").count(),
        0,
      );
      await page.getByRole("button", { name: "Edit CV", exact: true }).click();
      assert(await page.locator("#answer").isVisible());
      await page.locator("#answer").fill("Mobile Chat Profile");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("cv-studio-v3")).data.name,
        ),
        "Mobile Chat Profile",
      );
    });
    await test("Saved CV values and previous template text edits survive the UI rollback", async () => {
      const id = report.templates.at(-1),
        template = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../public/templates", id, "template.json"),
            "utf8",
          ),
        );
      const data = structuredClone(template.sample),
        [field] = Object.keys(template.editableDefaults || {});
      assert(field);
      let target = data;
      const keys = field.split(".");
      for (const key of keys.slice(0, -1)) target = target[key] ||= {};
      target[keys.at(-1)] = "Previously saved heading";
      data.name = "Preserved Profile";
      await page.evaluate(
        (data) =>
          localStorage.setItem(
            "cv-studio-v3",
            JSON.stringify({ data, language: "en" }),
          ),
        data,
      );
      await page.goto(`${base}/edit/${id}`);
      await page.waitForSelector(".cv-render", { state: "attached" });
      assert(
        (await page.locator(".cv-render").textContent()).includes(
          "Previously saved heading",
        ),
      );
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("cv-studio-v3")).data.name,
        ),
        "Preserved Profile",
      );
    });
    await test("No browser errors", () => assert.deepEqual(errors, []));
    await page.close();
  });
  report.passed = report.checks.filter((c) => c.passed).length;
  report.failed = report.failures.length;
  fs.writeFileSync(
    path.join(__dirname, "editing-audit.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const file = path.join(__dirname, "layout-audit.json"),
    audit = JSON.parse(fs.readFileSync(file, "utf8"));
  delete audit.clickToEdit;
  audit.editing = report;
  fs.writeFileSync(file, JSON.stringify(audit, null, 2) + "\n");
  if (report.failed) process.exitCode = 1;
}
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { check };
