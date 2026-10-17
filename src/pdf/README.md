# PDF exporter contract

`PdfExporter` dispatches through one selected strategy. The sole enabled implementation is **browser-print** (Tier 1). Change `PDF_EXPORT_STRATEGY` in `config.js` when another approved implementation has been registered. The editor depends only on `pdfExporter.export(request)` and never chooses a method itself. An unknown strategy fails explicitly; there is no automatic server fallback.

Request: `{ template, data, definitions, onProgress(message) }`. The data object is frozen by cloning during preparation.

- `prepare(request)` resolves to `{ frame, filename, sheetCount, print(), dispose() }` for Tier 1.
- `export(request)` prepares and invokes printing. This does not mean the user saved a file: the browser can cancel or change its filename.
- Automated tests call `prepare`, serialize that exact script-free frame, and use headless Chrome's PDF API on the same HTML/CSS. They do not use a parallel PDF renderer.

Preparation mounts the shared React renderer outside the visible editor, waits for layout and fonts, removes measurement nodes and editor attributes, and builds a static document in an offscreen print iframe. The print document has no JavaScript. Only the parent application calls `print()`. The frame stays alive until `afterprint` or the next export, accommodating asynchronous browsers. Parent and print-document titles suggest `<Full Name>_CV.pdf` (or `CV.pdf`); OS save dialogs can override it.

Styles come from the selected compiled template and `/pdf/a4.css`, which defines A4, zero margins, exact print colors and local fonts. Static font files avoid variable-font glyph outlines. Amiri supplies joined Pashto/Dari and mixed runs, including combining marks; Latin font fallback boundaries are avoided within Arabic-script CVs. Regular/strong Arabic faces and the existing Rubik designs are self-hosted with their licenses in `/fonts`.

Tier 2 (a serverless Chromium endpoint) has not been built or enabled. Adding it requires approval and implementing this contract; it must not be silently activated to conceal a Tier 1 test failure.
