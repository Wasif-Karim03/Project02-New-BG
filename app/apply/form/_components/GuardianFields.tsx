"use client";

import { useEffect, useState } from "react";

const f = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const lbl = "block text-sm font-medium text-ink-2";

// Local-guardian name + phone. These become required when the student is marked
// an orphan. The orphan checkbox lives in another section of the same form, so we
// subscribe to it in the DOM and mirror its state onto the `required` attribute.
// Server-side, submitApplication enforces the same rule via a Zod refine, so this
// is a progressive enhancement, not the source of truth.
export function GuardianFields({ nameDefault, phoneDefault }: { nameDefault: string; phoneDefault: string }) {
  const [required, setRequired] = useState(false);
  useEffect(() => {
    const cb = document.querySelector<HTMLInputElement>('input[name="isOrphan"]');
    if (!cb) return;
    const sync = () => setRequired(cb.checked);
    sync();
    cb.addEventListener("change", sync);
    return () => cb.removeEventListener("change", sync);
  }, []);

  const star = required ? " *" : "";
  return (
    <>
      <label className={lbl}>স্থানীয় অভিভাবক / Local guardian{star}
        <input name="localGuardianName" required={required} defaultValue={nameDefault} className={f} />
      </label>
      <label className={lbl}>অভিভাবকের ফোন / Guardian phone{star}
        <input name="localGuardianPhone" required={required} defaultValue={phoneDefault} className={f} />
      </label>
    </>
  );
}
