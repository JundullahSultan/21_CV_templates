import React, { useState } from "react";
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function parse(value) {
  const year = String(value).match(/\b\d{4}\b/)?.[0] || "";
  const month = months.findIndex((m) => new RegExp(m, "i").test(value));
  const iso = String(value).match(/\d{4}-(\d{2})(?:-(\d{2}))?/);
  return {
    year,
    month: iso ? String(Number(iso[1])) : month < 0 ? "" : String(month + 1),
    day: iso?.[2] ? String(Number(iso[2])) : "",
  };
}
function DatePart({ label, value, onChange }) {
  const year = Number(value.year),
    month = Number(value.month),
    days = year && month ? new Date(year, month, 0).getDate() : 31;
  return (
    <fieldset>
      <legend>{label}</legend>
      <label>
        Year
        <select
          aria-label={`${label} year`}
          value={value.year}
          onChange={(e) =>
            onChange({ year: e.target.value, month: "", day: "" })
          }
        >
          <option value="">Choose year</option>
          {Array.from({ length: 201 }, (_, i) => String(2100 - i)).map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label>
        Month
        <select
          aria-label={`${label} month`}
          disabled={!value.year}
          value={value.month}
          onChange={(e) =>
            onChange({ ...value, month: e.target.value, day: "" })
          }
        >
          <option value="">Year only</option>
          {months.map((m, i) => (
            <option value={i + 1} key={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        Day
        <select
          aria-label={`${label} day`}
          disabled={!value.month}
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
        >
          <option value="">Month only</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
export function DatePicker({ value, yearOnly, onSave, onCancel }) {
  const parts = String(value).split(/\s+(?:-|–|—|to)\s+/),
    [from, setFrom] = useState(parse(parts[0])),
    [to, setTo] = useState(parse(parts[1] || "")),
    [present, setPresent] = useState(/present|current/i.test(parts[1] || ""));
  const format = (d) =>
    d.year +
    (d.month ? `-${d.month.padStart(2, "0")}` : "") +
    (d.day ? `-${d.day.padStart(2, "0")}` : "");
  return (
    <div
      className="field-modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <form
        className="field-dialog date-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Edit dates"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            yearOnly
              ? format(from)
              : `${format(from)} - ${present ? "Present" : format(to)}`,
          );
        }}
      >
        <h2>Edit dates</h2>
        <DatePart
          label={yearOnly ? "Graduation" : "From"}
          value={from}
          onChange={setFrom}
        />
        {!yearOnly && (
          <>
            <label>
              <input
                type="checkbox"
                checked={present}
                onChange={(e) => setPresent(e.target.checked)}
              />{" "}
              Present
            </label>
            {!present && <DatePart label="To" value={to} onChange={setTo} />}
          </>
        )}
        <div className="field-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!from.year || (!yearOnly && !present && !to.year)}
          >
            Save dates
          </button>
        </div>
      </form>
    </div>
  );
}
