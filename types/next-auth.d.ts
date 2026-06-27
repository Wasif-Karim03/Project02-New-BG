import type { AccountStatus, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augment Auth.js types so role + status are first-class on the user, JWT, and
// session — the foundation Phase B's authorization (approval queue, mentor
// scoping) reads from these.
declare module "next-auth" {
  interface User {
    role: Role;
    status: AccountStatus;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      status: AccountStatus;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    status: AccountStatus;
  }
}
