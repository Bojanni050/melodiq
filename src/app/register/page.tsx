"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useT";

export default function RegisterPage() {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-white/50 mb-4">{t("auth.registrationDisabled")}</p>
        <button
          onClick={() => router.push("/login")}
          className="btn-primary py-2.5 px-6 text-sm font-medium"
        >
          {t("auth.goToLogin")}
        </button>
      </div>
    </div>
  );
}
