import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNav } from "./_components/AdminNav";
import { signOutAction } from "./actions";

// One gate for the whole admin area (every page under (admin) is protected here)
// plus the shared shell: fixed sidebar + sticky header.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-slate-900 px-3 py-5 md:flex">
        <Link href="/admin" className="mb-5 block px-3">
          <div className="text-sm font-bold text-white">Bridging Generations</div>
          <div className="text-[11px] text-slate-400">Admin console</div>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <AdminNav />
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-6 py-3 backdrop-blur">
          <Link href="/admin" className="text-sm font-semibold text-slate-700 md:hidden">Bridging Generations · Admin</Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{session.user.email}</span>
            <form action={signOutAction}>
              <button className="rounded-md border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50">Sign out</button>
            </form>
          </div>
        </header>

        {/* Mobile nav: the sidebar is hidden on small screens, so links live here too */}
        <div className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          <AdminNav />
        </div>

        {children}
      </div>
    </div>
  );
}
