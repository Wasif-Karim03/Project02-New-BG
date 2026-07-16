"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Overview", links: [{ href: "/admin", label: "Dashboard" }] },
  {
    title: "Queues",
    links: [
      { href: "/approvals", label: "Approvals" },
      { href: "/applications", label: "Applications" },
      { href: "/mentor-applications", label: "Mentor applications" },
      { href: "/donor-approvals", label: "Donor approvals" },
      { href: "/donations-pending", label: "Pending donations" },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/roster", label: "Students" },
      { href: "/users", label: "Staff & users" },
      { href: "/assignments", label: "Mentor assignments" },
    ],
  },
  {
    title: "Money",
    links: [
      { href: "/pledges", label: "Monthly pledges" },
      { href: "/offline-donations", label: "Offline gifts" },
      { href: "/sponsorships", label: "Sponsorships" },
      { href: "/legacy-import", label: "Legacy import" },
    ],
  },
  {
    title: "Website",
    links: [{ href: "/content", label: "Website content" }],
  },
  {
    title: "Insights",
    links: [
      { href: "/reports", label: "Reports & exports" },
      { href: "/audit", label: "Audit log" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.title}</div>
          <ul className="mt-1.5 space-y-0.5">
            {g.links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive(l.href) ? "bg-slate-800 font-medium text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
