import type { StudentApplication } from "@prisma/client";

/** First token of the English name, or a fallback (used for the slug + display). */
export function firstNameFrom(nameEn: string | null, fallback: string): string {
  const t = nameEn?.trim().split(/\s+/)[0];
  return t && t.length > 0 ? t : fallback;
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
    gender: app.gender,
    community: app.ethnicity,
    ethnicity: app.ethnicity,
    isOrphan: app.isOrphan,
    fatherProfession: app.fatherProfession,
    motherProfession: app.motherProfession,
    familyIncome: app.monthlyFamilyIncome,
    addrVillage: app.addrVillage,
    addrDistrict: app.addrDistrict,
    guardianName: app.localGuardianName,
    guardianMobile: app.localGuardianPhone,
    tutorName: app.tutorName,
    tutorPhone: app.tutorPhone,
    careerGoal: app.careerGoal,
    portraitUrl: app.photoUrl,
  };
}
