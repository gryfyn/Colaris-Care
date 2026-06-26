"use client";

/* Reusable, accessible form primitives for the Colaris UI.
   All visual styling lives in globals.css under the .cx- namespace. */

import { useId } from "react";

export function Field({ label, required, optional, error, hint, span2, children }) {
  const id = useId();
  return (
    <div className={`cx-field${span2 ? " cx-span2" : ""}`} data-error={error ? "true" : undefined}>
      <label className="cx-label" htmlFor={id}>
        {label}
        {required && <span className="cx-reqmark" aria-hidden="true">*</span>}
        {optional && <span className="cx-opt">optional</span>}
      </label>
      {typeof children === "function" ? children(id) : children}
      {error ? (
        <span className="cx-err" role="alert">{error}</span>
      ) : hint ? (
        <span className="cx-opt">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextField({ label, value, onChange, required, optional, error, hint, span2, ...rest }) {
  return (
    <Field label={label} required={required} optional={optional} error={error} hint={hint} span2={span2}>
      {(id) => (
        <input
          id={id}
          className="cx-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? "true" : undefined}
          {...rest}
        />
      )}
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, placeholder = "Select…", required, optional, error, span2 }) {
  return (
    <Field label={label} required={required} optional={optional} error={error} span2={span2}>
      {(id) => (
        <select
          id={id}
          className="cx-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? "true" : undefined}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const lbl = typeof o === "string" ? o : o.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, required, optional, error, span2 = true, rows = 3, ...rest }) {
  return (
    <Field label={label} required={required} optional={optional} error={error} span2={span2}>
      {(id) => (
        <textarea
          id={id}
          className="cx-textarea"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </Field>
  );
}

/* Single-choice segmented control. tone: "default" | "amber" | "danger" can be
   set per option to color the active state for risk/alert semantics. */
export function SegmentedField({ label, value, onChange, options, required, optional, error, span2 }) {
  return (
    <Field label={label} required={required} optional={optional} error={error} span2={span2}>
      <div className="cx-seg" role="group" aria-label={label}>
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lbl = typeof o === "string" ? o : o.label;
          const tone = typeof o === "object" ? o.tone : undefined;
          const on = value === val;
          return (
            <button
              type="button"
              key={val}
              data-on={on ? "true" : "false"}
              className={tone ? `cx-seg-${tone}` : undefined}
              aria-pressed={on}
              onClick={() => onChange(on ? "" : val)}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
