import React, { useLayoutEffect, useRef, useState } from "react";
const get = (data, path) => path?.split(".").reduce((v, k) => v?.[k], data);
const fieldProps = (data, path) =>
  data._builderFields
    ? {
        "data-field": path,
        dir: "auto",
        tabIndex: 0,
        role: "textbox",
        "aria-label": path,
      }
    : {};
const fieldText = (data, path, value = get(data, path)) => (
  <span
    className={`cv-text-value${String(value).includes("\n") ? " cv-multiline" : ""}`}
    {...fieldProps(data, path)}
  >
    {value ?? ""}
  </span>
);
const footerText = (text, data) =>
  data._insidePageFooter
    ? String(text).replace(
        /(\d+)\s*\/\s*\d+\s*$/,
        (_, page) => `${page} / ${data._pageTotal}`,
      )
    : text;
const basePageCount = (nodes) =>
  nodes.reduce(
    (total, n) =>
      total +
      (n?.attrs?.class
        ?.split(/\s+/)
        .some((c) => c === "a4-page" || c === "cv-page")
        ? 1
        : 0) +
      (n?.children ? basePageCount(n.children) : 0),
    0,
  );
const styleObject = (value) =>
  Object.fromEntries(
    (value || "")
      .split(";")
      .filter((s) => s.includes(":"))
      .map((s) => {
        const i = s.indexOf(":");
        let k = s.slice(0, i).trim();
        return [
          k.startsWith("--")
            ? k
            : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
          s
            .slice(i + 1)
            .replace(/!important/g, "")
            .trim(),
        ];
      }),
  );
const attributeNames = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  viewbox: "viewBox",
  "xlink:href": "xlinkHref",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
};
function treeNode(node, data, key, omit) {
  if (typeof node === "string") return footerText(node, data);
  if (!node.tag) {
    if (node.bind && data._builderFields) {
      const parts = node.text.split(node.replace);
      return (
        <React.Fragment key={key}>
          {parts[0]}
          {fieldText(data, node.bind)}
          {parts.slice(1).join(node.replace)}
        </React.Fragment>
      );
    }
    return footerText(
      node.replace
        ? node.text.replaceAll(node.replace, String(get(data, node.bind) ?? ""))
        : node.text,
      data,
    );
  }
  const a = node.attrs || {},
    section = a["data-cv-section"] || a["data-section"];
  if (omit?.includes(section)) return null;
  if (
    a["data-record-type"] &&
    !data[a["data-record-type"]]?.[Number(a["data-record-index"])]
  )
    return null;
  const props = { key };
  for (const [k, v] of Object.entries(a)) {
    if (k === "style") props.style = styleObject(v);
    else if (!k.startsWith("on")) props[attributeNames[k] || k] = v;
  }
  if (a["data-bind"]) {
    Object.assign(props, fieldProps(data, a["data-bind"]));
    props.className = [props.className, "cv-text-value"]
      .filter(Boolean)
      .join(" ");
  }
  if (a["data-edit-bind"])
    Object.assign(props, fieldProps(data, a["data-edit-bind"]));
  if (a["data-edit-path"])
    Object.assign(props, fieldProps(data, a["data-edit-path"]));
  if (
    String(get(data, a["data-bind"] || a["data-edit-path"]) || "").includes(
      "\n",
    )
  )
    props.className = [props.className, "cv-multiline"]
      .filter(Boolean)
      .join(" ");
  if (props["aria-label"] && data._pageTotal)
    props["aria-label"] = props["aria-label"].replace(
      /\bof\s+\d+$/i,
      `of ${data._pageTotal}`,
    );
  const pageFooter = a.class
    ?.split(/\s+/)
    .some((c) => c === "cv-page-footer" || c === "page-footer");
  const childData = pageFooter ? { ...data, _insidePageFooter: true } : data;
  if (
    data._insidePageFooter &&
    node.children?.some((n) =>
      /\d+\s*\/\s*\d+\s*$/.test(typeof n === "string" ? n : n.text || ""),
    )
  )
    props.className = [props.className, "cv-page-counter"]
      .filter(Boolean)
      .join(" ");
  if (/\.(dates|year)$/.test(a["data-bind"] || ""))
    props.className = [props.className, "cv-date-value"]
      .filter(Boolean)
      .join(" ");
  if (a["data-bind"] === "name")
    props.className = [props.className, "cv-field-name"]
      .filter(Boolean)
      .join(" ");
  if (a.class?.split(/\s+/).includes("original-layout")) {
    const scale = props.style?.transform?.match(/scale\(([\d.]+)\)/)?.[1];
    if (scale) props.style = { ...props.style, "--cv-layout-scale": scale };
  }
  if (a["data-href-bind"])
    props.href =
      (a["data-href-bind"] === "email"
        ? "mailto:"
        : a["data-href-bind"] === "phone"
          ? "tel:"
          : "") + (data[a["data-href-bind"]] || "");
  let children;
  if (a["data-edit-path"] && get(data, a["data-edit-path"]) !== undefined) {
    children = String(get(data, a["data-edit-path"]));
    props.className = [props.className, "cv-text-value"]
      .filter(Boolean)
      .join(" ");
  } else if (
    a["data-skills-original"] &&
    a["data-skills-original"] !== JSON.stringify(data.skills)
  )
    children = [
      ...(node.children || [])
        .filter((n) => n.tag === "h2")
        .map((n, i) => treeNode(n, data, i, omit)),
      <ul
        key="skills"
        className="cv-skill-list"
        style={{ paddingInlineStart: 18, fontSize: 12, lineHeight: 1.7 }}
      >
        {data.skills?.map((s, i) => (
          <li key={i} {...fieldProps(data, `skills.${i}`)}>
            {s}
          </li>
        ))}
      </ul>,
    ];
  else if (a["data-bind"] === "name" && String(data.name).includes("\n"))
    children = String(data.name);
  else if (
    a["data-bind"] === "name" &&
    node.children?.some((n) => typeof n === "object" && n.tag)
  ) {
    const text = (n) =>
      typeof n === "string"
        ? n
        : n.text || n.children?.map(text).join("") || "";
    const clean = (s) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
    if (clean(node.children.map(text).join("")) === clean(data.name || ""))
      children = node.children.map((c, i) =>
        treeNode(c, { ...data, _builderFields: false }, i, omit),
      );
    else {
      const parts = String(data.name || "").split(/\s+/),
        first = parts.shift(),
        rest = parts.join(" "),
        formatted = node.children.filter((n) => n.tag && n.tag !== "br");
      children =
        formatted.length === 2
          ? formatted.map((n, i) =>
              React.createElement(
                n.tag,
                { key: i, className: n.attrs?.class },
                i ? rest : first,
              ),
            )
          : [
              first,
              " ",
              React.createElement(
                formatted[0]?.tag || "strong",
                { key: "last", className: formatted[0]?.attrs?.class },
                rest,
              ),
            ];
    }
  } else if (a["data-bind"]) children = String(get(data, a["data-bind"]) ?? "");
  else if (a["data-list-bind"])
    children = (get(data, a["data-list-bind"]) || []).map((v, i) =>
      React.createElement(
        "li",
        {
          key: i,
          className: String(v).includes("\n") ? "cv-multiline" : undefined,
          ...fieldProps(data, `${a["data-list-bind"]}.${i}`),
        },
        v,
      ),
    );
  else children = node.children?.map((c, i) => treeNode(c, childData, i, omit));
  if (
    [
      "img",
      "input",
      "br",
      "hr",
      "meta",
      "source",
      "wbr",
      "area",
      "use",
    ].includes(node.tag)
  )
    return React.createElement(node.tag, props);
  const svgTags = {
    textpath: "textPath",
    lineargradient: "linearGradient",
    radialgradient: "radialGradient",
    clippath: "clipPath",
    foreignobject: "foreignObject",
  };
  return React.createElement(svgTags[node.tag] || node.tag, props, children);
}
const hasContent = (item) =>
  Object.values(item || {}).some(
    (v) => typeof v === "number" || (typeof v === "string" && v.trim()),
  );
function optionalBlocks(data, defs, template, relocated = []) {
  const blocks = [];
  const add = (id, title, entries) => {
    if (entries.length) blocks.push({ id, title, entries });
  };
  const core = (k) => {
    if (k.startsWith("legacy-")) {
      const find = (nodes) => {
        for (const n of nodes) {
          if (n?.attrs?.["data-cv-section"] === k) return n;
          const match = n?.children && find(n.children);
          if (match) return match;
        }
      };
      const node = find(template.tree);
      if (node) {
        const heading = node.children?.find((n) => n?.tag === "h2"),
          text = (n) =>
            typeof n === "string"
              ? n
              : n.text || n.children?.map(text).join("") || "",
          path = heading?.attrs?.["data-edit-path"];
        add(
          k,
          path
            ? fieldText(data, path, get(data, path) ?? text(heading))
            : text(heading || "Additional information"),
          (node.children || [])
            .filter((n) => n !== heading && typeof n === "object" && n.tag)
            .map((n, i) => <div key={i}>{treeNode(n, data, i, [])}</div>),
        );
      }
    }
    if (k === "summary")
      add(k, "Professional summary", [
        <p className="opt-copy">{fieldText(data, "summary")}</p>,
      ]);
    if (k === "contact")
      add(k, "Contact details", [
        <p className="opt-copy">
          {["name", "phone", "email", "city", "portfolio"]
            .filter((k) => data[k])
            .map((k, i) => (
              <React.Fragment key={k}>
                {i ? " · " : ""}
                {fieldText(data, k)}
              </React.Fragment>
            ))}
        </p>,
      ]);
    if (k === "skills")
      add(k, "Skills", [
        <p className="opt-copy">
          {data.skills?.map((s, i) => (
            <React.Fragment key={i}>
              {i ? " · " : ""}
              {fieldText(data, `skills.${i}`, s)}
            </React.Fragment>
          ))}
        </p>,
      ]);
    if (k === "experience")
      add(
        k,
        "Work experience",
        (data.jobs || []).map((j, i) => (
          <div key={i}>
            <h3 className="opt-title">{fieldText(data, `jobs.${i}.title`)}</h3>
            <p className="opt-meta">
              {fieldText(data, `jobs.${i}.organization`)} ·{" "}
              {fieldText(data, `jobs.${i}.dates`)}
            </p>
            <ul className="opt-copy" style={{ paddingInlineStart: 20 }}>
              {j.bullets?.map((b, n) => (
                <li key={n} {...fieldProps(data, `jobs.${i}.bullets.${n}`)}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )),
      );
    if (k === "education")
      add(
        k,
        "Education",
        (data.education || []).map((d, i) => (
          <div key={i}>
            <h3 className="opt-title">
              {fieldText(data, `education.${i}.degree`)}
            </h3>
            <p className="opt-meta">
              {fieldText(data, `education.${i}.institution`)} ·{" "}
              {fieldText(data, `education.${i}.year`)}
            </p>
          </div>
        )),
      );
  };
  relocated.forEach(core);
  if (
    !relocated.includes("experience") &&
    data.jobs?.length > template.jobCount
  )
    add(
      "extra-jobs",
      "Work experience — continued",
      data.jobs.slice(template.jobCount).map((j, i) => (
        <div key={i}>
          <h3 className="opt-title">
            {fieldText(data, `jobs.${i + template.jobCount}.title`)}
          </h3>
          <p className="opt-meta">
            {fieldText(data, `jobs.${i + template.jobCount}.organization`)} ·{" "}
            {fieldText(data, `jobs.${i + template.jobCount}.dates`)}
          </p>
          <ul className="opt-copy" style={{ paddingInlineStart: 20 }}>
            {j.bullets.map((b, n) => (
              <li
                key={n}
                {...fieldProps(
                  data,
                  `jobs.${i + template.jobCount}.bullets.${n}`,
                )}
              >
                {b}
              </li>
            ))}
          </ul>
        </div>
      )),
    );
  if (
    !relocated.includes("education") &&
    data.education?.length > template.educationCount
  )
    add(
      "extra-education",
      "Education — continued",
      data.education.slice(template.educationCount).map((d, i) => (
        <p key={i} className="opt-copy">
          {fieldText(data, `education.${i + template.educationCount}.degree`)} ·{" "}
          {fieldText(
            data,
            `education.${i + template.educationCount}.institution`,
          )}{" "}
          · {fieldText(data, `education.${i + template.educationCount}.year`)}
        </p>
      )),
    );
  for (const [sectionIndex, s] of (data.optionalSections || []).entries()) {
    const def = defs[s.type];
    if (!def || s.enabled === false) continue;
    const items = (s.items || [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => hasContent(item));
    if (!items.length) continue;
    add(
      s.id,
      s.title || def.title,
      items.map(({ item, index }) => (
        <div key={index}>
          {Object.entries(def.fields).map(([k, f]) => {
            const v = item[k];
            const path = `optionalSections.${sectionIndex}.items.${index}.${k}`;
            if (v === undefined || v === "") return null;
            if (f.type === "image")
              return /^data:image\/(png|jpeg|webp);base64,/.test(v) ? (
                <img
                  key={k}
                  className={`opt-image ${s.type === "books" ? "opt-cover" : "opt-signature"}`}
                  src={v}
                  alt={
                    s.type === "signature" ? "Uploaded signature" : "Book cover"
                  }
                />
              ) : null;
            if (f.type === "url")
              return /^https?:\/\//i.test(v) ? (
                <a key={k} className="opt-url" href={v}>
                  {fieldText(data, path, v)}
                </a>
              ) : null;
            if (f.type === "number")
              return (
                <p key={k} className="opt-level">
                  {f.label}: {fieldText(data, path, v)}%
                </p>
              );
            const Tag = f.role === "title" ? "h3" : "p";
            return (
              <Tag
                key={k}
                className={
                  f.role === "title"
                    ? "opt-title"
                    : f.role === "meta"
                      ? "opt-meta"
                      : f.role === "level"
                        ? "opt-level"
                        : "opt-copy"
                }
              >
                {fieldText(data, path, v)}
              </Tag>
            );
          })}
        </div>
      )),
    );
  }
  return blocks;
}
function Block({ block, entries = block.entries, continued = false }) {
  return (
    <section className="opt-section" data-optional-section={block.id}>
      <h2 className="opt-heading">
        {block.title}
        {continued ? " — continued" : ""}
      </h2>
      {entries.map((entry, i) => (
        <div className="opt-entry" key={i}>
          {entry}
        </div>
      ))}
    </section>
  );
}
export function CvDocument({
  template,
  data,
  definitions,
  onReady = () => {},
  onError = () => {},
  builderFields = false,
}) {
  data = { ...data, _builderFields: builderFields };
  const root = useRef(null),
    measure = useRef(null),
    [pages, setPages] = useState([]),
    [relocated, setRelocated] = useState([]),
    [error, setError] = useState(""),
    [layoutVersion, setLayoutVersion] = useState(0);
  const signature = JSON.stringify([template.id, data]);
  const blocks = optionalBlocks(data, definitions, template, relocated);
  useLayoutEffect(() => {
    let width = root.current.offsetWidth;
    const observer = new ResizeObserver(() => {
      const next = root.current?.offsetWidth;
      if (next !== width) {
        width = next;
        setLayoutVersion((v) => v + 1);
      }
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [template.id]);
  useLayoutEffect(() => {
    let cancelled = false;
    setPages([]);
    setError("");
    onError("");
    async function layout() {
      await document.fonts.ready;
      await Promise.all(
        [...root.current.querySelectorAll("img")].map((i) =>
          i.decode().catch(() => {}),
        ),
      );
      if (cancelled) return;
      if (!root.current.offsetWidth) {
        onReady();
        return;
      }
      const overflow = [];
      root.current.querySelectorAll(".a4-page,.cv-page").forEach((sheet) => {
        const bounds = sheet.getBoundingClientRect();
        const bottom = bounds.bottom - (30 * bounds.width) / sheet.offsetWidth;
        sheet
          .querySelectorAll("[data-cv-section],[data-section]")
          .forEach((s) => {
            const key = s.dataset.cvSection || s.dataset.section;
            if (
              (s.getBoundingClientRect().bottom > bottom ||
                s.getBoundingClientRect().top < bounds.top - 1) &&
              ([
                "summary",
                "experience",
                "education",
                "skills",
                "contact",
              ].includes(key) ||
                key?.startsWith("legacy-"))
            )
              overflow.push(key);
          });
      });
      const next = [...new Set([...relocated, ...overflow])];
      if (next.length !== relocated.length) {
        setRelocated(next);
        return;
      }
      const result = [];
      let current = [],
        used = 0;
      const capacity = 900;
      const nodes = [...measure.current.querySelectorAll(".opt-section")];
      nodes.forEach((node, i) => {
        const block = blocks[i],
          whole = node.offsetHeight + 24;
        if (whole <= capacity) {
          if (used + whole > capacity) {
            result.push(current);
            current = [];
            used = 0;
          }
          current.push({ block });
          used += whole;
        } else {
          const head = node.querySelector("h2").offsetHeight + 32;
          let entries = [],
            continued = false;
          [...node.querySelectorAll(".opt-entry")].forEach((entry, index) => {
            const size = entry.offsetHeight + 20;
            if (size + head > capacity)
              throw new Error(
                "An entry exceeds one A4 page. Shorten that entry or split it into separate entries.",
              );
            if (used + size + (entries.length ? 0 : head) > capacity) {
              if (entries.length) {
                current.push({ block, entries, continued });
                entries = [];
                continued = true;
              }
              if (current.length) result.push(current);
              current = [];
              used = 0;
            }
            if (!entries.length) used += head;
            entries.push(block.entries[index]);
            used += size;
          });
          if (entries.length) current.push({ block, entries, continued });
        }
      });
      if (current.length) result.push(current);
      if (!cancelled) {
        setPages(result);
        requestAnimationFrame(() => onReady());
      }
    }
    layout().catch((e) => {
      if (!cancelled) {
        setError(e.message);
        onError(e.message);
        onReady();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [signature, relocated.join(","), layoutVersion]);
  useLayoutEffect(() => {
    setRelocated([]);
  }, [signature]);
  return (
    <div
      ref={root}
      className={`cv-render tpl-${template.id}`}
      dir={data.direction || "ltr"}
      lang={data.language || "en"}
      style={styleObject(template.rootStyle)}
      data-template-id={template.id}
      data-ready={pages.length || blocks.length === 0 ? "true" : "false"}
    >
      {template.tree.map((n, i) =>
        treeNode(
          n,
          { ...data, _pageTotal: basePageCount(template.tree) + pages.length },
          i,
          relocated,
        ),
      )}
      <div className="cv-measure" aria-hidden="true" ref={measure}>
        <article className="opt-sheet">
          <div className="opt-content">
            {blocks.map((b) => (
              <Block block={b} key={b.id} />
            ))}
          </div>
        </article>
      </div>
      {pages.map((groups, i) => (
        <article className="opt-sheet" data-continuation key={i}>
          <header className="opt-running">
            <strong>{data.name}</strong>
            <span className="cv-page-counter">
              Curriculum vitae · {basePageCount(template.tree) + i + 1} /{" "}
              {basePageCount(template.tree) + pages.length}
            </span>
          </header>
          <div className="opt-content">
            {groups.map((g, n) => (
              <Block {...g} key={n} />
            ))}
          </div>
          <footer className="opt-footer">{data.name} · Continued</footer>
        </article>
      ))}
      {error && (
        <p role="alert" className="layout-error">
          {error}
        </p>
      )}
    </div>
  );
}
export const renderCv = (props) => <CvDocument {...props} />;
