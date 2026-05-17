"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-white/50 mb-4">Registration is currently disabled.</p>
        <button
          onClick={() => router.push("/login")}
          className="btn-primary py-2.5 px-6 text-sm font-medium"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}
