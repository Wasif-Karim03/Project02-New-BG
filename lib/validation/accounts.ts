import { z } from "zod";

// Shared field rules.
const email = z.string().trim().toLowerCase().email();
const password = z.string().min(10, "Password must be at least 10 characters").max(200);
const personName = z.string().trim().min(1).max(120);
const firstName = z.string().trim().min(1).max(80);

export const donorSignupSchema = z.object({
  email,
  password,
  name: personName,
  country: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const mentorSignupSchema = z.object({
  email,
  password,
  name: personName,
  phone: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(2000).optional(),
});

export const studentSelfSignupSchema = z.object({
  email,
  password,
  name: personName, // becomes User.name
  firstName, // public-safe first name on the Student record
  schoolId: z.string().cuid().optional(),
});

export const mentorRegisterStudentSchema = z.object({
  firstName,
  schoolId: z.string().cuid().optional(),
  fullName: z.string().trim().max(160).optional(),
  community: z.string().trim().max(80).optional(),
});

export const adminCreateStudentSchema = mentorRegisterStudentSchema; // same shape; auth differs

export const guestDonorSchema = z.object({
  name: personName,
  email: email.optional(),
  country: z.string().trim().max(100).optional(),
  isAnonymous: z.boolean().optional(),
  wallMessage: z.string().trim().max(2000).optional(),
});

// Approve takes no reason; reject REQUIRES a non-empty reason.
export const approveSchema = z.object({ reason: z.string().trim().max(2000).optional() });
export const rejectSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to reject"),
});

export type DonorSignupInput = z.infer<typeof donorSignupSchema>;
export type MentorSignupInput = z.infer<typeof mentorSignupSchema>;
export type StudentSelfSignupInput = z.infer<typeof studentSelfSignupSchema>;
export type MentorRegisterStudentInput = z.infer<typeof mentorRegisterStudentSchema>;
export type GuestDonorInput = z.infer<typeof guestDonorSchema>;
