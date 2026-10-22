# 21_CV_templates

<img src="public/branding/logo.png" alt="CV Studio logo" width="88" />

Created by **Jundullah Sultan** · [WhatsApp: +93708176837](https://wa.me/93708176837)

A React + Vite application with React Router. Browsing, editing, autosave and printing run in the browser. Deploy `dist/` to a free static host; no backend is required.

Vercel runs `npm run build:static`, which bundles the checked-in `public/templates`, `public/thumbnails`, `public/manifest.json` and `public/sections.json` assets without launching Playwright. After changing template sources or the compiler, run `npm run build` locally and commit the regenerated assets before deploying. The full local build requires Chrome or an installed Playwright Chromium browser.

```powershell
npm install
npm run build
npm run dev
```

Build once before development to generate the manifest and template assets. Open the URL printed by Vite. `npm run preview` serves the production build. `node builder/server.cjs` is a compatibility launcher for Vite.

## Gallery and editor

`/` lists every numbered folder discovered at build time. Cards use small, lazy-loaded WebP thumbnails. `/edit/:templateId` opens that template; invalid or missing templates return to the gallery with a short message. Desktop shows the chat panel beside a read-only CV preview. Mobile has Chat and Preview tabs.

Use **Edit CV** or a detail button in the chat panel, answer the question and choose **Save answer**. Clicking the CV text never starts editing. The toolbar also provides Add section, Change template and Download PDF. Changing templates preserves the complete shared data object, including optional sections and previously saved text. Start over restores the chosen sample. Autosave uses localStorage inside try/catch and restores data on return; unavailable storage produces a notice. Personal data stays on the device.

**All CV sections** lists the chosen template's own sections. Expand a section and select a field to edit headings, text, dates, statistics, links or proficiency levels. Each field updates the original design and PDF. Added sections also support renaming. Run `npm run check:sections` to edit every generated field across all templates, verify persistence, and export PDF evidence to `test-results/sections`.

English, Pashto and Dari navigation and RTL are supported. Sample CV content remains English until edited. Work experience and education use sequential questions; skills accept one item per line.

**Download PDF prepares a dedicated print document, then opens the browser print dialog.** A loading state covers layout, local fonts and image preparation. Choose Save as PDF, A4 portrait, 100% scale, no headers/footers and background graphics enabled. The suggested filename is `<Full Name>_CV.pdf`, falling back to `CV.pdf`; the OS save dialog can override it. Text remains selectable. The live preview, PDF print, thumbnails and static HTML generator all use `src/renderer.jsx`.

The `PdfExporter` interface is in `src/pdf/PdfExporter.jsx`; its sole enabled strategy is selected by `PDF_EXPORT_STRATEGY` in `src/pdf/config.js`. No serverless strategy or paid service is enabled. See [the exporter contract](src/pdf/README.md). Fonts are self-hosted in `public/fonts/`. Pashto uses `ps_da.ttf` throughout the interface, CV preview and PDF; Dari uses Amiri. Run `npm run check:fonts` to verify language switching and bundled font references.

**Physical Android Chrome and iOS Safari remain unverified until you test and report back.** Follow [the exact mobile acceptance checklist](docs/pdf-mobile-tests.md), including saving, searching, copying, page breaks, colors, cancellation and retry.

## Dynamic templates

`tools/compile-templates.cjs` scans every numeric directory without a fixed count. It compiles canonical HTML into React element-tree data, binds the five required sections, scopes CSS to `.tpl-ID`, namespaces local fonts/animations, copies assets and reads `theme.json` or infers theme defaults.

Generated files are `public/manifest.json`, `public/sections.json`, `public/templates/ID/` and `public/thumbnails/ID.webp`. The manifest contains id, displayName, thumbnail, supportedSections and pageCount. The gallery loads no template trees or CSS. Only the selected template loads in the editor. The preview renderer creates React elements directly, without iframes or HTML injection. PDF export alone uses a separate, script-free print iframe.

To add a design, create another numbered folder containing index.html, style.css and assets, then rebuild. No app-code change or registry edit is needed. Mark editable sections with `data-section="contact|summary|experience|education|skills"` and use conventional headings/articles; legacy `data-cv-section` markup is supported too. theme.json is optional. A new layout is captured to `tools/layout-sources/ID.html` on first compilation. Edit that canonical source afterward.

`tools/cv-content.json` contains sample details and the schemas, validation limits and original example content for all 20 optional sections. Details are illustrative and should be replaced and verified before use.

## Optional sections and A4

The picker offers Custom, Languages, Training / Courses, Projects, Strengths, Volunteering, Industry Expertise, Interests, My Time, Find Me Online, Certifications, Awards, References, My Life Philosophy, Publications, Books, Additional Experience, Additional Skills, Additional Publications and Signature.

Adding a section starts its questions. Entries can be edited, sections reordered or removed, and reusable Custom sections renamed. Signature accepts local PNG/JPEG/WebP uploads up to 2 MB; Books optionally accept covers. Levels and percentages appear as plain selectable text.

Pages are explicit 210 ? 297 mm sheets. The renderer measures content at its actual type size, moves complete sections to continuation pages and splits large sections only between entries. Overflowing core sections move to continuation pages too. Empty or removed optional sections leave no gap. An entry larger than a page displays a request to shorten or split it, rather than clipping or shrinking it.

`npm run generate` regenerates each numbered folder's script-free index.html and scoped react.css using the shared React renderer. Original style.css and a4.css remain untouched. Edit JSON or canonical layout sources, not generated HTML.

## Free static hosting

Run `npm run build` and publish `dist/` at the domain root. netlify.toml and public/_redirects provide SPA fallback configuration; vercel.json provides equivalent rewrites. The host must serve index.html for application routes such as /edit/01 while serving assets normally. No deployment is performed automatically.

## Checks

```powershell
npm run check:app
npm run check
npm run check:scale
npm run check:editing
```

- check-app.cjs tests the production gallery, folder parity, every editor route, invalid routes, switching/data retention, chat, section controls, autosave/restore/storage failure, deep-link refresh, PDF action, mobile tabs/width and RTL.
- check-react-layouts.cjs (also check-cvs.cjs) tests every template with each optional section, all sections, empty sections, many entries, RTL, A4 geometry, PDF page counts and selectable text.
- check-gallery-scale.cjs adds temporary numeric folders to reach at least 32 templates, compiles them without app changes, opens a new template and measures first gallery render under 4x CPU throttling, 150 ms latency and 200 KB/s download. Fixtures are removed in finally and the real manifest restored.
- check-editing.cjs verifies every template has a read-only preview, that Edit CV saves through the chat, that mobile tabs work, and that saved content survives. Results are `tools/editing-audit.json` and the `editing` entry in `tools/layout-audit.json`.

Reports are tools/app-audit.json, tools/layout-audit.json (also react-layout-audit.json) and tools/gallery-scale-audit.json. Build tools use local Chrome/Edge; set CHROME_PATH or install Playwright Chromium when necessary. check-legacy-layouts.cjs preserves the previous engine's checks and is separate from React verification.

## PDF export verification

Install the test-only Python dependencies with `python -m pip install -r tools/pdf-test-requirements.txt`, then run `npm run check:pdf`. It discovers all numbered folders and exports seven scenarios for each: sample, all optional sections, edited, long content, Pashto, Dari and mixed Pashto/English. The same strategy prepares the exact script-free HTML that headless Chrome prints.

PDF.js checks text and A4/page counts. Independent PyMuPDF inspection checks real embedded font programs, native Arabic word searches, colors and raster agreement with Preview. HarfBuzz and fontTools verify contextual Arabic glyph selection rather than isolated-letter rendering. Evidence PDFs, static print HTML and representative raster images are saved under `test-results/pdf-export/`. Results are saved under `pdfExport` in `tools/layout-audit.json` and separately in `tools/pdf-export-audit.json`.

The automated result covers desktop Chrome, not physical phones or other desktop browsers. `export()` confirms preparation and print invocation, not that the user actually saved a file. No Tier 2 implementation is built without approval.
