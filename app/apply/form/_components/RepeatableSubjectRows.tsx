"use client";

import { useState } from "react";

// Shared with the server form's `f`/`lbl` so these rows match the rest of the
// inputs exactly (client components can't import the module-scoped page consts).
const f = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";

type Row = { subject: string; grade: string };

// An add/remove list of {subject, grade} pairs. Inputs are controlled so state is
// the single source of truth: removing a middle row re-indexes the names cleanly
// (uncontrolled defaultValue rows would keep stale DOM values on removal). The
// server mapper collapses `${name}.${i}.subject|grade` back into a Json array and
// drops fully-empty rows, so a lone blank row submits as nothing.
export function RepeatableSubjectRows({
  name, label, subjectLabel, gradeLabel, initial,
}: { name: string; label: string; subjectLabel: string; gradeLabel: string; initial?: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial?.length ? initial : [{ subject: "", grade: "" }]);
  const update = (i: number, field: keyof Row, val: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [field]: val } : r)));

  return (
    <fieldset className="mt-4">
      <legend className="block text-sm font-medium text-ink-2">{label}</legend>
      <div className="mt-2 grid gap-3">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-xs text-ink-2">{subjectLabel}
              <input name={`${name}.${i}.subject`} value={row.subject} onChange={(e) => update(i, "subject", e.target.value)} className={f} />
            </label>
            <label className="block text-xs text-ink-2">{gradeLabel}
              <input name={`${name}.${i}.grade`} value={row.grade} onChange={(e) => update(i, "grade", e.target.value)} className={f} />
            </label>
            <button
              type="button"
              onClick={() => setRows(rows.length === 1 ? [{ subject: "", grade: "" }] : rows.filter((_, j) => j !== i))}
              className="rounded-lg border border-hairline px-3 py-2.5 text-sm text-ink-2 hover:bg-ground-3"
              aria-label="Remove row"
            >✕</button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRows([...rows, { subject: "", grade: "" }])}
        className="mt-2 rounded-full border border-hairline px-4 py-1.5 text-sm font-medium text-ink-2 hover:bg-ground-3"
      >+ আরও যোগ করুন / Add another</button>
    </fieldset>
  );
}
