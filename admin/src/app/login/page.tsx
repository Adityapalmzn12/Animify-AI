"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setStoredUser, setToken } from "@/lib/api";

type LoginResult = {
  accessToken?: string;
  access_token?: string;
  user: { id: string; email: string; name?: string; role?: string };
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") === "not_admin"
      ? "This account is not an ADMIN."
      : "",
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<LoginResult>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const token = data.accessToken || data.access_token;
      if (!token) throw new Error("No access token returned");
      if ((data.user?.role || "").toUpperCase() !== "ADMIN") {
        throw new Error(
          "Admin role required. Run: UPDATE users SET role = 'ADMIN' WHERE email = '...';",
        );
      }
      setToken(token);
      setStoredUser(data.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel w-full max-w-md p-8 space-y-5">
      <div>
        <h1 className="font-display text-3xl text-accent">Animify Admin</h1>
        <p className="text-muted text-sm mt-2">
          Sign in with an ADMIN account to manage APIs, users, and subscriptions.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-muted">Email</span>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-muted">Password</span>
        <input
          className="input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm text-[var(--bad)] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Suspense fallback={<div className="text-muted">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
