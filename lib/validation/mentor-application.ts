import { z } from "zod";

const s = () => z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined));

// Sensible default mentor question set — refined once the exact questions are provided.
export const mentorApplicationDraftSchema = z.object({
  fullName: s(),
  phone: s(),
  profession: s(),
  organization: s(),
  city: s(),
  country: s(),
  education: s(),
  languages: s(),
  experience: s(),
  motivation: s(),
  availability: s(),
  howHeard: s(),
  photoUrl: s(), // profile picture (set from the upload; required to submit)
  agreedTerms: z.boolean().optional(),
});

export type MentorApplicationDraft = z.infer<typeof mentorApplicationDraftSchema>;

// Fields required before a mentor application can be submitted for verification.
export const MENTOR_REQUIRED_TO_SUBMIT = ["fullName", "phone", "profession", "country", "motivation", "photoUrl"] as const;

export const MENTOR_FIELDS: { key: keyof MentorApplicationDraft; label: string; multiline?: boolean }[] = [
  { key: "fullName", label: "Full name" },
  { key: "phone", label: "Phone / WhatsApp" },
  { key: "profession", label: "Profession / occupation" },
  { key: "organization", label: "Organization (optional)" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "education", label: "Education background" },
  { key: "languages", label: "Languages you speak" },
  { key: "experience", label: "Teaching / mentoring experience", multiline: true },
  { key: "motivation", label: "Why do you want to mentor?", multiline: true },
  { key: "availability", label: "Availability (e.g. hours/week)" },
  { key: "howHeard", label: "How did you hear about us? (optional)" },
];
