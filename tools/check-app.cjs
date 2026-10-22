const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict");
const e = require("./cv-engine.cjs");
const root = path.resolve(__dirname, "..");
function staticServer(dir) {
  return http.createServer((req, res) => {
    let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ),
      file = path.resolve(dir, "." + pathname);
    if (
      file !== path.resolve(dir) &&
      !file.startsWith(path.resolve(dir) + path.sep)
    ) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(pathname) && !/^\/(edit|render)\//.test(pathname)) {
        res.writeHead(404).end();
        return;
      }
      file = path.join(dir, "index.html");
    }
    const ext = path.extname(file),
      types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".webp": "image/webp",
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
      };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.end(fs.readFileSync(file));
  });
}
async function check() {
  const found = e.discover(),
    manifest = JSON.parse(
      fs.readFileSync(path.join(root, "dist/manifest.json")),
    ),
    report = {
      date: new Date().toISOString(),
      templates: found,
      checks: [],
      templateResults: [],
      failures: [],
    };
  const test = async (name, fn) => {
    try {
      const detail = await fn();
      report.checks.push({ name, passed: true, ...(detail || {}) });
      console.log("PASS", name);
    } catch (err) {
      report.failures.push({ name, error: err.message });
      report.checks.push({ name, passed: false, error: err.message });
      console.error("FAIL", name, err.message);
    }
  };
  const server = staticServer(path.join(root, "dist"));
  await new Promise((r) => server.listen(5190, "127.0.0.1", r));
  const base = "http://127.0.0.1:5190";
  const browser = await e.playwright().chromium.launch(e.browserOptions());
  try {
    await test("Manifest exactly matches every numeric folder", () =>
      assert.deepEqual(
        manifest.map((m) => m.id),
        found,
      ));
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const galleryRequests = [];
    page.on("request", (r) => galleryRequests.push(r.url()));
    await page.goto(base);
    await page.waitForSelector("[data-template-card]");
    await test("Gallery has one linked card per folder, lazy WebP images and no live CVs", async () => {
      assert.equal(
        await page.locator("[data-template-card]").count(),
        found.length,
      );
      assert.equal(await page.locator(".cv-render,iframe").count(), 0);
      assert.equal(
        await page
          .locator('[data-template-card] img:not([loading="lazy"])')
          .count(),
        0,
      );
      assert(
        !galleryRequests.some((url) =>
          /template\.json|template\.css|sections\.json/.test(url),
        ),
      );
      for (const m of manifest) {
        assert.equal(
          await page
            .locator(`[data-template-card="${m.id}"]`)
            .getAttribute("href"),
          `/edit/${m.id}`,
        );
        const file = path.join(root, "dist", m.thumbnail);
        assert(fs.existsSync(file));
        assert(fs.statSync(file).size < 40000);
      }
    });
    for (const id of found) {
      await test(`Card ${id} routes to its own React template with sample data`, async () => {
        await page.evaluate(() => localStorage.clear());
        await page.goto(base);
        await page.locator(`[data-template-card="${id}"]`).click();
        await page.waitForSelector(`.tpl-${id}`);
        await page.waitForTimeout(300);
        assert(page.url().endsWith(`/edit/${id}`));
        assert.equal(await page.locator("iframe").count(), 0);
        const t = JSON.parse(
          fs.readFileSync(
            path.join(root, "public/templates", id, "template.json"),
          ),
        );
        const text = await page.locator(".cv-render").textContent();
        assert(
          text
            .replace(/\s/g, "")
            .toLowerCase()
            .includes(t.sample.name.replace(/\s/g, "").toLowerCase()),
        );
        assert(text.includes(t.sample.email));
        assert(text.includes(t.sample.summary));
        assert.equal(
          await page.locator(".cv-render").getAttribute("data-template-id"),
          id,
        );
        const geo = await page
          .locator(".cv-render .a4-page,.cv-render .cv-page")
          .evaluateAll((nodes) =>
            nodes.map((n) => ({
              w: n.offsetWidth,
              h: n.offsetHeight,
            })),
          );
        assert(geo.length > 0);
        for (const g of geo) {
          assert(Math.abs(g.w - 793.7) < 2);
          assert(Math.abs(g.h - 1122.5) < 2);
        }
        report.templateResults.push({ id, pages: geo.length, passed: true });
      });
    }
    await test("Invalid template redirects with an explanatory message", async () => {
      await page.goto(base + "/edit/does-not-exist");
      await page.waitForURL(base + "/");
      assert(
        (await page.getByRole("status").innerText()).includes(
          "no longer available",
        ),
      );
    });
    await test("Deleted template assets redirect safely instead of breaking the editor", async () => {
      const pattern = `**/templates/${found[0]}/template.json`;
      await page.route(pattern, (route) =>
        route.fulfill({ status: 404, body: "Missing template" }),
      );
      await page.goto(base + "/edit/" + found[0]);
      await page.waitForURL(base + "/");
      assert(
        (await page.getByRole("status").innerText()).includes(
          "no longer available",
        ),
      );
      await page.unroute(pattern);
    });
    await page.goto(base + "/edit/" + found[0]);
    await page.waitForSelector(".cv-render");
    await test("Chat edits preview and autosaves; section picker asks questions", async () => {
      await page
        .getByRole("button", { name: "Full name", exact: false })
        .click();
      await page.locator("#answer").fill("Samira Test Profile");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".cv-render")
          .textContent.includes("Samira Test Profile"),
      );
      await page
        .getByRole("button", { name: "Add section", exact: false })
        .click();
      assert.equal(await page.locator("[data-add-section]").count(), 20);
      await page.locator('[data-add-section="languages"]').click();
      await page.locator("#answer").fill("English");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page.locator("#answer").fill("Proficient");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page.waitForSelector("[data-continuation]");
      assert(
        (await page.locator(".cv-render").innerText()).includes("Proficient"),
      );
      await page.waitForTimeout(150);
      assert(
        JSON.parse(
          await page.evaluate(() => localStorage.getItem("cv-studio-v3")),
        ).data.name === "Samira Test Profile",
      );
    });
    await test("Change template preserves all entered data and added sections", async () => {
      const before = await page.evaluate(
        () => JSON.parse(localStorage.getItem("cv-studio-v3")).data,
      );
      await page.getByRole("link", { name: "Change template" }).click();
      await page.locator(`[data-template-card="${found[1]}"]`).click();
      await page.waitForSelector(`.tpl-${found[1]}`);
      await page.waitForFunction(() =>
        document
          .querySelector(".cv-render")
          ?.textContent.includes("Proficient"),
      );
      assert.deepEqual(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("cv-studio-v3")).data,
        ),
        before,
      );
      assert(
        (await page.locator(".cv-render").innerText()).includes(
          "Samira Test Profile",
        ),
      );
      assert(
        (await page.locator(".cv-render").innerText()).includes("Proficient"),
      );
    });
    await test("Direct deep link and refresh return HTTP 200 and restore autosave", async () => {
      const response = await page.reload();
      assert.equal(response.status(), 200);
      await page.waitForSelector(".cv-render");
      assert(
        (await page.locator(".cv-render").innerText()).includes(
          "Samira Test Profile",
        ),
      );
      assert(
        (await page.locator(".selected-sections").innerText()).includes(
          "Languages",
        ),
      );
    });
    await test("Custom sections can be renamed, reordered and removed", async () => {
      await page
        .getByRole("button", { name: "Add section", exact: false })
        .click();
      await page.locator('[data-add-section="custom"]').click();
      await page.getByLabel("Custom section name").fill("Community projects");
      await page
        .locator(".section-editor")
        .last()
        .getByRole("button", { name: "Move up", exact: false })
        .click();
      assert(
        (await page.locator(".section-editor").first().innerText()).includes(
          "Community projects",
        ),
      );
      await page
        .locator(".section-editor")
        .first()
        .getByRole("button", { name: "Remove", exact: true })
        .click();
      assert.equal(await page.locator(".section-editor").count(), 1);
    });
    await test("Start over restores sample data and removes optional sections", async () => {
      await page
        .getByRole("button", { name: "Start over", exact: true })
        .click();
      assert.equal(await page.locator(".section-editor").count(), 0);
      assert(
        !(await page.locator(".cv-render").innerText()).includes(
          "Samira Test Profile",
        ),
      );
    });
    await test("Download PDF uses the same renderer and opens browser Save as PDF", async () => {
      await page.evaluate(() => {
        window.__printed = false;
        window.print = () => {
          throw new Error("Editor window must not be printed");
        };
        const observer = new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (node.tagName === "IFRAME") {
                node.contentWindow.print = () => {
                  window.__printed = true;
                  const doc = node.contentDocument;
                  window.__printProof = {
                    title: doc.title,
                    text: doc.body.textContent,
                    scripts: doc.scripts.length,
                    editor: doc.querySelectorAll(
                      "[data-bind],[data-field],[contenteditable],[role='textbox'],button,input,.chat-panel,.editor-toolbar",
                    ).length,
                  };
                  node.contentWindow.dispatchEvent(new Event("afterprint"));
                };
              }
        });
        observer.observe(document.body, { childList: true });
      });
      await page.getByRole("button", { name: "Edit CV", exact: true }).click();
      await page.locator("#answer").fill("Exported Chat Profile");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page
        .getByRole("button", { name: "Download PDF", exact: true })
        .click();
      await page.waitForFunction(() => window.__printed);
      const proof = await page.evaluate(() => window.__printProof);
      assert(proof.title.endsWith("_CV"));
      assert.equal(proof.title, "Exported Chat Profile_CV");
      assert(proof.text.replace(/\s+/g, "").includes("ExportedChatProfile"));
      assert.equal(proof.scripts, 0);
      assert.equal(proof.editor, 0);
      assert(
        (await page.getByRole("status").innerText()).includes("Save as PDF"),
      );
    });
    await test("Oversized entries show a repair message and block incomplete PDF export", async () => {
      await page
        .getByRole("button", { name: "Professional summary", exact: false })
        .click();
      await page
        .locator("#answer")
        .fill(
          "Practical professional achievements and collaborative delivery. ".repeat(
            900,
          ),
        );
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent === "Download PDF" && b.disabled,
        ),
      );
      assert.equal(await page.locator(".layout-error").count(), 1);
      await page
        .getByRole("button", { name: "Start over", exact: true })
        .click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent === "Download PDF" && !b.disabled,
        ),
      );
    });
    await test("Mobile gallery has one column, editor tabs and no horizontal page overflow", async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(base);
      await page.waitForSelector("[data-template-card]");
      assert.equal(
        await page
          .locator(".template-grid")
          .evaluate(
            (n) => getComputedStyle(n).gridTemplateColumns.split(" ").length,
          ),
        1,
      );
      await page.locator("[data-template-card]").first().click();
      await page.waitForSelector(".cv-render", { state: "attached" });
      assert(
        await page.getByRole("tab", { name: "Chat", exact: true }).isVisible(),
      );
      await page
        .getByRole("button", { name: "Add section", exact: false })
        .click();
      await page.locator('[data-add-section="languages"]').click();
      await page.locator("#answer").fill("English");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page.locator("#answer").fill("Proficient");
      await page
        .getByRole("button", { name: "Save answer", exact: false })
        .click();
      await page.getByRole("tab", { name: "Preview", exact: true }).click();
      await page.waitForSelector(".cv-render>[data-continuation]");
      const sheets = page.locator(
        ".cv-render .a4-page,.cv-render .cv-page,.cv-render>[data-continuation]",
      );
      for (const size of await sheets.evaluateAll((nodes) =>
        nodes.map((n) => [n.offsetWidth, n.offsetHeight]),
      )) {
        assert(Math.abs(size[0] - 794) < 2);
        assert(Math.abs(size[1] - 1123) < 2);
      }
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = pdfjs.getDocument({
        data: new Uint8Array(
          await page.pdf({ preferCSSPageSize: true, printBackground: true }),
        ),
        useSystemFonts: true,
      });
      const pdf = await task.promise;
      assert.equal(pdf.numPages, await sheets.count());
      await task.destroy?.();
      assert(!(await page.locator(".chat-panel").isVisible()));
      assert(await page.locator(".preview-panel").isVisible());
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    });
    for (const language of ["ps", "fa"])
      await test(`Gallery and editor support ${language} with RTL UI and LTR CV`, async () => {
        await page.goto(base);
        await page.getByLabel("App language").selectOption(language);
        assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
        assert.equal(await page.locator("html").getAttribute("lang"), language);
        await page.locator("[data-template-card]").first().click();
        await page.waitForSelector(".cv-render", { state: "attached" });
        assert.equal(
          await page.locator(".cv-render").getAttribute("dir"),
          "ltr",
        );
        assert.equal(
          await page
            .locator(".chat-panel")
            .evaluate((element) => getComputedStyle(element).direction),
          "rtl",
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
      });
    await test("Unavailable localStorage does not break editing", async () => {
      const blocked = await browser.newContext();
      await blocked.addInitScript(() => {
        Object.defineProperty(Storage.prototype, "setItem", {
          value: () => {
            throw new DOMException("blocked");
          },
        });
      });
      const p = await blocked.newPage();
      await p.goto(base + "/edit/" + found[0]);
      await p.waitForSelector(".cv-render");
      assert(
        (await p.getByRole("status").innerText()).includes(
          "Autosave is unavailable",
        ),
      );
      await blocked.close();
    });
    await test("Every template keeps an A4 canvas in its narrow-screen editor", async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      for (const id of found) {
        await page.evaluate(() => localStorage.clear());
        await page.goto(base + "/edit/" + id);
        await page.waitForSelector(".cv-render", { state: "attached" });
        await page.getByRole("tab", { name: "Preview", exact: true }).click();
        await page.evaluate(() => document.fonts.ready);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Mobile width ${id}`,
        );
        const sizes = await page
          .locator(".cv-render .a4-page,.cv-render .cv-page")
          .evaluateAll((nodes) =>
            nodes.map((n) => [n.offsetWidth, n.offsetHeight]),
          );
        assert(sizes.length > 0);
        for (const [width, height] of sizes) {
          assert(Math.abs(width - 794) < 2, `A4 width ${id}`);
          assert(Math.abs(height - 1123) < 2, `A4 height ${id}`);
        }
      }
    });
    await test("No browser runtime errors in routing and editing", () =>
      assert.deepEqual(errors, []));
    await context.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    fs.writeFileSync(
      path.join(root, "tools/app-audit.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  if (report.failures.length) process.exitCode = 1;
  return report;
}
if (require.main === module)
  check().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
module.exports = { check, staticServer };
