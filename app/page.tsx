import { redirect } from "next/navigation";
import { auth } from "@/auth";

// The ops root is a router, not a page: send each signed-in user to their own
// home, and everyone else to the login screen. It deliberately renders NO public
// index of internal routes (admin screens, API endpoints). Public actions like
// applying or donating are reached via direct links from the marketing site and
// from the login page, not from here.
const HOME_BY_ROLE: Record<string, string> = {
  ADMIN: "/admin",
  STUDENT: "/student",
  MENTOR: "/my-students",
  DONOR: "/dashboard",
};

export default async function Home() {
  const user = (await auth())?.user;
  if (user && user.status === "ACTIVE") redirect(HOME_BY_ROLE[user.role] ?? "/login");
  redirect("/login");
}
