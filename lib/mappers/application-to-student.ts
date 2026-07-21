import type { StudentApplication } from "@prisma/client";

/** First token of the English name, or a fallback (used for the slug + display). */
export function firstNameFrom(nameEn: string | null, fallback: string): string {
  const t = nameEn?.trim().split(/\s+/)[0];
  return t && t.length > 0 ? t : fallback;
}

/**
 * The application's "why the scholarship is needed" answer (a Json string[] of picked
 * options + an optional free-text note) becomes the Student's free-text `purpose` —
 * previously `purpose` had no application source. Non-array / empty → null.
 */
export function formatScholarshipNeedFor(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const parts = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  return parts.length ? parts.join(", ") : null;
}

/**
 * THE single source of truth for application → student field mapping.
 *
 * The admin student record uses different field names than the application
 * (guardianName vs localGuardianName, familyIncome vs monthlyFamilyIncome,
 * fullName vs nameEn, community/ethnicity vs ethnicity), and approval used to map
 * them inline by hand. This module is the ONE place that translation lives.
 *
 * It returns ONLY the application-derived fields; the approval flow adds the
 * contextual ones (status, slug, registrationId, schoolId, verified, active,
 * portraitConsent, reviewedBy…). firstName + fullName are intentionally NOT split
 * into first/last (decision on record).
 */
export function mapApplicationToStudent(app: StudentApplication, firstName: string) {
  return {
    firstName,
    fullName: app.nameEn,
    fatherName: app.fatherNameEn,
    motherName: app.motherNameEn,
    // Bangla name variants — carried for official documents (Bangla-first org).
    fullNameBn: app.nameBn,
    fatherNameBn: app.fatherNameBn,
    motherNameBn: app.motherNameBn,
    dob: app.dob,
    gender: app.gender,
    community: app.ethnicity,
    ethnicity: app.ethnicity,
    isOrphan: app.isOrphan,
    fatherProfession: app.fatherProfession,
    motherProfession: app.motherProfession,
    familyIncome: app.monthlyFamilyIncome,
    // Primary family contact — required on the application; carried so an admin always
    // has a way to reach the family (the guardian phone is separate + optional).
    familyMobile: app.familyMobile,
    addrVillage: app.addrVillage,
    // Detailed address parts — carried for mentor home visits / correspondence.
    addrPara: app.addrPara,
    addrPostOffice: app.addrPostOffice,
    addrThana: app.addrThana,
    addrDistrict: app.addrDistrict,
    guardianName: app.localGuardianName,
    guardianMobile: app.localGuardianPhone,
    tutorName: app.tutorName,
    tutorPhone: app.tutorPhone,
    // Why the scholarship is needed → the record's free-text purpose (had no source before).
    purpose: formatScholarshipNeedFor(app.scholarshipNeedFor),
    careerGoal: app.careerGoal,
    portraitUrl: app.photoUrl,
  };
}

/**
 * Application → StudentSession field mapping (the per-session enrollment seeded at
 * approval). The applicant's uploaded RESULT SHEET is a PER-SESSION academic document
 * — Student has no `resultSheetUrl` column, StudentSession does (Phase 4) — so it is
 * carried here onto the first session rather than discarded. The approval flow adds
 * the contextual fields (studentId, sessionId, schoolId, status).
 */
export function mapApplicationToStudentSession(app: StudentApplication) {
  return {
    institutionName: app.schoolName,
    grade: app.currentClass,
    roll: app.roll,
    totalStudent: app.totalStudents,
    resultSheetUrl: app.resultSheetUrl,
  };
}
