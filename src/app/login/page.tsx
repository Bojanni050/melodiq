"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/hooks/useT";

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("auth.loginFailed"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(t("auth.unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-canvas text-ink">
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/20 border border-accent/30 mb-4">
            <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-black text-ink">MelodIQ</h1>
          <p className="text-sm text-ink-dim mt-1">{t("auth.tagline")}</p>
        </div>

        {/* Form card */}
        <div className="mq-card p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/25 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-dim mb-1.5">{t("auth.emailLabel")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mq-input text-sm"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-dim mb-1.5">{t("auth.passwordLabel")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mq-input text-sm"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mq-btn mq-btn-primary w-full text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-line/30 border-t-white rounded-full animate-spin" />
                  {t("auth.signingIn")}
                </span>
              ) : (
                t("auth.signIn")
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
