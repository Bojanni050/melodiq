"use client";

interface TrackVoteProps {
  voted: boolean;
  voteLoading: boolean;
  onVote: () => void;
}

export default function TrackVote({ voted, voteLoading, onVote }: TrackVoteProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onVote();
      }}
      disabled={voteLoading}
      className={`hidden md:inline-flex p-1 rounded-lg transition-all duration-200 ${
        voted ? "text-amber-400" : "text-white/20 hover:text-amber-300"
      }`}
      style={{
        boxShadow: voted
          ? "inset -1px -1px 3px rgba(251, 191, 36, 0.1), inset 1px 1px 3px rgba(0, 0, 0, 0.4)"
          : "-1px -1px 3px rgba(255, 255, 255, 0.03), 1px 1px 3px rgba(0, 0, 0, 0.3)",
      }}
      title={voted ? "Your pick for this song" : "Vote for this version"}
      aria-label={voted ? "Remove your vote" : "Vote for this version"}
      aria-pressed={voted}
    >
      <svg className="w-3.5 h-3.5" fill={voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    </button>
  );
}
