"use client";

interface TrackRatingProps {
  rating: string | null;
  ratingLoading: boolean;
  onRate: (newRating: "up") => void;
}

export default function TrackRating({
  rating,
  ratingLoading,
  onRate,
}: TrackRatingProps) {
  const isFavorite = rating === "up";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRate("up");
      }}
      disabled={ratingLoading}
      className={`hidden md:inline-flex p-1 rounded-lg transition-all duration-200 ${
        isFavorite ? "text-pink-400" : "text-white/20 hover:text-pink-300"
      }`}
      style={{
        boxShadow: isFavorite
          ? "inset -1px -1px 3px rgba(244, 114, 182, 0.1), inset 1px 1px 3px rgba(0, 0, 0, 0.4)"
          : "-1px -1px 3px rgba(255, 255, 255, 0.03), 1px 1px 3px rgba(0, 0, 0, 0.3)",
      }}
      title="Favoriet"
      aria-label={isFavorite ? "Remove from Favorieten" : "Add to Favorieten"}
    >
      <svg className="w-3.5 h-3.5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
}
