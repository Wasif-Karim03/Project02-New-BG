"use client";

import { useState } from "react";
import { upsertSessionAction, deleteSessionAction } from "../../actions";
import { ConfirmSubmit } from "../../../_components/ConfirmSubmit";
import { input, label, btnPrimary } from "../../../_components/ui";

type SessionRow = {
  sessionId: string;
  sessionLabel: string;
  institutionName: string | null;
  grade: string | null;
  roll: string | null;
  formerRoll: string | null;
  totalStudent: string | null;
  degreeLevel: string | null;
  resultSheetUrl: string | null;
};
type Opt = { id: string; label: string };

const isUniversity = (s: string) => /universit/i.test(s);

// Shared editable fields for one session row. The BA/MA degree level is revealed
// only when the institution looks like a university (matches the owner's rule).
function SessionFields({ row }: { row?: Partial<SessionRow> }) {
  const [institution, setInstitution] = useState(row?.institutionName ?? "");
  return (
    <>
      <label className={label}>Institution
        <input name="institutionName" defaultValue={row?.institutionName ?? ""} onChange={(e) => setInstitution(e.target.value)} className={input} />
      </label>
      <label className={label}>Grade<input name="grade" defaultValue={row?.grade ?? ""} className={input} /></label>
      <label className={label}>Roll<input name="roll" defaultValue={row?.roll ?? ""} className={input} /></label>
      <label className={label}>Former roll<input name="formerRoll" defaultValue={row?.formerRoll ?? ""} className={input} /></label>
      <label className={label}>Total students<input name="totalStudent" defaultValue={row?.totalStudent ?? ""} className={input} /></label>
      {isUniversity(institution) && (
        <label className={label}>Degree level (BA / MA)<input name="degreeLevel" defaultValue={row?.degreeLevel ?? ""} placeholder="e.g. BA, MA, BSc" className={input} /></label>
      )}
      <label className={label}>Result sheet (photo/PDF){row?.resultSheetUrl ? " · ✓ uploaded" : ""}
        <input type="file" name="resultSheet" accept="image/*,application/pdf" className={input} />
      </label>
    </>
  );
}

// Existing education rows are individually editable and deletable; a dashed "add"
// form appears for any academic session that doesn't yet have a row.
export function EducationManager({ studentId, sessions, options }: { studentId: string; sessions: SessionRow[]; options: Opt[] }) {
  const used = new Set(sessions.map((s) => s.sessionId));
  const addable = options.filter((o) => !used.has(o.id));

  return (
    <div className="grid gap-4">
      {sessions.map((row) => (
        <div key={row.sessionId} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{row.sessionLabel}</span>
            <form action={deleteSessionAction}>
              <input type="hidden" name="studentId" value={studentId} />
              <input type="hidden" name="sessionId" value={row.sessionId} />
              <ConfirmSubmit className="text-xs font-medium text-red-600 hover:underline" message={`Delete the ${row.sessionLabel} education row? This cannot be undone.`}>Delete row</ConfirmSubmit>
            </form>
          </div>
          <form action={upsertSessionAction} encType="multipart/form-data" className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="sessionId" value={row.sessionId} />
            <SessionFields row={row} />
            <div className="sm:col-span-3"><button className={btnPrimary}>Save row</button></div>
          </form>
        </div>
      ))}
      {addable.length > 0 && (
        <form action={upsertSessionAction} encType="multipart/form-data" className="grid gap-3 rounded-lg border border-dashed border-slate-300 p-3 sm:grid-cols-3">
          <input type="hidden" name="studentId" value={studentId} />
          <label className={label}>Session
            <select name="sessionId" required className={input}><option value="">—</option>{addable.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          </label>
          <SessionFields />
          <div className="sm:col-span-3"><button className={btnPrimary}>Add education row</button></div>
        </form>
      )}
    </div>
  );
}
