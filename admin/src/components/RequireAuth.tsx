"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/api";

type User = { role?: string; email?: string; name?: string };

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("animify_admin_token");
    const user = getStoredUser<User>();
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    if ((user.role || "").toUpperCase() !== "ADMIN") {
      router.replace("/login?error=not_admin");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-muted">
        Checking admin session…
      </div>
    );
  }

  return <>{children}</>;
}
