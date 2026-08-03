"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface User {
  id: string;
  email: string;
  name: string | null;
  artistAlias: string | null;
  composerAlias: string | null;
  writerAlias: string | null;
  bio: string | null;
  createdAt: string;
}

type AccountTab = "profile" | "security";

const TABS: { id: AccountTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-white/35 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/25 mt-1.5">{hint}</p>}
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [artistAlias, setArtistAlias] = useState("");
  const [composerAlias, setComposerAlias] = useState("");
  const [writerAlias, setWriterAlias] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setName(data.user?.name || "");
        setArtistAlias(data.user?.artistAlias || "");
        setComposerAlias(data.user?.composerAlias || "");
        setWriterAlias(data.user?.writerAlias || "");
        setBio(data.user?.bio || "");
      } else {
        router.push("/login");
      }
      setLoading(false);
    }
    loadUser();
  }, [router]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMessage("");
    const res = await fetch("/api/auth/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, artistAlias, composerAlias, writerAlias, bio }),
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setProfileMessage("Profile updated successfully");
    } else {
      setProfileMessage(data.error || "Failed to update profile");
    }
    setSavingProfile(false);
  }

  async function savePassword() {
    setSavingSecurity(true);
    setSecurityMessage("");
    if (newPassword !== confirmPassword) {
      setSecurityMessage("Passwords do not match");
      setSavingSecurity(false);
      return;
    }
    if (newPassword.length < 8) {
      setSecurityMessage("Password must be at least 8 characters");
      setSavingSecurity(false);
      return;
    }
    const res = await fetch("/api/auth/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setSecurityMessage("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setSecurityMessage(data.error || "Failed to update password");
    }
    setSavingSecurity(false);
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] overflow-hidden">
        <Sidebar credits={null} />
        <div className="lg:ml-60 h-[calc(100vh-var(--player-height))]">
          <div className="flex items-center justify-center h-full">
            <p className="text-white/50">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={null} />
      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] overflow-y-auto">
        <main className="px-6 py-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">Account</h1>

          {/* Tabs */}
          <nav className="mt-8 flex items-center gap-8 border-b border-white/10">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-base font-medium transition-colors ${
                  activeTab === tab.id ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
            ))}
          </nav>

          {activeTab === "profile" && (
            <div className="mt-8 space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">Identity</h2>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 sm:p-8 space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label="Name">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field text-sm"
                        placeholder="Your name"
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="text"
                        value={user?.email || ""}
                        disabled
                        className="input-field text-sm bg-white/5 text-white/30 cursor-not-allowed"
                      />
                    </Field>
                  </div>

                  <div className="h-px bg-white/8" />

                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label="Artist alias" hint="Your public artist name (optional).">
                      <input
                        type="text"
                        value={artistAlias}
                        onChange={(e) => setArtistAlias(e.target.value)}
                        className="input-field text-sm"
                        placeholder="e.g. DJ Bojan"
                        maxLength={255}
                      />
                    </Field>
                    <Field label="Composer alias" hint="Default composer on new tracks. Falls back to your name.">
                      <input
                        type="text"
                        value={composerAlias}
                        onChange={(e) => setComposerAlias(e.target.value)}
                        className="input-field text-sm"
                        placeholder="e.g. Bojan van den Hoek"
                        maxLength={255}
                      />
                    </Field>
                    <Field label="Writer alias" hint="Default lyrics writer on new tracks. Falls back to your artist alias.">
                      <input
                        type="text"
                        value={writerAlias}
                        onChange={(e) => setWriterAlias(e.target.value)}
                        className="input-field text-sm"
                        placeholder="e.g. Bojan van den Hoek"
                        maxLength={255}
                      />
                    </Field>
                    <Field label="Member since">
                      <p className="text-sm text-white/70 py-2">{memberSince}</p>
                    </Field>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Artist bio</h2>
                  {user?.id && (
                    <Link
                      href={`/discover/artist/${user.id}`}
                      target="_blank"
                      className="text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
                    >
                      View public artist page →
                    </Link>
                  )}
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 sm:p-8">
                  <Field label="Bio" hint="Shown on your public artist page. Separate paragraphs with a blank line.">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={6}
                      className="input-field text-sm resize-y"
                      placeholder="Tell listeners who you are and what you make..."
                      maxLength={4000}
                    />
                  </Field>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
                {profileMessage && (
                  <p className={`text-sm ${profileMessage.includes("successfully") ? "text-green-400" : "text-red-400"}`}>
                    {profileMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="mt-8 space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">Change password</h2>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 sm:p-8 space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label="Current password">
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field text-sm"
                        placeholder="Enter current password"
                      />
                    </Field>
                    <div />
                    <Field label="New password">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field text-sm"
                        placeholder="At least 8 characters"
                      />
                    </Field>
                    <Field label="Confirm new password">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field text-sm"
                        placeholder="Re-enter new password"
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button
                  onClick={savePassword}
                  disabled={savingSecurity || !currentPassword || !newPassword || !confirmPassword}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSecurity ? "Saving..." : "Change password"}
                </button>
                {securityMessage && (
                  <p className={`text-sm ${securityMessage.includes("successfully") ? "text-green-400" : "text-red-400"}`}>
                    {securityMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
