import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
  Navigate,
} from "react-router-dom";
import { renderCv } from "./renderer.jsx";
import { pdfExporter } from "./pdf/PdfExporter.jsx";
import { ClickToEdit, useTouchEditing } from "./editing/ClickToEdit.jsx";
import { useDataHistory } from "./editing/history.js";
import "./studio.css";
import "./document.css";
import { labelFor, fieldPrompt, descriptionFor, uiCopy } from "./labels.js";
const strings = {
  en: {
    gallery: "Find your next chapter.",
    intro: "Choose a design. Make it yours.",
    templates: "CV templates",
    chat: "Chat",
    preview: "Preview",
    edit: "Edit CV",
    add: "Add section",
    change: "Change template",
    download: "Download PDF",
    reset: "Start over",
    back: "All templates",
    saved: "Saved on this device",
    send: "Save answer",
    close: "Close",
    language: "Language",
    pick: "Add to your story",
    remove: "Remove",
    up: "Move up",
    down: "Move down",
    rename: "Rename",
    newItem: "Add entry",
    invalid: "That template is no longer available. Choose another design.",
    loading: "Loading…",
    question: "Let’s begin with your full name.",
    start: "Your CV is ready to edit. Select a detail below, or add a section.",
    print:
      "Choose “Save as PDF” in your browser’s print dialog. Use A4, 100% scale, and enable backgrounds.",
    sample: "Illustrative sample details. Replace them with your own.",
    empty: "No templates found. Add a numbered template folder and rebuild.",
  },
  ps: {
    gallery: "ستاسو د راتلونکي فصل پیل.",
    intro: "یوه بڼه غوره کړئ او خپله یې کړئ.",
    templates: "د ژوندلیک بڼې",
    chat: "خبرې",
    preview: "مخکتنه",
    edit: "ژوندلیک سمول",
    add: "برخه زیاتول",
    change: "بڼه بدلول",
    download: "PDF ښکته کول",
    reset: "له سره پیل",
    back: "ټولې بڼې",
    saved: "په دې وسیله خوندي شو",
    send: "ځواب خوندي کول",
    close: "بندول",
    language: "ژبه",
    pick: "خپلې کیسې ته برخه زیاته کړئ",
    remove: "لرې کول",
    up: "پورته",
    down: "ښکته",
    rename: "نوم بدلول",
    newItem: "نوې لیکنه",
    invalid: "دا بڼه نشته. بله بڼه غوره کړئ.",
    loading: "بارېږي…",
    question: "ستاسو بشپړ نوم څه دی؟",
    start: "ستاسو ژوندلیک چمتو دی. یوه برخه وټاکئ او سمه یې کړئ.",
    print: "د چاپ په کړکۍ کې Save as PDF او A4 وټاکئ.",
    sample: "دا بېلګه ده. خپل معلومات ولیکئ.",
    empty: "هیڅ بڼه ونه موندل شوه.",
  },
  fa: {
    gallery: "فصل بعدی شما از اینجا آغاز می‌شود.",
    intro: "یک طرح انتخاب کنید و آن را از خود بسازید.",
    templates: "قالب‌های رزومه",
    chat: "گفتگو",
    preview: "پیش‌نمایش",
    edit: "ویرایش رزومه",
    add: "افزودن بخش",
    change: "تغییر قالب",
    download: "دانلود PDF",
    reset: "شروع دوباره",
    back: "همه قالب‌ها",
    saved: "در این دستگاه ذخیره شد",
    send: "ذخیره پاسخ",
    close: "بستن",
    language: "زبان",
    pick: "به داستان خود بیفزایید",
    remove: "حذف",
    up: "بالا",
    down: "پایین",
    rename: "تغییر نام",
    newItem: "افزودن مورد",
    invalid: "این قالب دیگر موجود نیست. طرح دیگری انتخاب کنید.",
    loading: "در حال بارگیری…",
    question: "نام کامل شما چیست؟",
    start: "رزومه شما آماده ویرایش است. یک بخش را انتخاب کنید.",
    print: "در پنجره چاپ Save as PDF و A4 را انتخاب کنید.",
    sample: "اطلاعات نمونه است. اطلاعات خود را وارد کنید.",
    empty: "هیچ قالبی یافت نشد.",
  },
};
const storeKey = "cv-studio-v3";
function restore() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || {};
  } catch {
    return {};
  }
}
const initial = restore();
const cache = new Map();
async function loadTemplate(id) {
  if (!cache.has(id))
    cache.set(
      id,
      fetch(`/templates/${id}/template.json`).then((r) => {
        if (!r.ok)
          throw Error("Template could not be loaded. Rebuild the manifest.");
        return r.json();
      }),
    );
  return cache.get(id);
}
function useTemplate(id) {
  const [value, setValue] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setValue(null);
    setError("");
    loadTemplate(id)
      .then((t) => {
        if (active) setValue(t);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);
  return [value, error];
}
function TemplateStyle({ id, onLoad }) {
  const [fontsReady, setFontsReady] = useState(false),
    [styleReady, setStyleReady] = useState(false);
  useEffect(() => {
    if (fontsReady && styleReady) onLoad?.();
  }, [fontsReady, styleReady]);
  return (
    <>
      <link
        rel="stylesheet"
        href="/fonts/fonts.css"
        onLoad={() => setFontsReady(true)}
      />
      <link
        rel="stylesheet"
        href={`/templates/${id}/template.css`}
        onLoad={() => setStyleReady(true)}
      />
    </>
  );
}
function App() {
  const [data, setData, history] = useDataHistory(initial.data || null);
  const [manifest, setManifest] = useState(null),
    [defs, setDefs] = useState(null),
    [language, setLanguage] = useState(
      ["en", "ps", "fa"].includes(initial.language) ? initial.language : "en",
    ),
    [storageError, setStorageError] = useState("");
  const t = strings[language],
    direction = language === "en" ? "ltr" : "rtl";
  useEffect(() => {
    fetch("/manifest.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest([]));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    try {
      localStorage.setItem(storeKey, JSON.stringify({ data, language }));
      setStorageError("");
    } catch {
      setStorageError(
        "Autosave is unavailable. Keep this tab open or download your CV before leaving.",
      );
    }
  }, [data, language]);
  const context = {
    manifest,
    defs,
    setDefs,
    data,
    setData,
    history,
    language,
    t,
    direction,
  };
  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          cv<span>studio</span>
          <i>●</i>
        </Link>
        <label className="app-language">
          <span>{t.language}</span>
          <select
            aria-label="App language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="ps">پښتو</option>
            <option value="fa">دری</option>
          </select>
        </label>
      </header>
      {storageError && (
        <p role="status" className="notice">
          {storageError}
        </p>
      )}
      <Routes>
        <Route path="/" element={<Gallery {...context} />} />
        <Route path="/edit/:templateId" element={<Editor {...context} />} />
        <Route
          path="/render/:templateId"
          element={<RenderRoute {...context} />}
        />
        <Route
          path="*"
          element={<Navigate to="/" replace state={{ invalid: true }} />}
        />
      </Routes>
    </>
  );
}
function Gallery({ manifest, t, language }) {
  const location = useLocation();
  useEffect(() => {
    if (manifest) performance.mark("gallery-ready");
  }, [manifest]);
  return (
    <main className="gallery">
      <div className="gallery-intro">
        <p className="app-eyebrow">{uiCopy[language].eyebrow}</p>
        <h1>{t.gallery}</h1>
        <p>{t.intro}</p>
      </div>
      {location.state?.invalid && (
        <p role="status" className="notice">
          {t.invalid}
        </p>
      )}
      <div className="gallery-heading">
        <h2>{t.templates}</h2>
        <span>
          {manifest?.length ?? "…"} {uiCopy[language].designs}
        </span>
      </div>
      <div className="template-grid">
        {manifest?.map((m) => (
          <Link
            key={m.id}
            to={`/edit/${m.id}`}
            className="template-card"
            data-template-card={m.id}
          >
            <div className="thumbnail">
              <img
                src={m.thumbnail}
                alt={`${m.displayName} CV preview`}
                loading="lazy"
                decoding="async"
                width="280"
                height="396"
              />
            </div>
            <div className="card-caption">
              <div>
                <h3>{m.displayName}</h3>
                <p>
                  {m.pageCount} A4{" "}
                  {m.pageCount === 1
                    ? uiCopy[language].page
                    : uiCopy[language].pages}
                </p>
              </div>
              <span aria-hidden="true">↗</span>
            </div>
          </Link>
        ))}
      </div>
      {manifest?.length === 0 && <p>{t.empty}</p>}
    </main>
  );
}
function Editor(props) {
  const { templateId } = useParams(),
    { manifest } = props;
  if (!manifest) return <p className="notice">{props.t.loading}</p>;
  if (!manifest.some((m) => m.id === templateId))
    return <Navigate to="/" replace state={{ invalid: true }} />;
  return <EditorLoaded {...props} id={templateId} key={templateId} />;
}
function EditorLoaded({
  id,
  defs,
  setDefs,
  data,
  setData,
  language,
  t,
  direction,
  history,
}) {
  const [template, error] = useTemplate(id),
    [cssReady, setCssReady] = useState(false),
    [tab, setTab] = useState("preview"),
    [chatOpen, setChatOpen] = useState(false),
    [touchEnabled, setTouchEnabled] = useState(false),
    [editingField, setEditingField] = useState(false),
    [limits, setLimits] = useState(null),
    [picker, setPicker] = useState(false),
    [question, setQuestion] = useState(null),
    [answer, setAnswer] = useState(""),
    [messages, setMessages] = useState([]),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [previewError, setPreviewError] = useState(""),
    [pdfBusy, setPdfBusy] = useState(false),
    [pdfProgress, setPdfProgress] = useState("");
  const touch = useTouchEditing();
  useEffect(() => {
    fetch("/editing.json")
      .then((r) => r.json())
      .then((v) => setLimits(v.fieldLimits));
  }, []);
  useEffect(() => {
    if (!defs)
      fetch("/sections.json")
        .then((r) => r.json())
        .then(setDefs);
  }, []);
  useEffect(() => {
    if (template && !data) setData(structuredClone(template.sample));
  }, [template]);
  const record = data ? { ...data, language, direction } : null;
  const patch = (changes) => setData((d) => ({ ...d, ...changes }));
  function ask(key, label, value, kind = "text", extra = {}) {
    setQuestion({ key, label, kind, ...extra });
    setAnswer(kind === "json" ? JSON.stringify(value, null, 2) : value || "");
    setTab("chat");
    setChatOpen(true);
  }
  const coreFields = {
    jobs: [
      ["title", "What was your job title?"],
      ["organization", "Which organization did you work for?"],
      ["dates", "When did you work there?"],
      [
        "bullets",
        "What did you achieve? Enter 2–4 achievements, one per line.",
      ],
    ],
    education: [
      ["degree", "What degree or qualification did you earn?"],
      ["institution", "Which institution did you attend?"],
      ["year", "What year did you graduate?"],
    ],
  };
  function askCore(key, label) {
    if (coreFields[key]) {
      const [field, prompt] = coreFields[key][0];
      ask(field, prompt, data[key]?.[0]?.[field], "text", {
        collection: key,
        itemIndex: 0,
        fieldIndex: 0,
      });
    } else if (key === "skills")
      ask(
        key,
        "Which skills are relevant to your next role? Enter one per line.",
        data.skills?.join("\n"),
        "lines",
      );
    else ask(key, label, data[key], key === "summary" ? "multiline" : "text");
  }
  function add(type) {
    if ((data.optionalSections || []).length >= 80) {
      setNotice("Choose up to 80 optional sections.");
      return;
    }
    const def = defs[type],
      s = { id: crypto.randomUUID(), type, items: [] };
    patch({ optionalSections: [...(data.optionalSections || []), s] });
    setPicker(false);
    startItem(s, 0);
  }
  function startItem(s, index) {
    const fields = Object.entries(defs[s.type].fields);
    const [key, f] = fields[0];
    ask(key, f.question || f.label, s.items[index]?.[key], f.type, {
      sectionId: s.id,
      itemIndex: index,
      fieldIndex: 0,
    });
  }
  function commit(value = answer) {
    if (!question) return;
    const q = question;
    try {
      if (
        !q.sectionId &&
        q.key === "portfolio" &&
        value &&
        !/^https?:\/\//i.test(value)
      )
        throw Error("Use a link starting with https://.");
      if (q.collection) {
        let v = value;
        if (q.key === "bullets") {
          v = String(value)
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (v.length < 2 || v.length > 4)
            throw Error("Enter 2–4 achievements, one per line.");
        } else if (!String(value).trim())
          throw Error("Please enter this detail.");
        const entries = [...(data[q.collection] || [])];
        entries[q.itemIndex] = { ...entries[q.itemIndex], [q.key]: v };
        patch({ [q.collection]: entries });
        const fields = coreFields[q.collection],
          nextField = q.fieldIndex + 1;
        let index = q.itemIndex,
          field = nextField;
        if (field === fields.length) {
          index++;
          field = 0;
        }
        if (index < entries.length) {
          const [key, prompt] = fields[field];
          ask(
            key,
            prompt,
            Array.isArray(entries[index][key])
              ? entries[index][key].join("\n")
              : entries[index][key],
            "text",
            { collection: q.collection, itemIndex: index, fieldIndex: field },
          );
        } else {
          setQuestion(null);
          setAnswer("");
        }
      } else if (q.sectionId) {
        const section = data.optionalSections.find((s) => s.id === q.sectionId),
          def = defs[section.type],
          fields = Object.entries(def.fields),
          f = fields[q.fieldIndex][1];
        if (f.required && !String(value).trim())
          throw Error(`${f.label} is required.`);
        if (f.maxLength && value.length > f.maxLength)
          throw Error(`Maximum ${f.maxLength} characters.`);
        if (f.type === "url" && value && !/^https?:\/\//i.test(value))
          throw Error("Use a link starting with https://.");
        if (
          f.type === "number" &&
          (!Number.isFinite(Number(value)) ||
            Number(value) < 0 ||
            Number(value) > 100)
        )
          throw Error("Enter a number from 0 to 100.");
        const items = [...section.items];
        items[q.itemIndex] = {
          ...items[q.itemIndex],
          [q.key]: f.type === "number" ? Number(value) : value,
        };
        patch({
          optionalSections: data.optionalSections.map((s) =>
            s.id === q.sectionId ? { ...s, items } : s,
          ),
        });
        if (q.fieldIndex + 1 < fields.length) {
          const [key, next] = fields[q.fieldIndex + 1];
          setQuestion({
            ...q,
            key,
            label: next.question || next.label,
            kind: next.type,
            fieldIndex: q.fieldIndex + 1,
          });
          setAnswer(items[q.itemIndex]?.[key] || "");
        } else {
          setQuestion(null);
          setAnswer("");
        }
      } else {
        let v =
          q.kind === "lines"
            ? String(value)
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : value;
        patch({ [q.key]: v });
        setQuestion(null);
        setAnswer("");
      }
      setMessages((m) => [
        ...m.slice(-5),
        {
          label: q.label,
          value:
            q.kind === "image" ? "Image uploaded" : String(value).slice(0, 180),
        },
      ]);
      setNotice("");
    } catch (e) {
      setNotice(e.message);
    }
  }
  function updateSection(id, fn) {
    patch({
      optionalSections: data.optionalSections.map((s) =>
        s.id === id ? fn(s) : s,
      ),
    });
  }
  function removeSection(id) {
    if (question?.sectionId === id) setQuestion(null);
    patch({
      optionalSections: data.optionalSections.filter((s) => s.id !== id),
    });
  }
  function move(id, amount) {
    const list = [...data.optionalSections],
      i = list.findIndex((s) => s.id === id),
      j = i + amount;
    if (j >= 0 && j < list.length) {
      [list[i], list[j]] = [list[j], list[i]];
      patch({ optionalSections: list });
    }
  }
  async function upload(file) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setNotice("Choose a PNG, JPEG or WebP up to 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => commit(reader.result);
    reader.readAsDataURL(file);
  }
  if (error) return <Navigate to="/" replace state={{ invalid: true }} />;
  if (!template || !record || !defs)
    return <p className="notice">{t.loading}</p>;
  return (
    <>
      <TemplateStyle id={id} onLoad={() => setCssReady(true)} />
      <div className="editor-toolbar">
        <Link to="/">← {t.back}</Link>
        <div>
          {touch && (
            <button
              aria-pressed={touchEnabled}
              onClick={() => {
                setTouchEnabled((v) => !v);
                setTab("preview");
                setChatOpen(false);
              }}
            >
              {touchEnabled
                ? language === "ps"
                  ? "بشپړ"
                  : language === "fa"
                    ? "انجام شد"
                    : "Done"
                : t.edit}
            </button>
          )}
          <button
            aria-expanded={chatOpen}
            onClick={() => {
              setChatOpen((v) => !v);
              setTab("chat");
            }}
          >
            {t.chat}
          </button>
          <button
            aria-label="Undo"
            disabled={!history.canUndo || editingField}
            onClick={history.undo}
          >
            ↶ Undo
          </button>
          <button
            aria-label="Redo"
            disabled={!history.canRedo || editingField}
            onClick={history.redo}
          >
            ↷ Redo
          </button>
          <button className="primary" onClick={() => setPicker(true)}>
            ＋ {t.add}
          </button>
          <Link className="button" to="/">
            {t.change}
          </Link>
          <button
            disabled={!!previewError || pdfBusy || (touch && editingField)}
            aria-busy={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              setNotice(t.print);
              try {
                await pdfExporter.export({
                  template,
                  data: record,
                  definitions: defs,
                  onProgress: setPdfProgress,
                });
              } catch (error) {
                setNotice(error.message);
              } finally {
                setPdfBusy(false);
                setPdfProgress("");
              }
            }}
          >
            {pdfBusy ? pdfProgress || "Preparing PDF…" : t.download}
          </button>
        </div>
      </div>
      {notice && !chatOpen && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <div className="mobile-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "chat"}
          onClick={() => {
            setTab("chat");
            setChatOpen(true);
          }}
        >
          {t.chat}
        </button>
        <button
          role="tab"
          aria-selected={tab === "preview"}
          onClick={() => {
            setTab("preview");
            setChatOpen(false);
          }}
        >
          {t.preview}
        </button>
      </div>
      <main className="editor click-editor" data-mobile-tab={tab}>
        {chatOpen && (
          <button
            className="chat-scrim"
            aria-label="Close chat"
            onClick={() => {
              setChatOpen(false);
              setTab("preview");
            }}
          />
        )}
        <aside className="chat-panel" hidden={!chatOpen}>
          <button
            onClick={() => {
              setChatOpen(false);
              setTab("preview");
            }}
          >
            {t.close}
          </button>
          <div className="app-panel-title">
            <div>
              <p className="app-eyebrow">{uiCopy[language].editorEyebrow}</p>
              <h1>{t.edit}</h1>
            </div>
            <span className="save-status">● {t.saved}</span>
          </div>
          <p className="app-muted">{t.start}</p>
          <p className="sample-note">{t.sample}</p>
          <div className="detail-buttons">
            {[
              ["name", "Full name"],
              ["role", "Target role"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["city", "City / country"],
              ["portfolio", "LinkedIn / portfolio"],
              ["summary", "Professional summary"],
              ["jobs", "Work experience"],
              ["education", "Education"],
              ["skills", "Skills"],
            ].map(([key, label]) => (
              <button key={key} onClick={() => askCore(key, label)}>
                {labelFor(language, key, label)} <span>↗</span>
              </button>
            ))}
          </div>
          <div className="conversation" aria-live="polite">
            {messages.map((m, i) => (
              <div className="message" key={i}>
                <small>{m.label}</small>
                <p>{m.value}</p>
              </div>
            ))}
          </div>
          {question && (
            <form
              className="question"
              onSubmit={(e) => {
                e.preventDefault();
                commit();
              }}
            >
              <label htmlFor="answer">
                {fieldPrompt(language, question.label)}
              </label>
              {question.kind === "image" ? (
                <input
                  id="answer"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => upload(e.target.files[0])}
                />
              ) : (
                <>
                  <textarea
                    id="answer"
                    value={answer}
                    rows={question.kind === "json" ? 12 : 3}
                    onChange={(e) => setAnswer(e.target.value)}
                    maxLength={
                      question.sectionId
                        ? defs[
                            data.optionalSections.find(
                              (s) => s.id === question.sectionId,
                            ).type
                          ].fields[question.key].maxLength
                        : 100000
                    }
                  />
                  {question.kind === "json" && (
                    <small>
                      Edit the structured entries below. Keep field names and
                      quotation marks.
                    </small>
                  )}
                  <button className="primary" type="submit">
                    {t.send} →
                  </button>
                </>
              )}
              <button type="button" onClick={() => setQuestion(null)}>
                {t.close}
              </button>
            </form>
          )}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          {previewError && (
            <p role="alert" className="notice">
              {previewError}
            </p>
          )}
          <div className="selected-sections">
            {(data.optionalSections || []).map((s, i) => (
              <section key={s.id} className="section-editor">
                <h2>
                  {s.title || labelFor(language, s.type, defs[s.type]?.title)}
                </h2>
                <div className="section-actions">
                  <button
                    aria-label={`${t.up} ${s.title || s.type}`}
                    disabled={i === 0}
                    onClick={() => move(s.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${t.down} ${s.title || s.type}`}
                    disabled={i === data.optionalSections.length - 1}
                    onClick={() => move(s.id, 1)}
                  >
                    ↓
                  </button>
                  <button onClick={() => removeSection(s.id)}>
                    {t.remove}
                  </button>
                </div>
                {s.type === "custom" && (
                  <label>
                    {t.rename}
                    <input
                      aria-label="Custom section name"
                      value={s.title || ""}
                      maxLength={80}
                      onChange={(e) =>
                        updateSection(s.id, (x) => ({
                          ...x,
                          title: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}
                {s.items.map((item, n) => (
                  <button
                    className="entry-button"
                    key={n}
                    onClick={() => startItem(s, n)}
                  >
                    {Object.values(item).find(
                      (v) => typeof v === "string" && !v.startsWith("data:"),
                    ) || `Entry ${n + 1}`}{" "}
                    ✎
                  </button>
                ))}
                <button
                  onClick={() => startItem(s, s.items.length)}
                  disabled={s.items.length >= defs[s.type].maxItems}
                >
                  ＋ {t.newItem}
                </button>
              </section>
            ))}
          </div>
          <button
            className="reset"
            onClick={() => {
              setData({
                ...structuredClone(template.sample),
                optionalSections: [],
              });
              setQuestion(null);
              setMessages([]);
              setNotice("Started a fresh CV.");
            }}
          >
            {t.reset}
          </button>
        </aside>
        <section className="preview-panel" aria-label="Live CV preview">
          {cssReady && limits && (
            <ClickToEdit
              template={template}
              data={record}
              definitions={defs}
              limits={limits}
              setData={setData}
              touch={touch}
              enabled={!touch || touchEnabled}
              history={history}
              onError={setPreviewError}
              onEditingChange={setEditingField}
            />
          )}
        </section>
      </main>
      {picker && (
        <div className="modal-backdrop" onClick={() => setPicker(false)}>
          <section
            className="section-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="picker-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="picker-title">
              <h2 id="picker-heading">{t.pick}</h2>
              <button onClick={() => setPicker(false)} aria-label={t.close}>
                ×
              </button>
            </div>
            <input
              autoFocus
              placeholder={uiCopy[language].search}
              aria-label="Search sections"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="picker-grid">
              {Object.entries(defs)
                .filter(([, d]) =>
                  (d.title + " " + d.description)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map(([type, def]) => (
                  <button
                    key={type}
                    data-add-section={type}
                    onClick={() => add(type)}
                  >
                    <strong>
                      {labelFor(language, type, def.title)} <span>＋</span>
                    </strong>
                    <small>
                      {descriptionFor(language, type, def.description)}
                    </small>
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function RenderRoute({ manifest, defs, setDefs }) {
  const { templateId } = useParams(),
    [template] = useTemplate(templateId),
    [ready, setReady] = useState(false);
  const params = new URLSearchParams(location.search);
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/sections.json")
      .then((r) => r.json())
      .then(setDefs);
    window.cvRender = { setData, ready: false };
    return () => {
      delete window.cvRender;
    };
  }, []);
  if (!manifest || !template || !defs) return null;
  const record = data || template.sample;
  return (
    <>
      <TemplateStyle id={templateId} onLoad={() => setReady(true)} />
      <main className="render-only">
        {ready &&
          renderCv({
            template,
            data: record,
            definitions: defs,
            onReady: () => {
              window.cvRender.ready = true;
            },
          })}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
