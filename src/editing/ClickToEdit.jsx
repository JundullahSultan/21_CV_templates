import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { renderCv } from "../renderer.jsx";
import {
  readField,
  writeField,
  plainText,
  fieldLimit,
  elementText,
} from "./data.js";
import { DatePicker } from "./DatePicker.jsx";
import "./editing.css";

export function useTouchEditing() {
  const query = "(min-width: 1000px) and (pointer: fine) and (hover: hover)";
  const [touch, setTouch] = useState(() => !matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query),
      update = () => setTouch(!media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return touch;
}
export function ClickToEdit({
  template,
  data,
  definitions,
  limits,
  setData,
  touch,
  enabled,
  history,
  onError,
  onEditingChange,
}) {
  const container = useRef(null),
    canvas = useRef(null),
    active = useRef(null),
    gesture = useRef(null),
    [scale, setScale] = useState(1),
    [height, setHeight] = useState(1123),
    [field, setField] = useState(null),
    [draft, setDraft] = useState(""),
    [pending, setPending] = useState(null);
  const limit = (path) => fieldLimit(path, data, definitions, limits);
  const valueFor = (path) =>
    readField(data, path) ?? template.editableDefaults?.[path];
  const fieldLabel = (path) => {
    if (path.startsWith("templateText.")) return "CV text";
    const keys = path.split("."),
      last = keys.at(-1);
    if (path.startsWith("optionalSections."))
      return (
        definitions[data.optionalSections[keys[1]].type]?.fields[last]?.label ||
        "Section text"
      );
    return /\.bullets\.\d+$/.test(path)
      ? "Achievement"
      : /^skills\./.test(path)
        ? "Skill"
        : {
            name: "Full name",
            role: "Target role",
            phone: "Phone",
            email: "Email",
            city: "City / country",
            portfolio: "LinkedIn / portfolio",
            summary: "Professional summary",
            title: "Job title",
            organization: "Organization",
            degree: "Degree",
            institution: "Institution",
          }[last] || "CV text";
  };
  const cancelDesktop = () => {
    const a = active.current;
    if (!a) return;
    active.current = null;
    a.element.replaceChildren(a.original);
    a.element.removeAttribute("contenteditable");
    a.element.removeAttribute("data-edit-active");
    onEditingChange(false);
  };
  const commitDesktop = () => {
    const a = active.current;
    if (!a) return;
    let value = plainText(elementText(a.element)).slice(0, limit(a.path));
    if (typeof readField(data, a.path) === "number")
      value = Math.max(0, Math.min(100, Number(value) || 0));
    cancelDesktop();
    setData((d) => writeField(d, a.path, value));
  };
  const close = (save) => {
    if (save)
      setData((d) =>
        writeField(
          d,
          field.path,
          field.number
            ? Math.max(0, Math.min(100, Number(draft) || 0))
            : plainText(draft).slice(0, limit(field.path)),
        ),
      );
    setField(null);
    onEditingChange(false);
  };
  useEffect(() => {
    cancelDesktop();
    setField(null);
    onEditingChange(false);
  }, [enabled, touch]);
  useEffect(
    () => () => {
      const a = active.current;
      if (a) {
        a.element.replaceChildren(a.original);
        a.element.removeAttribute("contenteditable");
      }
    },
    [],
  );
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const width = container.current.clientWidth,
        cv = canvas.current.querySelector(".cv-render");
      setScale(width / ((210 * 96) / 25.4));
      if (cv) setHeight(cv.offsetHeight);
    });
    observer.observe(container.current);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      const el = canvas.current?.querySelector(`[data-field="${pending}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        start(el);
      }
      setPending(null);
    }, 120);
    return () => clearTimeout(timer);
  }, [pending, data]);
  useEffect(() => {
    const key = (e) => {
      if (
        touch ||
        !(e.ctrlKey || e.metaKey) ||
        e.altKey ||
        !["z", "y"].includes(e.key.toLowerCase())
      )
        return;
      if (
        e.target.closest("input,textarea,select") ||
        (e.target.isContentEditable && !active.current)
      )
        return;
      e.preventDefault();
      commitDesktop();
      if (e.key.toLowerCase() === "y" || e.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function start(element) {
    if (!enabled || element.closest(".cv-measure")) return;
    const path = element.dataset.field,
      value = valueFor(path);
    if (value === undefined || typeof value === "object") return;
    if (active.current?.element === element) return;
    commitDesktop();
    if (/\.(dates|year)$/.test(path)) {
      setField({ path, date: true });
      onEditingChange(true);
      return;
    }
    if (touch) {
      setDraft(String(value));
      setField({ path, number: typeof value === "number" });
      onEditingChange(true);
      return;
    }
    const original = document.createDocumentFragment();
    while (element.firstChild) original.append(element.firstChild);
    active.current = { path, element, original };
    element.textContent = String(value);
    element.contentEditable = "true";
    element.dataset.editActive = "true";
    element.dir = "auto";
    element.focus();
    const selection = getSelection(),
      range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    onEditingChange(true);
  }
  function bullet(action) {
    const path = active.current?.path || field?.path;
    if (!/\.bullets\.\d+$/.test(path || "")) return false;
    const index = Number(path.split(".").at(-1)),
      listPath = path.split(".").slice(0, -1).join(".");
    const text = active.current
      ? plainText(elementText(active.current.element))
      : draft;
    if (action === "remove" && text) return false;
    cancelDesktop();
    setField(null);
    onEditingChange(false);
    setData((d) => {
      const items = [...readField(d, listPath)];
      items[index] = text.slice(0, limit(path));
      if (action === "add") items.splice(index + 1, 0, "");
      else items.splice(index, 1);
      return writeField(d, listPath, items);
    });
    setPending(
      `${listPath}.${action === "add" ? index + 1 : Math.max(0, index - 1)}`,
    );
    return true;
  }
  function insert(text) {
    const a = active.current;
    if (!a) return;
    const selection = getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!a.element.contains(range.commonAncestorContainer)) return;
    if (!elementText(a.element)) {
      a.element.replaceChildren();
      range.selectNodeContents(a.element);
      range.collapse(true);
    }
    const remaining =
      limit(a.path) -
      (a.element.textContent.length - selection.toString().length);
    range.deleteContents();
    const node = document.createTextNode(
      plainText(text).slice(0, Math.max(0, remaining)),
    );
    range.insertNode(node);
    if (node.textContent.endsWith("\n")) {
      const guard = document.createElement("br");
      guard.dataset.caretGuard = "true";
      a.element.append(guard);
    }
    range.setStart(node, node.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  function nearest(e) {
    let target = e.target.closest("[data-field]");
    if (target && !target.closest(".cv-measure")) return target;
    return [...canvas.current.querySelectorAll("[data-field]")]
      .filter((el) => !el.closest(".cv-measure"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          r,
          d: Math.hypot(
            e.clientX - (r.left + r.width / 2),
            e.clientY - (r.top + r.height / 2),
          ),
        };
      })
      .filter(
        ({ r }) =>
          e.clientX >= r.left - Math.max(0, (44 - r.width) / 2) &&
          e.clientX <= r.right + Math.max(0, (44 - r.width) / 2) &&
          e.clientY >= r.top - Math.max(0, (44 - r.height) / 2) &&
          e.clientY <= r.bottom + Math.max(0, (44 - r.height) / 2),
      )
      .sort((a, b) => a.d - b.d)[0]?.el;
  }
  const shown =
    field && !field.date
      ? writeField(data, field.path, field.number ? Number(draft) : draft)
      : data;
  return (
    <>
      <div
        className="edit-stage"
        ref={container}
        data-edit-enabled={enabled}
        data-touch={touch}
        style={{ height: height * scale, "--edit-scale": scale }}
        onPointerDown={(e) => {
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            id: e.pointerId,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8)
            g.moved = true;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          gesture.current = null;
          if (!g || g.moved || !enabled) return;
          const target = nearest(e);
          if (target) start(target);
        }}
        onClick={(e) => {
          if (e.target.closest("[data-field],a")) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (!active.current) {
            if (
              (e.key === "Enter" || e.key === " ") &&
              e.target.dataset.field
            ) {
              e.preventDefault();
              start(e.target);
            }
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelDesktop();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!bullet("add")) commitDesktop();
          } else if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            insert("\n");
          } else if (e.key === "Backspace" && bullet("remove"))
            e.preventDefault();
        }}
        onBlurCapture={(e) => {
          if (e.target === active.current?.element) commitDesktop();
        }}
        onPaste={(e) => {
          if (active.current) {
            e.preventDefault();
            insert(e.clipboardData.getData("text/plain"));
          }
        }}
        onInput={(e) => {
          if (!active.current || e.nativeEvent.isComposing) return;
          const el = active.current.element,
            v = plainText(elementText(el)).slice(0, limit(active.current.path));
          if (elementText(el) !== v) {
            el.textContent = v;
            const s = getSelection(),
              r = document.createRange();
            r.selectNodeContents(el);
            r.collapse(false);
            s.removeAllRanges();
            s.addRange(r);
          }
        }}
        onCompositionEnd={() => {
          const a = active.current;
          if (a) {
            const value = plainText(elementText(a.element)).slice(
              0,
              limit(a.path),
            );
            if (elementText(a.element) !== value) {
              a.element.textContent = value;
              const selection = getSelection(),
                range = document.createRange();
              range.selectNodeContents(a.element);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        }}
      >
        <div className="edit-canvas" ref={canvas}>
          {renderCv({
            template,
            data: shown,
            definitions,
            builderFields: true,
            onError,
          })}
        </div>
      </div>
      {field?.date && (
        <DatePicker
          key={field.path}
          value={valueFor(field.path)}
          yearOnly={field.path.endsWith(".year")}
          onCancel={() => close(false)}
          onSave={(value) => {
            setData((d) => writeField(d, field.path, value));
            close(false);
          }}
        />
      )}
      {field && !field.date && (
        <div className="field-modal-backdrop bottom-sheet-backdrop">
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Edit field"
            className="field-dialog field-bottom-sheet"
            onSubmit={(e) => {
              e.preventDefault();
              close(true);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Escape") {
                e.preventDefault();
                close(false);
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!bullet("add")) close(true);
              } else if (e.key === "Backspace" && !draft && bullet("remove"))
                e.preventDefault();
            }}
          >
            <label htmlFor="touch-field">{fieldLabel(field.path)}</label>
            <textarea
              id="touch-field"
              dir="auto"
              autoFocus
              value={draft}
              maxLength={limit(field.path)}
              onChange={(e) =>
                setDraft(
                  e.nativeEvent.isComposing
                    ? e.target.value
                    : plainText(e.target.value),
                )
              }
              onCompositionEnd={(e) =>
                setDraft(
                  plainText(e.currentTarget.value).slice(0, limit(field.path)),
                )
              }
              onPaste={(e) => {
                e.preventDefault();
                const el = e.target,
                  a = el.selectionStart,
                  b = el.selectionEnd,
                  text = plainText(e.clipboardData.getData("text/plain"));
                setDraft(
                  (draft.slice(0, a) + text + draft.slice(b)).slice(
                    0,
                    limit(field.path),
                  ),
                );
              }}
            />
            <small>
              {draft.length} / {limit(field.path)} · Shift+Enter for a new line
            </small>
            <div className="field-actions">
              <button type="button" onClick={() => close(false)}>
                Cancel
              </button>
              <button className="primary">Done</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
