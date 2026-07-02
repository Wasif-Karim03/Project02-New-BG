import type { ConsentScope, ConsentStatus } from "@prisma/client";

type ConsentFields = {
  portraitConsent: ConsentStatus;
  storyConsent: ConsentStatus;
  consentScopes: ConsentScope[];
  consentRevokedAt: Date | null;
};

/**
 * Mirrors the marketing site's canShowPortrait / canShowSuccessStory. Evaluated
 * server-side BEFORE projection; when a gate fails the field is OMITTED entirely
 * (never nulled in a way that leaks that withheld data exists).
 */
export function portraitVisible(s: ConsentFields): boolean {
  return s.portraitConsent === "GRANTED" && s.consentScopes.includes("WEBSITE") && s.consentRevokedAt == null;
}

export function storyVisible(s: ConsentFields): boolean {
  return s.storyConsent === "GRANTED" && s.consentScopes.includes("WEBSITE") && s.consentRevokedAt == null;
}
