import React from "react";
import { createRoot } from "react-dom/client";
import { renderCv } from "../renderer.jsx";
import { PDF_EXPORT_STRATEGY } from "./config.js";

export function suggestedPdfName(fullName) {
  const name = String(fullName || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .slice(0, 120)
    .trim();
  return name ? `${name}_CV.pdf` : "CV.pdf";
}
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));
export function cleanSnapshot(source) {
  const clone = source.cloneNode(true);
  clone
    .querySelectorAll(".cv-measure,script,button,input,textarea,select,iframe")
    .forEach((node) => node.remove());
  for (const element of [clone, ...clone.querySelectorAll("*")]) {
    if (element.hasAttribute("data-field")) {
      element.removeAttribute("role");
      element.removeAttribute("aria-label");
    }
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name.startsWith("data-") ||
        attribute.name.startsWith("on") ||
        ["contenteditable", "spellcheck", "tabindex"].includes(attribute.name)
      )
        element.removeAttribute(attribute.name);
    }
  }
  return clone;
}

/** Interface: prepare(request) -> { frame, filename, print(), dispose() }.
 * Preparation is separate so automated tests print the exact same script-free
 * document through Chrome's PDF API instead of opening an OS dialog.
 */
export class PdfExporter {
  constructor(strategies, selectedStrategy) {
    this.strategies = strategies;
    this.selectedStrategy = selectedStrategy;
  }
  prepare(request) {
    const strategy = this.strategies[this.selectedStrategy];
    if (!strategy)
      throw new Error(
        `PDF strategy is not installed: ${this.selectedStrategy}`,
      );
    return strategy.prepare(request);
  }
  async export(request) {
    const prepared = await this.prepare(request);
    try {
      await prepared.print();
      return { filename: prepared.filename, method: this.selectedStrategy };
    } catch (error) {
      prepared.dispose();
      throw error;
    }
  }
}

export class BrowserPrintStrategy {
  async prepare({ template, data, definitions, onProgress = () => {} }) {
    this.activePrepared?.dispose();
    onProgress("Preparing PDF…");
    const filename = suggestedPdfName(data.name),
      host = document.createElement("div");
    host.className = "pdf-preparation";
    Object.assign(host.style, {
      position: "fixed",
      insetInlineStart: "-100000px",
      insetBlockStart: "0",
      width: "210mm",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.append(host);
    const root = createRoot(host);
    let frame,
      layoutError = "";
    const cleanupHost = () => {
      root.unmount();
      host.remove();
    };
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(new Error("PDF layout preparation timed out. Try again.")),
          45000,
        );
        root.render(
          renderCv({
            template,
            data: structuredClone(data),
            definitions,
            onError: (message) => {
              layoutError = message;
            },
            onReady: () => {
              clearTimeout(timer);
              layoutError ? reject(new Error(layoutError)) : resolve();
            },
          }),
        );
      });
      await document.fonts.ready;
      await nextFrame();
      await nextFrame();
      const cv = host.querySelector(".cv-render");
      if (!cv) throw new Error("The CV is not ready to print.");
      const sheetCount = cv.querySelectorAll(
        ":scope>.opt-sheet,.a4-page,.cv-page",
      ).length;
      const snapshot = cleanSnapshot(cv);
      frame = document.createElement("iframe");
      frame.title = "Prepared CV print document";
      frame.setAttribute("aria-hidden", "true");
      Object.assign(frame.style, {
        position: "fixed",
        insetInlineStart: "-100000px",
        insetBlockStart: "0",
        width: "210mm",
        height: "297mm",
        border: "0",
      });
      document.body.append(frame);
      const doc = frame.contentDocument;
      doc.open();
      doc.write(
        '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>',
      );
      doc.close();
      doc.documentElement.lang = data.language || "en";
      doc.documentElement.dir = data.direction || "ltr";
      doc.title = filename.replace(/\.pdf$/i, "");
      const links = [`/templates/${template.id}/template.css`, "/pdf/a4.css"];
      await Promise.all(
        links.map(
          (href) =>
            new Promise((resolve, reject) => {
              const link = doc.createElement("link");
              link.rel = "stylesheet";
              link.href = href;
              link.onload = resolve;
              link.onerror = () =>
                reject(new Error(`Cannot load print styles: ${href}`));
              doc.head.append(link);
            }),
        ),
      );
      doc.body.append(doc.importNode(snapshot, true));
      onProgress("Loading fonts…");
      doc.body.offsetHeight;
      await doc.fonts.ready;
      if (![...doc.fonts].some((font) => font.family.includes("CV Arabic")))
        throw new Error(
          "The local font stylesheet is unavailable. Reload and try again.",
        );
      if ([...doc.fonts].some((font) => font.status === "error"))
        throw new Error(
          "A required font could not be loaded. Try again before exporting.",
        );
      const broken = await Promise.all(
        [...doc.images].map((image) =>
          image
            .decode()
            .then(() => false)
            .catch(() => true),
        ),
      );
      if (broken.some(Boolean))
        throw new Error(
          "A CV image could not be loaded. Replace it before exporting.",
        );
      await new Promise((resolve) =>
        frame.contentWindow.requestAnimationFrame(() =>
          frame.contentWindow.requestAnimationFrame(resolve),
        ),
      );
      const sheets = [...doc.querySelectorAll(".a4-page,.cv-page,.opt-sheet")];
      if (sheets.length !== sheetCount)
        throw new Error("Print page count differs from the prepared CV.");
      if (
        doc.querySelector(
          "script,button,input,textarea,[contenteditable],[data-bind]",
        )
      )
        throw new Error("Editor markup reached the print document.");
      cleanupHost();
      onProgress("Choose Save as PDF");
      let disposed = false,
        restoreTitle;
      const dispose = () => {
        if (!disposed) {
          disposed = true;
          restoreTitle?.();
          frame.remove();
        }
      };
      const prepared = {
        frame,
        filename,
        sheetCount,
        dispose,
        async print() {
          const previousTitle = document.title,
            suggestedTitle = filename.replace(/\.pdf$/i, "");
          document.title = suggestedTitle;
          restoreTitle = () => {
            if (document.title === suggestedTitle)
              document.title = previousTitle;
          };
          // Keep the frame alive after print() returns: Safari may print asynchronously.
          frame.contentWindow.addEventListener(
            "afterprint",
            () => setTimeout(dispose, 1000),
            { once: true },
          );
          frame.contentWindow.focus();
          frame.contentWindow.print();
        },
      };
      this.activePrepared = prepared;
      return prepared;
    } catch (error) {
      cleanupHost();
      frame?.remove();
      throw error;
    }
  }
}
export const pdfExporter = new PdfExporter(
  { "browser-print": new BrowserPrintStrategy() },
  PDF_EXPORT_STRATEGY,
);
