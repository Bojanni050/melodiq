"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const ROLES = [
  { value: "user", label: "User" },
  { value: "listener", label: "Listener" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsersPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [userList, setUserList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function checkRole() {
      try {
        const res = await fetch("/api/auth/me");
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.user?.role === "admin");
          setSelfId(data.user?.id ?? null);
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

  async function loadUsers() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUserList(data.users || []);
      } else {
        setLoadError("Failed to load users.");
      }
    } catch {
      setLoadError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setEditEmail(user.email);
    setEditPassword("");
    setEditName(user.name ?? "");
    setEditRole(user.role);
    setEditError(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const body: Record<string, string> = { email: editEmail, name: editName, role: editRole };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(data?.error || "Failed to update user");
        return;
      }
      setUserList((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
      setEditingUser(null);
    } catch {
      setEditError("Network error — could not reach the server.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteError(data?.error || "Failed to delete user");
        return;
      }
      setUserList((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setDeletingUser(null);
    } catch {
      setDeleteError("Network error — could not reach the server.");
    } finally {
      setDeleting(false);
    }
  }

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
            <Link href="/admin" className="text-xs text-white/40 hover:text-white/70">← Admin</Link>
            <p className="mt-2 text-xs uppercase tracking-[0.28em] text-white/35">Admin</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Users</h1>
          </div>

          {loading ? (
            <p className="text-sm text-white/50">Loading...</p>
          ) : loadError ? (
            <p className="text-sm text-red-400">{loadError}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        {u.email}
                        {u.id === selfId && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">You</span>}
                      </td>
                      <td className="px-4 py-3 text-white/70">{u.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs capitalize text-white/70">{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-white/40">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeletingUser(u); setDeleteError(null); }}
                            disabled={u.id === selfId}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditingUser(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Edit {editingUser.email}</h2>
            <form onSubmit={saveEdit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Email</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">New password (leave blank to keep current)</label>
                <input
                  type="password"
                  minLength={8}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={editingUser.id === selfId}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {editingUser.id === selfId && (
                  <p className="mt-1 text-xs text-white/30">You can't change your own role.</p>
                )}
              </div>

              {editError && <p className="text-sm text-red-400">{editError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => !deleting && setDeletingUser(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Delete {deletingUser.email}?</h2>
            <p className="mt-2 text-sm text-white/50">
              This permanently deletes the account and can't be undone. Any tracks, playlists, or releases they
              own will remain in the database but become orphaned (no owner).
            </p>
            {deleteError && <p className="mt-2 text-sm text-red-400">{deleteError}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={deleting}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
