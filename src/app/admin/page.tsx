"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";
import { formatBytes } from "@/lib/perfMonitor";

interface AdminStats {
  totalUsers: number;
  totalTracks: number;
  totalPlays: number;
}

interface PerfSnapshot {
  sessionStartedAt: number;
  uptimeMs: number;
  visibleMs: number;
  hiddenMs: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  networkBytes: number;
  networkBytesByCategory: Record<string, number>;
  networkBytesFormatted: string;
  networkUncounted: number;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
  storageUsageFormatted: string | null;
}

function StatTile({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
        {content}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      {content}
    </div>
  );
}

const ROLES = [
  { value: "user", label: "User" },
  { value: "listener", label: "Listener" },
  { value: "admin", label: "Admin" },
];

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserNotice, setCreateUserNotice] = useState<string | null>(null);
  const [perfSnapshot, setPerfSnapshot] = useState<PerfSnapshot | null>(null);
  const [perfLogging, setPerfLogging] = useState(false);
  const [refreshingPerf, setRefreshingPerf] = useState(false);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setCreateUserError(null);
    setCreateUserNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: newRole }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateUserError(data?.error || "Failed to create user");
        return;
      }
      setCreateUserNotice(`Created ${data.user.email} with role "${data.user.role}".`);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("user");
      setStats((prev) => (prev ? { ...prev, totalUsers: prev.totalUsers + 1 } : prev));
    } catch {
      setCreateUserError("Network error — could not reach the server.");
    } finally {
      setCreatingUser(false);
    }
  }

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

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    function updateSnapshot() {
      if (active && typeof window !== "undefined" && (window as any).__melodiqPerf) {
        setPerfSnapshot((window as any).__melodiqPerf.snapshot());
      }
    }
    
    updateSnapshot();
    const interval = setInterval(updateSnapshot, 5000);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

  if (checking) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f] text-white" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <Sidebar credits={null} />
        <main className="flex-1 flex items-center justify-center text-sm text-white/50">Checking access...</main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f] text-white" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
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
    <div className="flex min-h-screen bg-[#0a0a0f] text-white" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
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
              <StatTile label="Users" value={stats.totalUsers} href="/admin/users" />
              <StatTile label="Tracks" value={stats.totalTracks} />
              <StatTile label="Total Plays" value={stats.totalPlays} />
            </div>
          )}

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Performance Monitor</h2>
                <p className="mt-1 text-sm text-white/40">Real-time prestatiegegevens en netwerkverbruik</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && (window as any).__melodiqPerf) {
                    setPerfLogging(!perfLogging);
                    (window as any).__melodiqPerf.setLogging(!perfLogging);
                  }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  perfLogging
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-white/10 text-white/60 hover:bg-white/15"
                }`}
              >
                {perfLogging ? "Logging aan" : "Logging uit"}
              </button>
            </div>

            {perfSnapshot ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Uptime & Visibility */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Sessie</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {(perfSnapshot.uptimeMs / 1000 / 60).toFixed(0)} min
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Zichtbaar: {(perfSnapshot.visibleMs / 1000 / 60).toFixed(1)} min | 
                    Verborgen: {(perfSnapshot.hiddenMs / 1000 / 60).toFixed(1)} min
                  </p>
                </div>

                {/* Network Usage */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Netwerkverbruik</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {perfSnapshot.networkBytesFormatted}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Audio</span>
                      <span className="text-white/80">{formatBytes(perfSnapshot.networkBytesByCategory.audio)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Afbeeldingen</span>
                      <span className="text-white/80">{formatBytes(perfSnapshot.networkBytesByCategory.image)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">API</span>
                      <span className="text-white/80">{formatBytes(perfSnapshot.networkBytesByCategory.api)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Overig</span>
                      <span className="text-white/80">{formatBytes(perfSnapshot.networkBytesByCategory.other)}</span>
                    </div>
                    {perfSnapshot.networkUncounted > 0 && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Onbekend (cross-origin)</span>
                        <span className="text-white/80">+{perfSnapshot.networkUncounted}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Storage Usage */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Browser opslag</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {perfSnapshot.storageUsageFormatted || "Onbekend"}
                  </p>
                  {perfSnapshot.storageQuotaBytes && (
                    <p className="text-xs text-white/40 mt-1">
                      Quota: {formatBytes(perfSnapshot.storageQuotaBytes)}
                    </p>
                  )}
                </div>

                {/* Long Tasks */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Main-thread belasting</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {perfSnapshot.longTaskCount}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Totaal: {Math.round(perfSnapshot.longTaskTotalMs)}ms | 
                    Max: {Math.round(perfSnapshot.longTaskMaxMs)}ms
                  </p>
                </div>

                {/* Session Start */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Sessie gestart</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {new Date(perfSnapshot.sessionStartedAt).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {new Date(perfSnapshot.sessionStartedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50">Performancedata wordt geladen...</p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Add User</h2>
            <p className="mt-1 text-sm text-white/40">Creates an account directly — bypasses the registration gate.</p>

            <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary-500"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Name (optional)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary-500"
                  placeholder="Display name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingUser ? "Creating…" : "Create user"}
                </button>
                {createUserError && <p className="text-sm text-red-400">{createUserError}</p>}
                {createUserNotice && <p className="text-sm text-emerald-400">{createUserNotice}</p>}
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
