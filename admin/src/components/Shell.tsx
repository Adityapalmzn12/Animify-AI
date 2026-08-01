"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setStoredUser, setToken } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Ops board" },
  { href: "/providers", label: "Buy APIs" },
  { href: "/users", label: "Users" },
  { href: "/subscriptions", label: "Subscriptions" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line md:border-b-0 md:border-r bg-panel/80 backdrop-blur">
        <div className="px-5 py-6">
          <p className="font-display text-2xl tracking-tight text-accent">Animify</p>
          <p className="text-xs uppercase tracking-[0.2em] text-muted mt-1">Admin Ops</p>
        </div>
        <nav className="px-3 pb-6 flex md:flex-col gap-1 overflow-x-auto">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2.5 text-sm whitespace-nowrap ${
                  active
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-6 hidden md:block">
          <button
            className="btn btn-ghost w-full"
            onClick={() => {
              setToken(null);
              setStoredUser(null);
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
