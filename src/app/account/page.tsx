"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore, useUserStore, useLocaleStore, LOCALES, type Locale } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { MAX_ARTIST_ALIASES, MAX_COMPOSER_ALIASES, MAX_WRITER_ALIASES } from "@/lib/artist-aliases";

interface User {
  id: string;
  email: string;
  name: string | null;
  artistAlias: string | null;
  artistAliases: string[];
  composerAlias: string | null;
  writerAlias: string | null;
  composerAliases: string[];
  writerAliases: string[];
  bio: string | null;
  profileImageUrl: string | null;
  heroImageUrl: string | null;
  language: string;
  createdAt: string;
}

type AccountTab = "profile" | "security";

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
      <label className="block text-xs font-medium uppercase tracking-wider text-ink-dim mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-dim mt-1.5">{hint}</p>}
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
  const [composerAliases, setComposerAliases] = useState<string[]>(Array(MAX_COMPOSER_ALIASES).fill(""));
  const [writerAliases, setWriterAliases] = useState<string[]>(Array(MAX_WRITER_ALIASES).fill(""));
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageError, setProfileMessageError] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityMessageError, setSecurityMessageError] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const TABS: { id: AccountTab; label: string }[] = [
    { id: "profile", label: t("account.tabProfile") },
    { id: "security", label: t("account.tabSecurity") },
  ];

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
        const loadedComposers: string[] = data.user?.composerAliases?.length
          ? data.user.composerAliases
          : data.user?.composerAlias
            ? [data.user.composerAlias]
            : [];
        setComposerAliases(Array.from({ length: MAX_COMPOSER_ALIASES }, (_, i) => loadedComposers[i] || ""));
        const loadedWriters: string[] = data.user?.writerAliases?.length
          ? data.user.writerAliases
          : data.user?.writerAlias
            ? [data.user.writerAlias]
            : [];
        setWriterAliases(Array.from({ length: MAX_WRITER_ALIASES }, (_, i) => loadedWriters[i] || ""));
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
    setProfileMessageError(false);
    const res = await fetch("/api/auth/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, artistAliases, composerAliases, writerAliases, bio }),
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      // Mirror the saved profile into the global user store so pages that
      // read aliases from there (Studio, Releases, Playlists, ...) see the
      // new value immediately instead of after a full reload — loadUser
      // caches once per session and would otherwise keep the stale list.
      if (authUser) setAuthUser({ ...authUser, ...data.user });
      setProfileMessage(t("account.profileUpdated"));
    } else {
      setProfileMessageError(true);
      setProfileMessage(data.error || t("account.profileUpdateFailed"));
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
    setSecurityMessageError(false);
    if (newPassword !== confirmPassword) {
      setSecurityMessageError(true);
      setSecurityMessage(t("account.passwordsDontMatch"));
      setSavingSecurity(false);
      return;
    }
    if (newPassword.length < 8) {
      setSecurityMessageError(true);
      setSecurityMessage(t("account.passwordTooShort"));
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
      setSecurityMessage(t("account.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setSecurityMessageError(true);
      setSecurityMessage(data.error || t("account.passwordUpdateFailed"));
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
        setProfileMessageError(true);
        setProfileMessage(t("account.heroImageTooSmall", { width: dimensions.width, height: dimensions.height }));
        return;
      }
    }
    const upload = type === "profile" ? setUploadingProfile : setUploadingHero;
    upload(true);
    setProfileMessage("");
    setProfileMessageError(false);
    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("file", file);
      const res = await fetch("/api/account/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, [type === "profile" ? "profileImageUrl" : "heroImageUrl"]: data.url } : prev);
        setProfileMessage(t("account.imageUploaded"));
      } else {
        setProfileMessageError(true);
        setProfileMessage(data.error || t("account.uploadFailed"));
      }
    } catch {
      setProfileMessageError(true);
      setProfileMessage(t("account.uploadFailed"));
    } finally {
      upload(false);
    }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

  if (loading) {
    return (
      <div className="h-screen bg-canvas overflow-hidden">
        <Sidebar credits={null} />
        <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))]" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? "var(--sidebar-collapsed)" : isQHD ? "var(--sidebar-width-qhd)" : "var(--sidebar-width)" }}>
          <div className="flex items-center justify-center h-full">
            <p className="text-ink-dim">{t("account.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-canvas overflow-hidden">
      <Sidebar credits={null} />
      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] overflow-y-auto" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? "var(--sidebar-collapsed)" : isQHD ? "var(--sidebar-width-qhd)" : "var(--sidebar-width)" }}>
        <main className="px-4 pt-[68px] pb-10 sm:px-6 lg:pt-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink">{t("account.title")}</h1>

          {/* Tabs */}
          <nav className="mt-8 flex items-center gap-8 border-b border-line">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-base font-medium transition-colors ${
                  activeTab === tab.id ? "text-ink" : "text-ink-dim hover:text-ink-muted"
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
                <h2 className="text-lg font-semibold text-ink mb-4">{t("settings.language")}</h2>
                <div className=" border border-line bg-white/[0.04] p-6 sm:p-8">
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
                              ? "bg-accent/80 text-ink"
                              : "bg-white/5 text-ink-muted hover:bg-white/10"
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
                <h2 className="text-lg font-semibold text-ink mb-4">{t("account.identity")}</h2>
                <div className=" border border-line bg-white/[0.04] p-6 sm:p-8 space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label={t("account.nameLabel")}>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field text-sm"
                        placeholder={t("account.namePlaceholder")}
                      />
                    </Field>
                    <Field label={t("account.emailLabel")}>
                      <input
                        type="text"
                        value={user?.email || ""}
                        disabled
                        className="input-field text-sm bg-white/5 text-ink-dim cursor-not-allowed"
                      />
                    </Field>
                  </div>

                  <div className="h-px bg-white/8" />

                  <Field label={t("account.artistAliases")} hint={t("account.artistAliasesHint")}>
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
                          placeholder={i === 0 ? t("account.aliasPlaceholderPrimary") : t("account.aliasPlaceholder", { n: i + 1 })}
                          maxLength={255}
                        />
                      ))}
                    </div>
                  </Field>

                  <Field label={t("account.composerAlias")} hint={t("account.composerAliasHint")}>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {composerAliases.map((alias, i) => (
                        <input
                          key={i}
                          type="text"
                          value={alias}
                          onChange={(e) =>
                            setComposerAliases((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))
                          }
                          className="input-field text-sm"
                          placeholder={i === 0 ? t("account.aliasPlaceholderPrimary") : t("account.aliasPlaceholder", { n: i + 1 })}
                          maxLength={255}
                        />
                      ))}
                    </div>
                  </Field>

                  <Field label={t("account.writerAlias")} hint={t("account.writerAliasHint")}>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {writerAliases.map((alias, i) => (
                        <input
                          key={i}
                          type="text"
                          value={alias}
                          onChange={(e) =>
                            setWriterAliases((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))
                          }
                          className="input-field text-sm"
                          placeholder={i === 0 ? t("account.aliasPlaceholderPrimary") : t("account.aliasPlaceholder", { n: i + 1 })}
                          maxLength={255}
                        />
                      ))}
                    </div>
                  </Field>

                  <Field label={t("account.memberSince")}>
                    <p className="text-sm text-ink-muted py-2">{memberSince}</p>
                  </Field>
                </div>

                  {/* Profile photo + Hero image */}
                  <div className="h-px bg-white/8" />
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <Field label={t("account.profilePhoto")}>
                        <div className="flex items-center gap-3">
                          {user?.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="" loading="lazy" decoding="async" className="w-14 h-14 rounded-full object-cover" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center">
                              <svg className="w-6 h-6 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          <label className="cursor-pointer  border border-line bg-white/5 px-3 py-1.5 text-sm text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors">
                            {uploadingProfile ? t("account.uploading") : t("account.upload")}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("profile", f); }} />
                          </label>
                        </div>
                      </Field>
                    </div>
                    <div>
                      <Field label={t("account.heroImage")} hint={t("account.heroImageHint")}>
                        <div className="flex items-center gap-3">
                          {user?.heroImageUrl ? (
                            <img src={user.heroImageUrl} alt="" loading="lazy" decoding="async" className="w-28 h-14  object-cover" />
                          ) : (
                            <div className="w-28 h-14  bg-white/[0.06] flex items-center justify-center">
                              <svg className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <label className="cursor-pointer  border border-line bg-white/5 px-3 py-1.5 text-sm text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors">
                            {uploadingHero ? t("account.uploading") : t("account.upload")}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("hero", f); }} />
                          </label>
                        </div>
                      </Field>
                    </div>
                  </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-ink">{t("account.artistBio")}</h2>
                  {user?.id && (
                    <Link
                      href={`/discover/artist/${user.id}`}
                      target="_blank"
                      className="text-xs font-medium text-ink-dim hover:text-ink-muted transition-colors"
                    >
                      {t("account.viewPublicPage")}
                    </Link>
                  )}
                </div>
                <div className=" border border-line bg-white/[0.04] p-6 sm:p-8">
                  <Field label={t("account.bioLabel")} hint={t("account.bioHint")}>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={6}
                      className="input-field text-sm resize-y"
                      placeholder={t("account.bioPlaceholder")}
                      maxLength={4000}
                    />
                  </Field>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className=" bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {savingProfile ? t("account.saving") : t("account.saveProfile")}
                </button>
                {profileMessage && (
                  <p className={`text-sm ${profileMessageError ? "text-red-400" : "text-green-400"}`}>
                    {profileMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="mt-8 space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-ink mb-4">{t("account.changePassword")}</h2>
                <div className=" border border-line bg-white/[0.04] p-6 sm:p-8 space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Field label={t("account.currentPassword")}>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field text-sm"
                        placeholder={t("account.currentPasswordPlaceholder")}
                      />
                    </Field>
                    <div />
                    <Field label={t("account.newPassword")}>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field text-sm"
                        placeholder={t("account.newPasswordPlaceholder")}
                      />
                    </Field>
                    <Field label={t("account.confirmPassword")}>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field text-sm"
                        placeholder={t("account.confirmPasswordPlaceholder")}
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button
                  onClick={savePassword}
                  disabled={savingSecurity || !currentPassword || !newPassword || !confirmPassword}
                  className=" bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSecurity ? t("account.saving") : t("account.changePassword")}
                </button>
                {securityMessage && (
                  <p className={`text-sm ${securityMessageError ? "text-red-400" : "text-green-400"}`}>
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
