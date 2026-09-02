import React from 'react';
import { ShieldCheck, GitMerge } from 'lucide-react';

interface ConflictIndicatorProps {
  version: number;
}

export const ConflictIndicator: React.FC<ConflictIndicatorProps> = ({ version }) => {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs">
      <GitMerge size={12} className="text-cyan-400" />
      <span className="text-slate-300 font-mono text-[11px]">
        AST CRDT Active &bull; v{version}
      </span>
      <span title="AST conflict-free convergence enabled" className="flex items-center">
        <ShieldCheck size={12} className="text-emerald-400" />
      </span>
    </div>
  );
};
