import React from 'react';
import { ShieldCheck, GitMerge } from 'lucide-react';

interface ConflictIndicatorProps {
  version: number;
}

export const ConflictIndicator: React.FC<ConflictIndicatorProps> = ({ version }) => {
  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs shadow-sm"
      title="Non-destructive AST Conflict-Free Replicated Data Type engine active"
    >
      <GitMerge size={12} className="text-cyan-400" />
      <span className="text-slate-300 font-mono text-[11px] font-medium">
        AST v{version}
      </span>
      <span className="flex items-center text-emerald-400">
        <ShieldCheck size={12} />
      </span>
    </div>
  );
};

