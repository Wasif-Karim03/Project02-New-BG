import { z } from "zod";

const s = z.string().trim().max(400).optional();
const i = z.coerce.number().int().min(0).max(100).optional();
// Student's English name — the owner's form marks THIS field "CAPS" (parent
// English names are not). Normalize to uppercase at the validation boundary so
// the stored value is guaranteed uppercase regardless of how it was typed.
const su = z.string().trim().max(400).transform((v) => v.toUpperCase()).optional();

// Draft save — everything optional so the applicant can save progress. The
// required-for-submission fields are enforced in submitApplication().
export const applicationDraftSchema = z.object({
  // ক. Student info
  nameBn: s, nameEn: su, fatherNameBn: s, fatherNameEn: s, motherNameBn: s, motherNameEn: s,
  familyMobile: s, gender: z.enum(["male", "female", "other"]).optional(), isOrphan: z.boolean().optional(), ethnicity: s,
  dob: z.coerce.date().optional(),
  // খ. Education
  schoolName: s, classNeeded: s, currentClass: s, roll: s, totalStudents: s,
  favoriteSubject: s, favoriteSubjectMarks: s, mathMarks: s, englishMarks: s,
  otherResults: z.array(z.object({ subject: z.string(), grade: z.string() })).optional(),
  recentGovtExam: s, govtExamGrades: z.array(z.object({ subject: z.string(), grade: z.string() })).optional(),
  careerGoal: s, hobbies: z.string().trim().max(1000).optional(),
  existingScholarship: z.object({ org: z.string().optional(), amount: z.string().optional(), type: z.string().optional() }).optional(),
  scholarshipNeedFor: z.array(z.string()).optional(),
  // গ. Family & social
  addrVillage: s, addrPara: s, addrPostOffice: s, addrThana: s, addrDistrict: s,
  localGuardianName: s, localGuardianPhone: s, tutorName: s, tutorPhone: s,
  familyMembersMale: i, familyMembersFemale: i, familyMembersTotal: i, studyingChildren: s,
  monthlyFamilyIncome: s, fatherProfession: s, fatherIncome: s, motherProfession: s, motherIncome: s,
  localKnownName: s, localKnownPhone: s,
  // agreements + files
  agreedTerms: z.boolean().optional(),
  photoConsent: z.boolean().optional(),
  // Optional — a family may decline; deliberately NOT in REQUIRED_CONSENTS.
  storyConsent: z.boolean().optional(),
  consentVerificationCalls: z.boolean().optional(),
  consentMonthlyPayment: z.boolean().optional(),
  consentMentorCheckins: z.boolean().optional(),
  consentCancelPolicy: z.boolean().optional(),
  specialReason: z.string().trim().max(1000).optional(),
  resultSheetUrl: s, photoUrl: s,
});

export type ApplicationDraftInput = z.infer<typeof applicationDraftSchema>;

// Fields that MUST be present to submit (validated in the service). photoUrl and
// resultSheetUrl are required: every applicant must include a photo (it becomes
// their portrait) and last year's result sheet (proof of study).
export const REQUIRED_TO_SUBMIT = [
  "nameEn", "fatherNameEn", "motherNameEn", "familyMobile", "gender",
  "schoolName", "currentClass", "addrDistrict", "photoUrl", "resultSheetUrl",
] as const;

// Consent checkboxes that must EACH be ticked to submit (recorded discretely).
// Enforced at the submit gate — same MissingFieldsError pattern as the uploads,
// NOT a draft-schema refine, so progressive saves still work (Phase 2 precedent).
export const REQUIRED_CONSENTS = [
  "agreedTerms", "photoConsent",
  "consentVerificationCalls", "consentMonthlyPayment",
  "consentMentorCheckins", "consentCancelPolicy",
] as const;

// Orphan applicants must name a local guardian (name + phone). Enforced at SUBMIT
// only — a partial draft can still save — so this lives apart from the all-optional
// applicationDraftSchema. Nullish because the DB stores unset fields as null.
export const orphanGuardianSchema = z
  .object({
    isOrphan: z.boolean().nullish(),
    localGuardianName: z.string().nullish(),
    localGuardianPhone: z.string().nullish(),
  })
  .superRefine((d, ctx) => {
    if (!d.isOrphan) return;
    if (!d.localGuardianName?.trim()) ctx.addIssue({ code: "custom", path: ["localGuardianName"], message: "Local guardian is required when the student is an orphan" });
    if (!d.localGuardianPhone?.trim()) ctx.addIssue({ code: "custom", path: ["localGuardianPhone"], message: "Guardian phone is required when the student is an orphan" });
  });
