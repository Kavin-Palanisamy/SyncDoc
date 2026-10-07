import React from 'react';
import { ShieldCheck, GitMerge } from 'lucide-react';

interface ConflictIndicatorProps {
  version: number;
}

export const ConflictIndicator: React.FC<ConflictIndicatorProps> = ({ version }) => {
  return (
        <div
      className="conflict-indicator hidden sm:flex"
      title="Non-destructive AST Conflict-Free Replicated Data Type engine active"
    >
      <GitMerge size={12} className="conflict-indicator-icon" />
      <span className="conflict-indicator-label">
        AST v{version}
      </span>
      <ShieldCheck size={12} className="conflict-indicator-check" />
    </div>
  );
};

