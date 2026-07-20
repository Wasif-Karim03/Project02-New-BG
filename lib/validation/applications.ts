import { z } from "zod";

const s = z.string().trim().max(400).optional();
const i = z.coerce.number().int().min(0).max(100).optional();

// Draft save — everything optional so the applicant can save progress. The
// required-for-submission fields are enforced in submitApplication().
export const applicationDraftSchema = z.object({
  // ক. Student info
  nameBn: s, nameEn: s, fatherNameBn: s, fatherNameEn: s, motherNameBn: s, motherNameEn: s,
  familyMobile: s, gender: z.enum(["male", "female", "other"]).optional(), isOrphan: z.boolean().optional(), ethnicity: s,
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
  resultSheetUrl: s, photoUrl: s,
});

export type ApplicationDraftInput = z.infer<typeof applicationDraftSchema>;

// Fields that MUST be present to submit (validated in the service). photoUrl is
// required: every applicant must include a photo (it becomes their portrait).
export const REQUIRED_TO_SUBMIT = [
  "nameEn", "fatherNameEn", "motherNameEn", "familyMobile", "gender",
  "schoolName", "currentClass", "addrDistrict", "photoUrl",
] as const;
