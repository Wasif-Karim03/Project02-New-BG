import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { generateUniqueStudentSlug } from "@/lib/slug";
import { recordAudit } from "@/lib/services/audit";
import type {
  DonorSignupInput,
  GuestDonorInput,
  MentorRegisterStudentInput,
  MentorSignupInput,
  StudentSelfSignupInput,
} from "@/lib/validation/accounts";

/** Thrown when a unique constraint (email) blocks signup. */
export class EmailInUseError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailInUseError";
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ── Entry path 1: self-signup (donor / mentor / student) → PENDING → queue ──

export async function registerDonor(input: DonorSignupInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, role: "DONOR", status: "PENDING", passwordHash },
      });
      const donor = await tx.donor.create({
        data: { userId: user.id, name: input.name, email: input.email, country: input.country, phone: input.phone },
      });
      return { userId: user.id, donorId: donor.id, status: user.status };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new EmailInUseError();
    throw e;
  }
}

export async function registerMentor(input: MentorSignupInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, role: "MENTOR", status: "PENDING", passwordHash },
      });
      const mentor = await tx.mentor.create({ data: { userId: user.id, phone: input.phone, bio: input.bio } });
      return { userId: user.id, mentorId: mentor.id, status: user.status };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new EmailInUseError();
    throw e;
  }
}

export async function registerStudentSelf(input: StudentSelfSignupInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, role: "STUDENT", status: "PENDING", passwordHash },
      });
      const student = await tx.student.create({
        data: { userId: user.id, status: "PENDING", firstName: input.firstName, schoolId: input.schoolId },
      });
      return { userId: user.id, studentId: student.id, status: user.status, recordStatus: student.status };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new EmailInUseError();
    throw e;
  }
}

// ── Entry path 2: mentor-registered student → Student(PENDING), no login → queue ──

export async function registerStudentByMentor(mentorUserId: string, input: MentorRegisterStudentInput) {
  const student = await prisma.student.create({
    data: {
      status: "PENDING",
      firstName: input.firstName,
      fullName: input.fullName,
      community: input.community,
      schoolId: input.schoolId,
      createdById: mentorUserId, // login-less: no userId
    },
  });
  return { studentId: student.id, status: student.status };
}

// ── Entry path 3: admin-created record → auto-ACTIVE, STILL audited ──

export async function adminCreateStudent(adminUserId: string, input: MentorRegisterStudentInput) {
  const slug = await generateUniqueStudentSlug(input.firstName);
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        status: "ACTIVE",
        slug,
        firstName: input.firstName,
        fullName: input.fullName,
        community: input.community,
        schoolId: input.schoolId,
        createdById: adminUserId,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "student.create",
      entityType: "Student",
      entityId: student.id,
      after: { status: "ACTIVE", slug },
      reason: "admin-created (auto-approved)",
    });
    return { studentId: student.id, slug, status: student.status };
  });
}

// ── Entry path 4: guest donor → Donor row, no User, no approval, no queue ──

export async function createGuestDonor(input: GuestDonorInput) {
  const donor = await prisma.donor.create({
    data: {
      userId: null, // guest: no login. Matched to an account later by verified email.
      name: input.name,
      email: input.email,
      country: input.country,
      isAnonymous: input.isAnonymous ?? false,
      wallMessage: input.wallMessage,
    },
  });
  return { donorId: donor.id };
}
