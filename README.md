# CV Studio

A React + Vite application with React Router. Browsing, editing, autosave and printing run in the browser. Deploy `dist/` to a free static host; no backend is required.

```powershell
npm install
npm run build
npm run dev
```

Build once before development to generate the manifest and template assets. Open the URL printed by Vite. `npm run preview` serves the production build. `node builder/server.cjs` is a compatibility launcher for Vite.

## Gallery and editor

`/` lists every numbered folder discovered at build time. Cards use small, lazy-loaded WebP thumbnails. `/edit/:templateId` opens that template; invalid or missing templates return to the gallery with a short message. The preview is centered at 86% of the viewport; chat is a collapsible drawer. Mobile retains Chat and Preview tabs.

Desktop click-to-edit is always enabled when the viewport is at least 1000px with a fine pointer and hover. There is no desktop Edit CV button. Narrow screens and coarse pointers (including tablets) use Edit CV / Done; viewing mode never starts edits. The toolbar also provides Chat, Undo/Redo, Add section, Change template and Download PDF. Changing templates preserves the complete shared data object, including optional sections. Start over restores the chosen sample. Autosave uses localStorage inside try/catch and restores data on return; unavailable storage produces a notice. Personal data stays on the device.

Editable builder text has a `data-field` path. Desktop edits save on blur or Enter; Shift+Enter inserts a newline and Escape cancels. Bullet Enter adds a bullet; Backspace removes an empty bullet. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y use data-object history (up to 100 changes), which also includes chat and section changes. History lasts for the current tab session; autosaved content survives refresh. Field limits are in `tools/cv-content.json` under `editing` and in optional-section schemas.

Touch taps require a stationary gesture. Small text gets a minimum 44px virtual hit area without adding printed padding, and a bottom sheet uses an 18px plain-text input with a live draft preview, Cancel and Done. Cancel restores the saved value; Done commits one undoable change. Date fields open year → month → day dropdowns with year-only, month-only and Present options. New date values use ISO dates to avoid ambiguous numeric formats. Meaningful Pashto/Dari ZWNJ/ZWJ characters are retained while pasted formatting and hidden direction controls are removed.

The A4 canvas is scaled with CSS transform, retaining its actual dimensions and measured page breaks. Whole overflowing sections/entries move to continuation pages after each saved edit (and during touch drafts). An individual entry that exceeds a whole A4 page must be shortened or split; PDF export stays blocked until repaired. Original extra text uses per-template `templateText` paths; personal details and optional sections remain shared. Editor field metadata, event handlers, outlines and the builder stylesheet are absent from static/PDF documents.

Physical Pashto keyboard and mobile caret behavior remain unverified. Follow [the click-to-edit device checklist](docs/click-edit-device-tests.md); automated composition events cannot replace an OS keyboard test.

English, Pashto and Dari navigation and RTL are supported. Sample CV content remains English until edited. Work experience and education use sequential questions; skills accept one item per line.

**Download PDF prepares a dedicated print document, then opens the browser print dialog.** A loading state covers layout, local fonts and image preparation. Choose Save as PDF, A4 portrait, 100% scale, no headers/footers and background graphics enabled. The suggested filename is `<Full Name>_CV.pdf`, falling back to `CV.pdf`; the OS save dialog can override it. Text remains selectable. The live preview, PDF print, thumbnails and static HTML generator all use `src/renderer.jsx`.

The `PdfExporter` interface is in `src/pdf/PdfExporter.jsx`; its sole enabled strategy is selected by `PDF_EXPORT_STRATEGY` in `src/pdf/config.js`. No serverless strategy or paid service is enabled. See [the exporter contract](src/pdf/README.md). Static Rubik and open-license fallback fonts, plus Amiri for Pashto/Dari, are self-hosted with their licenses in `public/fonts/`. Arabic-script CVs use Amiri throughout to preserve joining, combining marks and searchable mixed runs.

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
- check-click-edit.cjs discovers all folders, edits each template on desktop and checks its sanitized print document. It also tests touch/coarse-pointer behavior, 86% widths, drawer layout, composite values, dates, bullets, limits, continuation pages, paste, data undo/redo and synthetic Pashto/Dari IME input. Results are `tools/click-edit-audit.json` and the `clickToEdit` entry in `tools/layout-audit.json`.

Reports are tools/app-audit.json, tools/layout-audit.json (also react-layout-audit.json) and tools/gallery-scale-audit.json. Build tools use local Chrome/Edge; set CHROME_PATH or install Playwright Chromium when necessary. check-legacy-layouts.cjs preserves the previous engine's checks and is separate from React verification.

## PDF export verification

Install the test-only Python dependencies with `python -m pip install -r tools/pdf-test-requirements.txt`, then run `npm run check:pdf`. It discovers all numbered folders and exports seven scenarios for each: sample, all optional sections, edited, long content, Pashto, Dari and mixed Pashto/English. The same strategy prepares the exact script-free HTML that headless Chrome prints.

PDF.js checks text and A4/page counts. Independent PyMuPDF inspection checks real embedded font programs, native Arabic word searches, colors and raster agreement with Preview. HarfBuzz and fontTools verify contextual Arabic glyph selection rather than isolated-letter rendering. Evidence PDFs, static print HTML and representative raster images are saved under `test-results/pdf-export/`. Results are saved under `pdfExport` in `tools/layout-audit.json` and separately in `tools/pdf-export-audit.json`.

The automated result covers desktop Chrome, not physical phones or other desktop browsers. `export()` confirms preparation and print invocation, not that the user actually saved a file. No Tier 2 implementation is built without approval.
