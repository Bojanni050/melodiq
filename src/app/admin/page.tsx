"use client";

import { useEffect, useState, type FormEvent } from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";

interface AdminStats {
  totalUsers: number;
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
              <StatTile label="Users" value={stats.totalUsers} />
              <StatTile label="Tracks" value={stats.totalTracks} />
              <StatTile label="Total Plays" value={stats.totalPlays} />
            </div>
          )}

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
