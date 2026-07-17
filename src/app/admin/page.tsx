"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

interface AdminStats {
  totalUsers: number;
  totalSongs: number;
  publishedSongs: number;
  totalTracks: number;
  totalPlays: number;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkRole() {
      try {
        const res = await fetch("/api/auth/me");
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.user?.role === "admin");
        }
      } finally {
        if (active) setChecking(false);
      }
    }
    checkRole();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/stats");
        if (!active) return;
        if (res.ok) setStats(await res.json());
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchStats();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (checking) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f] text-white">
        <Sidebar credits={null} />
        <main className="flex-1 flex items-center justify-center text-sm text-white/50">Checking access...</main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f] text-white">
        <Sidebar credits={null} />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/60">This page is restricted to admins.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      <Sidebar credits={null} />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-6 pb-16">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/35">Admin</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Platform Stats</h1>
          </div>

          {loading || !stats ? (
            <p className="text-sm text-white/50">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              <StatTile label="Users" value={stats.totalUsers} />
              <StatTile label="Songs" value={stats.totalSongs} />
              <StatTile label="Published Songs" value={stats.publishedSongs} />
              <StatTile label="Track Versions" value={stats.totalTracks} />
              <StatTile label="Total Plays" value={stats.totalPlays} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
