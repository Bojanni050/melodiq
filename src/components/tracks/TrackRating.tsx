"use client";

interface TrackRatingProps {
  rating: string | null;
  ratingLoading: boolean;
  onRate: (newRating: "up" | "down") => void;
}

export default function TrackRating({
  rating,
  ratingLoading,
  onRate,
}: TrackRatingProps) {
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate("up");
        }}
        disabled={ratingLoading}
        className={`hidden md:inline-flex p-1 rounded-lg transition-all duration-200 ${
          rating === "up" ? "text-green-400" : "text-white/20 hover:text-green-300"
        }`}
        style={{
          boxShadow:
            rating === "up"
              ? "inset -1px -1px 3px rgba(74, 222, 128, 0.1), inset 1px 1px 3px rgba(0, 0, 0, 0.4)"
              : "-1px -1px 3px rgba(255, 255, 255, 0.03), 1px 1px 3px rgba(0, 0, 0, 0.3)",
        }}
        title="Thumbs up"
        aria-label="Rate track positive"
      >
        <svg className="w-3.5 h-3.5" fill={rating === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate("down");
        }}
        disabled={ratingLoading}
        className={`hidden md:inline-flex p-1 rounded-lg transition-all duration-200 ${
          rating === "down" ? "text-red-400" : "text-white/20 hover:text-red-300"
        }`}
        style={{
          boxShadow:
            rating === "down"
              ? "inset -1px -1px 3px rgba(248, 113, 113, 0.1), inset 1px 1px 3px rgba(0, 0, 0, 0.4)"
              : "-1px -1px 3px rgba(255, 255, 255, 0.03), 1px 1px 3px rgba(0, 0, 0, 0.3)",
        }}
        title="Thumbs down"
        aria-label="Rate track negative"
      >
        <svg className="w-3.5 h-3.5" fill={rating === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
        </svg>
      </button>
    </>
  );
}
