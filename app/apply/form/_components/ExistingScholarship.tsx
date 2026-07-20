"use client";

import { useState } from "react";

const f = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const lbl = "block text-sm font-medium text-ink-2";

// Yes/No question with the {org, amount, type} sub-fields shown only when "Yes".
// When "No" is selected the sub-fields are unmounted so they never submit; the
// server mapper likewise only reads them when existingScholarshipHas === "yes".
export function ExistingScholarship({ initial }: { initial?: { org?: string; amount?: string; type?: string } | null }) {
  const [yes, setYes] = useState(!!(initial && (initial.org || initial.amount || initial.type)));
  const radio = "h-4 w-4 border-hairline text-accent-2 focus:ring-accent/40";

  return (
    <fieldset className="mt-4">
      <legend className={lbl}>বর্তমানে অন্য কোনো বৃত্তি পাচ্ছে? / Currently receiving another scholarship?</legend>
      <div className="mt-2 flex gap-6 text-sm text-ink-2">
        <label className="flex items-center gap-2"><input type="radio" name="existingScholarshipHas" value="no" checked={!yes} onChange={() => setYes(false)} className={radio} /> না / No</label>
        <label className="flex items-center gap-2"><input type="radio" name="existingScholarshipHas" value="yes" checked={yes} onChange={() => setYes(true)} className={radio} /> হ্যাঁ / Yes</label>
      </div>
      {yes && (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className={lbl}>সংস্থার নাম / Organization<input name="existingScholarship.org" defaultValue={initial?.org ?? ""} className={f} /></label>
          <label className={lbl}>পরিমাণ / Amount<input name="existingScholarship.amount" defaultValue={initial?.amount ?? ""} className={f} /></label>
          <label className={lbl}>ধরন / Type
            <select name="existingScholarship.type" defaultValue={initial?.type ?? ""} className={f}>
              <option value="">—</option>
              <option value="monthly">মাসিক / Monthly</option>
              <option value="yearly">বার্ষিক / Yearly</option>
              <option value="one-time">এককালীন / One-time</option>
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
