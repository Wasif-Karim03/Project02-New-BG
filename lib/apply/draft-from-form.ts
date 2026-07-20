import { applicationDraftSchema } from "@/lib/validation/applications";

// Repeatable {subject, grade} rows submit as `${prefix}.${i}.subject` /
// `${prefix}.${i}.grade`. Collapse them back into an array for the Json column,
// dropping fully-empty rows.
function groupRows(formData: FormData, prefix: string) {
  const indexes = new Set<number>();
  for (const k of formData.keys()) {
    const m = k.match(new RegExp(`^${prefix}\\.(\\d+)\\.(subject|grade)$`));
    if (m) indexes.add(Number(m[1]));
  }
  const rows: { subject: string; grade: string }[] = [];
  for (const n of [...indexes].sort((a, b) => a - b)) {
    const subject = String(formData.get(`${prefix}.${n}.subject`) || "").trim();
    const grade = String(formData.get(`${prefix}.${n}.grade`) || "").trim();
    if (subject || grade) rows.push({ subject, grade });
  }
  return rows;
}

// Turn the raw application FormData into a validated draft. Scalar fields copy
// straight through; the structured fields (repeatable groups, the existing-
// scholarship object, and the multi-value "why needed" list) are rebuilt
// explicitly so they land in their Json columns instead of leaking as stray
// dotted string keys. All fields are optional here — required-to-submit is
// enforced later in submitApplication().
export function draftFromForm(formData: FormData) {
  const obj: Record<string, unknown> = {};
  // Scalars. Skip the structured fields (handled below): dotted keys belong to
  // the repeatable/object groups, and the multi-value / radio helpers are rebuilt
  // explicitly so their raw string entries don't leak into the draft.
  const structured = new Set(["scholarshipNeedFor", "scholarshipNeedForOther", "existingScholarshipHas"]);
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string" || v.trim() === "") continue;
    if (k.includes(".") || structured.has(k)) continue;
    obj[k] = v;
  }
  obj.isOrphan = formData.get("isOrphan") === "on";
  obj.agreedTerms = formData.get("agreedTerms") === "on";
  obj.photoConsent = formData.get("photoConsent") === "on";

  // Repeatable groups → Json arrays.
  const otherResults = groupRows(formData, "otherResults");
  if (otherResults.length) obj.otherResults = otherResults;
  const govtExamGrades = groupRows(formData, "govtExamGrades");
  if (govtExamGrades.length) obj.govtExamGrades = govtExamGrades;

  // Existing scholarship — only capture the sub-fields when the answer is "yes".
  if (formData.get("existingScholarshipHas") === "yes") {
    const org = String(formData.get("existingScholarship.org") || "").trim();
    const amount = String(formData.get("existingScholarship.amount") || "").trim();
    const type = String(formData.get("existingScholarship.type") || "").trim();
    if (org || amount || type) obj.existingScholarship = { org, amount, type };
  }

  // Why the scholarship is needed — checkbox options plus an optional free-text note.
  const needFor = formData.getAll("scholarshipNeedFor").map((x) => String(x).trim()).filter(Boolean);
  const needOther = String(formData.get("scholarshipNeedForOther") || "").trim();
  if (needOther) needFor.push(needOther);
  if (needFor.length) obj.scholarshipNeedFor = needFor;

  return applicationDraftSchema.parse(obj);
}
