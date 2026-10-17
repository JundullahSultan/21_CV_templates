const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const engine = require("./cv-engine.cjs");
const { withRenderer } = require("./build-app.cjs");
const root = path.resolve(__dirname, "..");
async function check() {
  const report = {
    date: new Date().toISOString(),
    templates: engine.discover(),
    checks: [],
    failures: [],
    unverified: [
      "Physical Pashto keyboard / OS input method and caret selection on real Android and iOS devices.",
    ],
  };
  const test = async (name, fn) => {
    try {
      const details = await fn();
      report.checks.push({ name, passed: true, ...details });
      console.log("PASS", name);
    } catch (e) {
      report.checks.push({ name, passed: false, error: e.message });
      report.failures.push({ name, error: e.message });
      console.error("FAIL", name, e.message);
    }
  };
  await withRenderer(async (browser, base) => {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const field = (p, path) =>
      p.locator(`.edit-stage [data-field="${path}"]:visible`).first();
    const stored = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("cv-studio-v3")).data,
      );
    async function open(id, record) {
      await page.goto(base);
      await page.evaluate((record) => {
        localStorage.clear();
        if (record)
          localStorage.setItem(
            "cv-studio-v3",
            JSON.stringify({ data: record, language: "en" }),
          );
      }, record);
      await page.goto(`${base}/edit/${id}`);
      await page.waitForSelector('.edit-stage [data-field="name"]');
      await page.evaluate(() => document.fonts.ready);
    }
    async function edit(path, value) {
      const el = field(page, path);
      await el.click();
      assert.equal(await el.getAttribute("contenteditable"), "true");
      await el.fill(value);
      await el.press("Enter");
      await page.waitForTimeout(100);
    }
    for (const id of report.templates)
      await test(`${id}: desktop always edits in place; mapped content saves`, async () => {
        await open(id);
        assert.equal(
          await page
            .getByRole("button", { name: "Edit CV", exact: true })
            .count(),
          0,
        );
        const required = [
          "name",
          "summary",
          "phone",
          "email",
          "city",
          "jobs.0.title",
          "jobs.0.organization",
          "jobs.0.dates",
          "jobs.0.bullets.0",
          "education.0.degree",
          "education.0.institution",
          "education.0.year",
          "skills.0",
        ];
        for (const p of required)
          assert(await field(page, p).count(), `Missing ${p}`);
        await edit("name", `Inline Profile ${id}`);
        assert.equal((await stored()).name, `Inline Profile ${id}`);
        await edit("jobs.0.title", `Design Lead ${id}`);
        assert.equal((await stored()).jobs[0].title, `Design Lead ${id}`);
        assert.equal(await field(page, "name").getAttribute("dir"), "auto");
        const proof = await page.evaluate(async (id) => {
          const { pdfExporter } = await import("/src/pdf/PdfExporter.jsx");
          const prepared = await pdfExporter.prepare({
            template: await (
              await fetch(`/templates/${id}/template.json`)
            ).json(),
            data: JSON.parse(localStorage.getItem("cv-studio-v3")).data,
            definitions: await (await fetch("/sections.json")).json(),
          });
          const doc = prepared.frame.contentDocument,
            result = {
              traces: doc.querySelectorAll(
                'script,[data-field],[data-edit-active],[data-caret-guard],[contenteditable],[role="textbox"],.edit-stage,.field-dialog',
              ).length,
              styles: [...doc.querySelectorAll("link")].map((n) => n.href),
              text: doc.body.textContent,
            };
          prepared.dispose();
          return result;
        }, id);
        assert.equal(proof.traces, 0);
        assert(proof.styles.every((s) => !s.includes("editing.css")));
        assert(proof.text.replace(/\s+/g, "").includes(`InlineProfile${id}`));
        assert(proof.text.includes(`Design Lead ${id}`));
      });
    await open(report.templates.at(-1));
    await test("Preview is centered at 86% at 375, 768, 1100, 1440, 1920px; true A4 dimensions do not change", async () => {
      for (const width of [375, 768, 1100, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(100);
        const m = await page.locator(".edit-stage").evaluate((el) => {
          const r = el.getBoundingClientRect(),
            s = el.querySelector(".a4-page,.cv-page"),
            b = s.getBoundingClientRect();
          return {
            ratio: r.width / innerWidth,
            center: r.left + r.width / 2,
            width: s.offsetWidth,
            height: s.offsetHeight,
            sheet: b.width,
          };
        });
        assert(m.ratio >= 0.8 && m.ratio <= 0.9);
        assert(Math.abs(m.center - width / 2) < 2);
        assert(Math.abs(m.width - 794) < 2 && Math.abs(m.height - 1123) < 2);
        assert(Math.abs(m.sheet - width * 0.86) < 2);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test("Chat is a closable drawer and never a side column", async () => {
      assert(!(await page.locator(".chat-panel").isVisible()));
      await page.getByRole("button", { name: "Chat", exact: true }).click();
      assert(await page.locator(".chat-panel").isVisible());
      assert.equal(
        await page
          .locator(".chat-panel")
          .evaluate((el) => getComputedStyle(el).position),
        "fixed",
      );
      await page
        .getByRole("button", { name: "Close chat", exact: true })
        .click();
      assert(!(await page.locator(".chat-panel").isVisible()));
    });
    await test("Composite title/company edits stay separate; uppercase is presentation only", async () => {
      const before = await stored();
      await edit("jobs.0.title", "Mixed Case Designer");
      let after = await stored();
      assert.equal(after.jobs[0].title, "Mixed Case Designer");
      assert.equal(after.jobs[0].organization, before.jobs[0].organization);
      await edit("jobs.0.organization", "Small Studio");
      after = await stored();
      assert.equal(after.jobs[0].title, "Mixed Case Designer");
      assert.equal(after.jobs[0].organization, "Small Studio");
    });
    await test("Blur saves, Escape cancels, Shift+Enter preserves a newline", async () => {
      let el = field(page, "summary"),
        old = (await stored()).summary;
      await el.click();
      await el.fill("Discard this");
      await el.press("Escape");
      assert.equal((await stored()).summary, old);
      await el.click();
      await el.fill("First line");
      await el.press("End");
      await el.press("Shift+Enter");
      await page.keyboard.insertText("Second line");
      await page.locator(".editor-toolbar").click({ position: { x: 5, y: 5 } });
      assert.equal((await stored()).summary, "First line\nSecond line");
    });
    await test("Legacy headings and extra content edit independently and preserve raw case", async () => {
      const el = page
        .locator(
          '.edit-stage [data-field^="templateText."]:not([data-field$=".dates"]):not([data-field$=".year"]):visible',
        )
        .first();
      const path = await el.getAttribute("data-field");
      await edit(path, "About My Work");
      let value = await stored();
      for (const key of path.split(".")) value = value[key];
      assert.equal(value, "About My Work");
      await page.keyboard.press("Control+z");
    });
    await test("Bullets: Enter appends, empty Backspace removes; undo/redo restores the data object", async () => {
      const count = (await stored()).jobs[0].bullets.length;
      const el = field(page, "jobs.0.bullets.0");
      await el.click();
      await el.fill("Delivered measurable improvements.");
      await el.press("Enter");
      await page.waitForTimeout(250);
      assert.equal((await stored()).jobs[0].bullets.length, count + 1);
      await field(page, "jobs.0.bullets.1").press("Backspace");
      await page.waitForTimeout(250);
      assert.equal((await stored()).jobs[0].bullets.length, count);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
      assert.equal((await stored()).jobs[0].bullets.length, count + 1);
      await page.keyboard.press("Control+Shift+z");
      await page.waitForTimeout(100);
      assert.equal((await stored()).jobs[0].bullets.length, count);
    });
    await test("Rich paste is plain text; hidden controls stripped, meaningful Dari ZWNJ preserved", async () => {
      const el = field(page, "summary");
      await el.click();
      await el.fill("");
      await el.evaluate((el) => {
        const dt = new DataTransfer();
        dt.setData("text/html", "<b>Bold</b><script>alert(1)</script>");
        dt.setData("text/plain", "Plain\r\ntext\u200b\u202e راه\u200cحل");
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          }),
        );
      });
      assert.equal(await el.locator("b,script").count(), 0);
      await el.press("Enter");
      assert.equal((await stored()).summary, "Plain\ntext راه‌حل");
    });
    await test("IME composition Enter is ignored; Pashto/Dari/mixed text survives save, caret insertion and undo", async () => {
      const text =
        "زه د UX Design او React په برخه کې کار کوم. راه‌حل‌های روشن";
      const el = field(page, "summary");
      await el.click();
      await el.evaluate((el, text) => {
        el.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true }),
        );
        el.textContent = text;
        el.dispatchEvent(
          new InputEvent("input", { bubbles: true, isComposing: true }),
        );
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            isComposing: true,
            bubbles: true,
          }),
        );
      }, text);
      assert.equal(await el.getAttribute("contenteditable"), "true");
      await el.evaluate((el) =>
        el.dispatchEvent(
          new CompositionEvent("compositionend", { bubbles: true }),
        ),
      );
      await el.press("End");
      await page.keyboard.insertText(" 2026");
      await el.press("Enter");
      assert.equal((await stored()).summary, text + " 2026");
      await page.keyboard.press("Control+z");
      assert.notEqual((await stored()).summary, text + " 2026");
      await page.keyboard.press("Control+Shift+z");
      assert.equal((await stored()).summary, text + " 2026");
    });
    await test("Date range uses year → month → day for both endpoints, plus Present and graduation", async () => {
      await field(page, "jobs.0.dates").click();
      assert.equal(await page.locator("[contenteditable]").count(), 0);
      await page.getByLabel("From year", { exact: true }).selectOption("2020");
      await page.getByLabel("From month", { exact: true }).selectOption("2");
      await page.getByLabel("From day", { exact: true }).selectOption("29");
      const cb = page.getByRole("checkbox", { name: "Present" });
      if (await cb.isChecked()) await cb.uncheck();
      await page.getByLabel("To year", { exact: true }).selectOption("2024");
      await page.getByLabel("To month", { exact: true }).selectOption("12");
      await page.getByLabel("To day", { exact: true }).selectOption("31");
      await page.getByRole("button", { name: "Save dates" }).click();
      assert.equal((await stored()).jobs[0].dates, "2020-02-29 - 2024-12-31");
      await field(page, "jobs.0.dates").click();
      await cb.check();
      await page.getByRole("button", { name: "Save dates" }).click();
      assert.equal((await stored()).jobs[0].dates, "2020-02-29 - Present");
      await field(page, "education.0.year").click();
      await page
        .getByLabel("Graduation year", { exact: true })
        .selectOption("2019");
      await page.getByRole("button", { name: "Save dates" }).click();
      assert.equal((await stored()).education[0].year, "2019");
    });
    await test("Field limits stop oversize input; long accepted text re-paginates whole sections", async () => {
      await open(report.templates[0]);
      const el = field(page, "summary"),
        text = "Research and collaborative product delivery. ".repeat(150);
      await el.click();
      await el.fill(text);
      await el.press("Enter");
      assert((await stored()).summary.length <= 2400);
      await edit("summary", "Clear achievement.\n".repeat(35));
      await page.waitForSelector("[data-continuation]");
      assert.equal(await page.locator(".layout-error").count(), 0);
      assert(
        (await page.locator(".cv-render").innerText()).includes(
          (await stored()).summary,
        ),
      );
    });
    await test("Every optional section field is mapped to its own shared-data path", async () => {
      const sample = JSON.parse(
          fs.readFileSync(
            path.join(
              root,
              "public/templates",
              report.templates.at(-1),
              "template.json",
            ),
          ),
        ).sample,
        defs = engine.load().sectionDefinitions;
      sample.optionalSections = Object.entries(defs).map(([type, def], i) => ({
        id: `test-${i}`,
        type,
        items: structuredClone(def.sample),
      }));
      await open(report.templates.at(-1), sample);
      await page.waitForSelector("[data-continuation]");
      for (const [i, s] of sample.optionalSections.entries())
        for (const [j, item] of s.items.entries())
          for (const [key, value] of Object.entries(item)) {
            if (
              typeof value === "string" &&
              value &&
              !value.startsWith("data:")
            )
              assert(
                await field(
                  page,
                  `optionalSections.${i}.items.${j}.${key}`,
                ).count(),
                `${s.type}.${key}`,
              );
          }
      const p = "optionalSections.0.items.0.title";
      if (await field(page, p).count()) {
        await edit(p, "Original custom title");
        assert.equal(
          (await stored()).optionalSections[0].items[0].title,
          "Original custom title",
        );
      }
    });
    const mobile = await browser.newContext({
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
      }),
      phone = await mobile.newPage();
    await phone.goto(`${base}/edit/${report.templates.at(-1)}`);
    await phone.waitForSelector(".edit-stage");
    await test("Touch OFF: taps and scroll gestures never edit", async () => {
      assert(
        await phone
          .getByRole("button", { name: "Edit CV", exact: true })
          .isVisible(),
      );
      await field(phone, "name").tap();
      assert.equal(await phone.getByRole("dialog").count(), 0);
      assert.equal(await phone.locator("[contenteditable]").count(), 0);
    });
    await test("Touch ON: scroll is ignored, tap opens ≥16px bottom sheet; live preview, cancel, Done and undo/redo", async () => {
      await phone.getByRole("button", { name: "Edit CV", exact: true }).click();
      const el = field(phone, "name");
      await el.evaluate((el) => {
        const r = el.getBoundingClientRect(),
          x = r.left + 5,
          y = r.top + 5;
        el.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: x,
            clientY: y,
            pointerType: "touch",
          }),
        );
        el.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerId: 1,
            clientX: x,
            clientY: y + 50,
            pointerType: "touch",
          }),
        );
        el.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            pointerId: 1,
            clientX: x,
            clientY: y + 50,
            pointerType: "touch",
          }),
        );
      });
      assert.equal(await phone.getByRole("dialog").count(), 0);
      await el.tap();
      const input = phone.locator("#touch-field");
      assert(
        Number(
          await input.evaluate((el) =>
            parseFloat(getComputedStyle(el).fontSize),
          ),
        ) >= 16,
      );
      assert.equal(await input.getAttribute("dir"), "auto");
      await input.fill("زه د React ډیزاینر یم");
      assert(
        (await phone.locator(".edit-stage").innerText()).includes(
          "زه د React ډیزاینر یم",
        ),
      );
      await phone.getByRole("button", { name: "Cancel", exact: true }).click();
      assert(
        !(await phone.locator(".edit-stage").innerText()).includes(
          "زه د React ډیزاینر یم",
        ),
      );
      await el.tap();
      await input.fill("Mobile Profile");
      await phone
        .locator(".field-bottom-sheet")
        .getByRole("button", { name: "Done", exact: true })
        .click();
      assert.equal(
        await phone.evaluate(
          () => JSON.parse(localStorage.getItem("cv-studio-v3")).data.name,
        ),
        "Mobile Profile",
      );
      await phone.getByRole("button", { name: "Undo", exact: true }).click();
      assert.notEqual(
        await phone.evaluate(
          () => JSON.parse(localStorage.getItem("cv-studio-v3")).data.name,
        ),
        "Mobile Profile",
      );
      await phone.getByRole("button", { name: "Redo", exact: true }).click();
      assert.equal(
        await phone.evaluate(
          () => JSON.parse(localStorage.getItem("cv-studio-v3")).data.name,
        ),
        "Mobile Profile",
      );
      await phone.getByRole("button", { name: "Done", exact: true }).click();
      await el.tap();
      assert.equal(await phone.getByRole("dialog").count(), 0);
    });
    await test("Wide coarse-pointer tablet still requires explicit Edit CV", async () => {
      await phone.setViewportSize({ width: 1200, height: 900 });
      assert(
        await phone
          .getByRole("button", { name: "Edit CV", exact: true })
          .isVisible(),
      );
    });
    await test("Keyboard, editing and routing produce no runtime errors", () =>
      assert.deepEqual(errors, []));
    await page.screenshot({
      path: path.join(root, "test-results/click-edit-desktop.png"),
      fullPage: false,
    });
    await phone.screenshot({
      path: path.join(root, "test-results/click-edit-phone.png"),
      fullPage: false,
    });
    await context.close();
    await mobile.close();
  });
  report.passed = report.checks.filter((c) => c.passed).length;
  report.failed = report.failures.length;
  fs.writeFileSync(
    path.join(root, "tools/click-edit-audit.json"),
    JSON.stringify(report, null, 2),
  );
  const auditPath = path.join(root, "tools/layout-audit.json"),
    audit = JSON.parse(fs.readFileSync(auditPath));
  audit.clickToEdit = report;
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  if (report.failed) process.exitCode = 1;
}
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { check };
