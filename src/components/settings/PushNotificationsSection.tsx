"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function PushNotificationsSection() {
  const { state, loading, error, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="bg-white/5 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Push notificaties</h2>
        <p className="text-sm text-white/50 mt-1">
          Ontvang een melding wanneer een track klaar is met genereren.
        </p>
      </div>

      {state === "unsupported" && (
        <p className="text-sm text-yellow-400">
          Push notificaties worden niet ondersteund door deze browser.
        </p>
      )}

      {state === "denied" && (
        <p className="text-sm text-red-400">
          Notificaties zijn geblokkeerd. Wijzig dit in je browserinstellingen.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {(state === "default" || state === "granted") && (
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
              state === "granted" ? "bg-green-500" : "bg-white/20"
            } ${loading ? "opacity-50 pointer-events-none" : ""}`}
            onClick={state === "granted" ? unsubscribe : subscribe}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                state === "granted" ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
          <span className="text-sm text-white/70">
            {state === "granted" ? "Ingeschakeld" : "Uitgeschakeld"}
          </span>
        </div>
      )}
    </div>
  );
}
