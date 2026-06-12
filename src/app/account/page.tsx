"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface User {
  id: string;
  email: string;
  name: string | null;
  artistAlias: string | null;
  createdAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [artistAlias, setArtistAlias] = useState("");
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
      body: JSON.stringify({ name, artistAlias }),
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
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
          <div className="px-4 py-3">
            <h1 className="text-lg font-bold">Account</h1>
            <p className="text-xs text-white/40 mt-0.5">Manage your profile and security settings</p>
          </div>
        </div>
        <main className="p-4 max-w-2xl">
          <div className="space-y-4">
            {/* Profile Section */}
            <section className="section-card">
              <h2 className="text-sm font-semibold mb-4">Profile</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Composer alias</label>
                  <input
                    type="text"
                    value={artistAlias}
                    onChange={(e) => setArtistAlias(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="e.g. DJ Bojan"
                    maxLength={255}
                  />
                  <p className="text-xs text-white/25 mt-1">Used as the default composer on new tracks. Falls back to your name if empty.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Email</label>
                  <input
                    type="text"
                    value={user?.email || ""}
                    disabled
                    className="input-field font-mono text-sm bg-white/5 text-white/30 cursor-not-allowed"
                  />
                  <p className="text-xs text-white/25 mt-1">Email cannot be changed</p>
                </div>
                {profileMessage && (
                  <p className={`text-xs ${profileMessage.includes("successfully") ? "text-green-400" : "text-red-400"}`}>
                    {profileMessage}
                  </p>
                )}
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </section>

            {/* Security Section */}
            <section className="section-card">
              <h2 className="text-sm font-semibold mb-4">Security</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="Re-enter new password"
                  />
                </div>
                {securityMessage && (
                  <p className={`text-xs ${securityMessage.includes("successfully") ? "text-green-400" : "text-red-400"}`}>
                    {securityMessage}
                  </p>
                )}
                <button
                  onClick={savePassword}
                  disabled={savingSecurity || !currentPassword || !newPassword || !confirmPassword}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {savingSecurity ? "Saving..." : "Change Password"}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
