"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function MagicLinkVerifyPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkVerify />
    </Suspense>
  );
}

function MagicLinkVerify() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setError("This link is missing its token.");
      return;
    }

    let active = true;
    async function verify() {
      try {
        const res = await fetch("/api/auth/magic-link/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!active) return;

        if (!res.ok) {
          setStatus("error");
          setError(data.error || "This link is invalid or has expired.");
          return;
        }

        router.push("/");
        router.refresh();
      } catch {
        if (!active) return;
        setStatus("error");
        setError("An unexpected error occurred.");
      }
    }
    verify();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="aurora absolute inset-0 opacity-30" />

      <div className="w-full max-w-sm relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-4">
          <svg className="w-8 h-8 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>

        <div className="section-card">
          {status === "verifying" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-sm text-white/60">Signing you in…</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-red-300">{error}</p>
              <Link href="/login" className="inline-block w-full btn-primary py-2.5 text-sm font-medium text-center">
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
