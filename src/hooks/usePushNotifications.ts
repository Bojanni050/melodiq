"use client";

import { useState, useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export type PushState = "unsupported" | "denied" | "granted" | "default";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setState("granted");
      })
      .catch((err) => {
        console.warn("[push] subscription check failed:", err);
      });
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setError("Push notifications are not configured (missing VAPID key).");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      setState("granted");
    } catch (err: any) {
      console.error("[push] subscribe failed:", err);
      setError(err?.message ?? "Failed to enable push notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!("serviceWorker" in navigator)) return;
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch (err: any) {
      console.error("[push] unsubscribe failed:", err);
      setError(err?.message ?? "Failed to disable push notifications.");
    } finally {
      setLoading(false);
    }
  }

  return { state, loading, error, subscribe, unsubscribe };
}
