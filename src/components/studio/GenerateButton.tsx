"use client";

export default function GenerateButton({
  loading,
  onClick,
  disabled,
  className,
  label = "Generate",
  loadingLabel = "Generating...",
}: {
  loading: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  loadingLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-45 ${className ?? ""}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
