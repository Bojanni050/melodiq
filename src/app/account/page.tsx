"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore, useUserStore, useLocaleStore, LOCALES, type Locale } from "@/lib/store";
import { useT } from "@/hooks/useT";

const MAX_ARTIST_ALIASES = 5;

interface User {
  id: string;
  email: string;
  name: string | null;
  artistAlias: string | null;
  artistAliases: string[];
  composerAlias: string | null;
  writerAlias: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  heroImageUrl: string | null;
  language: string;
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
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const authUser = useUserStore((s) => s.user);
  const setAuthUser = useUserStore((s) => s.setUser);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isListener = authUser?.role === "listener" || authUser?.role == null;
  const t = useT();
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [artistAliases, setArtistAliases] = useState<string[]>(Array(MAX_ARTIST_ALIASES).fill(""));
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
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setName(data.user?.name || "");
        const loadedAliases: string[] = data.user?.artistAliases?.length
          ? data.user.artistAliases
          : data.user?.artistAlias
            ? [data.user.artistAlias]
            : [];
        setArtistAliases(
          Array.from({ length: MAX_ARTIST_ALIASES }, (_, i) => loadedAliases[i] || "")
        );
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
      body: JSON.stringify({ name, artistAliases, composerAlias, writerAlias, bio }),
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

  async function handleLanguageChange(language: Locale) {
    setSavingLanguage(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser((prev) => (prev ? { ...prev, language } : prev));
        setLocale(language);
        if (authUser) setAuthUser({ ...authUser, language: data.user?.language ?? language });
      }
    } finally {
      setSavingLanguage(false);
    }
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

  async function uploadImage(type: "profile" | "hero", file: File) {
    if (type === "hero") {
      const img = new Image();
      const url = URL.createObjectURL(file);
      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
        img.src = url;
      });
      URL.revokeObjectURL(url);
      if (dimensions.width < 1920 || dimensions.height < 1080) {
        setProfileMessage(`Hero image must be at least 1920×1080 (uploaded: ${dimensions.width}×${dimensions.height})`);
        return;
      }
    }
    const upload = type === "profile" ? setUploadingProfile : setUploadingHero;
    upload(true);
    setProfileMessage("");
    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("file", file);
      const res = await fetch("/api/account/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, [type === "profile" ? "profileImageUrl" : "heroImageUrl"]: data.url } : prev);
        setProfileMessage("Image uploaded");
      } else {
        setProfileMessage(data.error || "Upload failed");
      }
    } catch {
      setProfileMessage("Upload failed");
    } finally {
      upload(false);
    }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] overflow-hidden">
        <Sidebar credits={null} />
        <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))]" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
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
      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] overflow-y-auto" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className="px-4 pt-[68px] pb-10 sm:px-6 lg:pt-10 max-w-4xl mx-auto">
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
                <h2 className="text-lg font-semibold text-white mb-4">{t("settings.language")}</h2>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 sm:p-8">
                  <Field label={t("settings.language")} hint={t("settings.languageHint")}>
                    <div className="flex gap-2">
                      {LOCALES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={savingLanguage}
                          onClick={() => handleLanguageChange(opt.value)}
                          className={`h-10 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                            (user?.language || "en") === opt.value
                              ? "bg-primary-500/80 text-white"
                              : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </section>

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

                  <Field label="Artist aliases" hint="Your public artist name(s) (optional). The first one is used wherever an artist name is shown but the track has none set.">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {artistAliases.map((alias, i) => (
                        <input
                          key={i}
                          type="text"
                          value={alias}
                          onChange={(e) =>
                            setArtistAliases((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))
                          }
                          className="input-field text-sm"
                          placeholder={i === 0 ? "e.g. DJ Bojan (primary)" : `Alias ${i + 1}`}
                          maxLength={255}
                        />
                      ))}
                    </div>
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-6">
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

                  {/* Profile photo + Hero image */}
                  <div className="h-px bg-white/8" />
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <Field label="Profile photo">
                        <div className="flex items-center gap-3">
                          {user?.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center">
                              <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          <label className="cursor-pointer rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors">
                            {uploadingProfile ? "Uploading..." : "Upload"}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("profile", f); }} />
                          </label>
                        </div>
                      </Field>
                    </div>
                    <div>
                      <Field label="Hero image" hint="Min. 1920×1080 — shown on your public artist page.">
                        <div className="flex items-center gap-3">
                          {user?.heroImageUrl ? (
                            <img src={user.heroImageUrl} alt="" className="w-28 h-14 rounded-lg object-cover" />
                          ) : (
                            <div className="w-28 h-14 rounded-lg bg-white/[0.06] flex items-center justify-center">
                              <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <label className="cursor-pointer rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors">
                            {uploadingHero ? "Uploading..." : "Upload"}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("hero", f); }} />
                          </label>
                        </div>
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
