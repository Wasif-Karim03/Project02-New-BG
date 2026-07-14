import { redirect } from "next/navigation";
import { getApplicantUserId } from "@/lib/apply-session";
import { getOrCreateDraft } from "@/lib/services/applications";
import { saveSubmitAction } from "../actions";

type SearchParams = Promise<{ error?: string }>;
const f = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const lbl = "block text-sm font-medium text-ink-2";
const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-2-text">{children}</h2>;

// Module-scoped so it isn't recreated on every render. The draft value is passed
// in explicitly rather than closed over, keeping the component pure.
const T = ({ name, label, required = false, type = "text", defaultValue = "" }: { name: string; label: string; required?: boolean; type?: string; defaultValue?: string }) => (
  <label className={lbl}>{label}{required ? " *" : ""}<input name={name} type={type} required={required} defaultValue={defaultValue} className={f} /></label>
);

export default async function ApplyFormPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/apply");
  const d = await getOrCreateDraft(userId) as Record<string, unknown>;
  const { error } = await searchParams;
  const v = (k: string) => (d[k] as string) ?? "";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Student application form</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">Fields marked * are required to submit. You&apos;ll verify your email next.</p>
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}

      <form action={saveSubmitAction} className="mt-8 grid gap-6">
        <section className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <H>ক. Student information</H>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <T name="nameBn" label="নাম (বাংলায়)" defaultValue={v("nameBn")} />
            <T name="nameEn" label="Name (English, CAPS)" required defaultValue={v("nameEn")} />
            <T name="fatherNameBn" label="পিতার নাম (বাংলা)" defaultValue={v("fatherNameBn")} />
            <T name="fatherNameEn" label="Father's name (English)" required defaultValue={v("fatherNameEn")} />
            <T name="motherNameBn" label="মাতার নাম (বাংলা)" defaultValue={v("motherNameBn")} />
            <T name="motherNameEn" label="Mother's name (English)" required defaultValue={v("motherNameEn")} />
            <T name="familyMobile" label="পারিবারিক মোবাইল / Family mobile" required defaultValue={v("familyMobile")} />
            <label className={lbl}>লিঙ্গ / Gender *
              <select name="gender" required defaultValue={v("gender")} className={f}>
                <option value="">—</option><option value="male">পুরুষ / Male</option><option value="female">নারী / Female</option><option value="other">অন্যান্য / Other</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" name="isOrphan" defaultChecked={!!d.isOrphan} className="h-4 w-4 rounded border-hairline text-accent-2 focus:ring-accent/40" /> অনাথ / Orphan</label>
            <T name="ethnicity" label="নৃগোষ্ঠী / Ethnicity" defaultValue={v("ethnicity")} />
          </div>
        </section>

        <section className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <H>খ. Education</H>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <T name="schoolName" label="বিদ্যালয়ের নাম / School name" required defaultValue={v("schoolName")} />
            <T name="classNeeded" label="যে শ্রেণীর জন্য বৃত্তি / Class needed" defaultValue={v("classNeeded")} />
            <T name="currentClass" label="বর্তমান শ্রেণী / Current class" required defaultValue={v("currentClass")} />
            <T name="roll" label="রোল / Roll" defaultValue={v("roll")} />
            <T name="totalStudents" label="মোট শিক্ষার্থী / Total students" defaultValue={v("totalStudents")} />
            <T name="favoriteSubject" label="প্রিয় বিষয় / Favorite subject" defaultValue={v("favoriteSubject")} />
            <T name="mathMarks" label="গণিতে নম্বর / Math marks" defaultValue={v("mathMarks")} />
            <T name="englishMarks" label="ইংরেজিতে নম্বর / English marks" defaultValue={v("englishMarks")} />
            <T name="recentGovtExam" label="সাম্প্রতিক সরকারি পরীক্ষা / Recent govt exam" defaultValue={v("recentGovtExam")} />
            <T name="careerGoal" label="বড় হয়ে কী হতে চান / Career goal" defaultValue={v("careerGoal")} />
          </div>
          <label className={`${lbl} mt-4`}>শখ / Hobbies<textarea name="hobbies" rows={2} defaultValue={v("hobbies")} className={f} /></label>
        </section>

        <section className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <H>গ. Family &amp; social</H>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <T name="addrVillage" label="গ্রাম / Village" defaultValue={v("addrVillage")} />
            <T name="addrPara" label="পাড়া / Para" defaultValue={v("addrPara")} />
            <T name="addrPostOffice" label="পোস্ট অফিস / Post office" defaultValue={v("addrPostOffice")} />
            <T name="addrThana" label="থানা/উপজেলা / Thana" defaultValue={v("addrThana")} />
            <T name="addrDistrict" label="জেলা / District" required defaultValue={v("addrDistrict")} />
            <T name="localGuardianName" label="স্থানীয় অভিভাবক / Local guardian" defaultValue={v("localGuardianName")} />
            <T name="localGuardianPhone" label="অভিভাবকের ফোন / Guardian phone" defaultValue={v("localGuardianPhone")} />
            <T name="tutorName" label="প্রাইভেট শিক্ষক / Tutor" defaultValue={v("tutorName")} />
            <T name="tutorPhone" label="শিক্ষকের ফোন / Tutor phone" defaultValue={v("tutorPhone")} />
            <T name="familyMembersMale" label="পরিবারে পুরুষ / Male members" type="number" defaultValue={v("familyMembersMale")} />
            <T name="familyMembersFemale" label="পরিবারে নারী / Female members" type="number" defaultValue={v("familyMembersFemale")} />
            <T name="monthlyFamilyIncome" label="মাসিক পারিবারিক আয় / Monthly income" defaultValue={v("monthlyFamilyIncome")} />
            <T name="fatherProfession" label="বাবার পেশা / Father's profession" defaultValue={v("fatherProfession")} />
            <T name="fatherIncome" label="বাবার আয় / Father's income" defaultValue={v("fatherIncome")} />
            <T name="motherProfession" label="মাতার পেশা / Mother's profession" defaultValue={v("motherProfession")} />
            <T name="motherIncome" label="মাতার আয় / Mother's income" defaultValue={v("motherIncome")} />
          </div>
        </section>

        <section className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <H>Documents</H>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={lbl}>Last year&apos;s result sheet (photo or PDF)
              <input type="file" name="resultSheet" accept="image/*,application/pdf" className="mt-1.5 block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-ground-3 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-hairline" />
              {v("resultSheetUrl") && <span className="mt-1 block text-xs font-medium text-accent">✓ uploaded — re-select to replace</span>}
            </label>
            <label className={lbl}>Your photo (school uniform is fine) *
              {/* Required, unless a photo was already uploaded on a prior save. The
                  server also enforces photoUrl via REQUIRED_TO_SUBMIT. */}
              <input type="file" name="photo" accept="image/*" required={!v("photoUrl")} className="mt-1.5 block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-ground-3 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-hairline" />
              {v("photoUrl") && <span className="mt-1 block text-xs font-medium text-accent">✓ uploaded — re-select to replace</span>}
            </label>
          </div>
          <p className="mt-3 text-xs text-ink-2">JPEG, PNG, WebP, or PDF · up to 5 MB. Your documents are private — only staff and your mentor can view them.</p>
        </section>

        <label className="flex items-start gap-3 rounded-2xl border border-hairline bg-ground-3/50 p-5 text-sm text-ink-2">
          <input type="checkbox" name="agreedTerms" required className="mt-0.5 h-4 w-4 rounded border-hairline text-accent-2 focus:ring-accent/40" />
          <span>আমি নিশ্চিত করছি উপরের সকল তথ্য সঠিক এবং শর্তাবলীর সাথে একমত। / I confirm the above is accurate and I agree to the terms. *</span>
        </label>

        <div>
          <button type="submit" className="rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Submit &amp; verify email</button>
        </div>
      </form>
    </main>
  );
}
