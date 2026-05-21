import React from "react";

export default function CollapsibleSidebar({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed top-0 right-0 h-full z-40 transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'} w-[380px] bg-[#181820] border-l border-white/10 shadow-2xl`}> 
      <button
        className="absolute top-4 left-4 z-50 rounded-full bg-white/10 hover:bg-white/20 w-10 h-10 flex items-center justify-center"
        onClick={onClose}
        title="Sluit lyrics-paneel"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="p-8 pt-20 h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
