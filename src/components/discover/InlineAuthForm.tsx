"use client";

import { useState } from "react";

export default function InlineAuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        authMode === "login"
          ? { email, password }
          : { email, password, name: name.trim() || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAuthError(data.error || "Something went wrong");
        return;
      }

      onAuthenticated();
    } catch {
      setAuthError("An unexpected error occurred");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <section className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setAuthMode("login");
            setAuthError("");
          }}
          className={`rounded-full px-3 py-1.5 transition-colors ${authMode === "login" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode("register");
            setAuthError("");
          }}
          className={`rounded-full px-3 py-1.5 transition-colors ${authMode === "register" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
        >
          Sign Up
        </button>
      </div>
      <form onSubmit={handleAuthSubmit} className="space-y-3">
        {authMode === "register" && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoComplete={authMode === "login" ? "current-password" : "new-password"}
          className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
        />
        {authError && <p className="text-xs text-red-400">{authError}</p>}
        <button
          type="submit"
          disabled={authLoading || !email || !password}
          className="h-10 w-full rounded-xl bg-white text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-60"
        >
          {authLoading ? "…" : authMode === "login" ? "Sign In" : "Sign Up"}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-white/35">
        {authMode === "login" ? (
          <>
            New here?{" "}
            <button type="button" onClick={() => setAuthMode("register")} className="text-white/60 hover:text-white">
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => setAuthMode("login")} className="text-white/60 hover:text-white">
              Sign in
            </button>
          </>
        )}
      </p>
    </section>
  );
}
