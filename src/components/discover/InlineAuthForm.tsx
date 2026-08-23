"use client";

import { useState } from "react";
import { useT } from "@/hooks/useT";

export default function InlineAuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const t = useT();
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
        setAuthError(data.error || t("auth.genericError"));
        return;
      }

      onAuthenticated();
    } catch {
      setAuthError(t("auth.unexpectedError"));
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
          {t("auth.signIn")}
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode("register");
            setAuthError("");
          }}
          className={`rounded-full px-3 py-1.5 transition-colors ${authMode === "register" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
        >
          {t("auth.signUp")}
        </button>
      </div>
      <form onSubmit={handleAuthSubmit} className="space-y-3">
        {authMode === "register" && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder")}
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
          placeholder={t("auth.passwordPlaceholder")}
          required
          autoComplete={authMode === "login" ? "current-password" : "new-password"}
          className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
        />
        {authError && <p className="text-sm text-red-400">{authError}</p>}
        <button
          type="submit"
          disabled={authLoading || !email || !password}
          className="h-10 w-full rounded-xl bg-white text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-60"
        >
          {authLoading ? "…" : authMode === "login" ? t("auth.signIn") : t("auth.signUp")}
        </button>
      </form>
      <p className="mt-3 text-center text-sm text-white/35">
        {authMode === "login" ? (
          <>
            {t("auth.newHere")}{" "}
            <button type="button" onClick={() => setAuthMode("register")} className="text-white/60 hover:text-white">
              {t("auth.createAccount")}
            </button>
          </>
        ) : (
          <>
            {t("auth.alreadyHaveAccount")}{" "}
            <button type="button" onClick={() => setAuthMode("login")} className="text-white/60 hover:text-white">
              {t("auth.signInLower")}
            </button>
          </>
        )}
      </p>
    </section>
  );
}
