"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AccountStatus, Role } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { InviteEmailInUseError, LastAdminError, SelfActionError, inviteStaff, setUserRole, setUserStatus } from "@/lib/services/user-management";

const ROLES: Role[] = ["ADMIN", "MENTOR", "DONOR", "STUDENT"];
const STATUSES: AccountStatus[] = ["ACTIVE", "SUSPENDED", "PENDING", "REJECTED"];
const fail = (msg: string): never => redirect("/users?error=" + encodeURIComponent(msg));

export async function setRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const role = String(formData.get("role")) as Role;
  if (!ROLES.includes(role)) fail("Invalid role");
  try {
    await setUserRole(admin.id, String(formData.get("id")), role);
  } catch (e) {
    if (e instanceof LastAdminError || e instanceof SelfActionError) fail(e.message);
    throw e;
  }
  revalidatePath("/users");
}

export async function setStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const status = String(formData.get("status")) as AccountStatus;
  if (!STATUSES.includes(status)) fail("Invalid status");
  try {
    await setUserStatus(admin.id, String(formData.get("id")), status);
  } catch (e) {
    if (e instanceof LastAdminError || e instanceof SelfActionError) fail(e.message);
    throw e;
  }
  revalidatePath("/users");
}

export async function inviteStaffAction(formData: FormData) {
  const admin = await requireAdmin();
  const role = String(formData.get("role"));
  if (role !== "ADMIN" && role !== "MENTOR") fail("Invites are for admins or mentors only");
  try {
    await inviteStaff(admin.id, String(formData.get("email") || ""), role as "ADMIN" | "MENTOR");
  } catch (e) {
    if (e instanceof InviteEmailInUseError) fail(e.message);
    throw e;
  }
  redirect("/users?invited=1");
}
