"use client";

export default function NoticeBar({
  notice,
  onClose,
}: {
  notice: { type: "error" | "success"; message: string } | null;
  onClose: () => void;
}) {
  if (!notice) return null;

  const isError = notice.type === "error";

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-xl ${isError ? "border-red-500/30 bg-[#201215]" : "border-green-500/30 bg-[#122018]"}`}>
      <div className="flex items-start gap-3">
        <svg className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? "text-red-300" : "text-green-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isError ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          )}
        </svg>
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${isError ? "text-red-100" : "text-green-100"}`}>{notice.message}</p>
        </div>
        <button
          onClick={onClose}
          className={isError ? "text-red-200/70 hover:text-red-100" : "text-green-200/70 hover:text-green-100"}
          aria-label="Close notification"
          title="Close"
        >
          x
        </button>
      </div>
    </div>
  );
}
