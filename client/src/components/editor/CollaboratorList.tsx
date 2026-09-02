import React from 'react';
import { UserPresence } from '@syncdoc/shared';
import { UserProfile } from '../../context/CollaborationContext.js';

interface CollaboratorListProps {
  collaborators: UserPresence[];
  currentUser: UserProfile;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({
  collaborators,
  currentUser,
  connectionStatus,
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Connection Status Pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs">
        <span
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-emerald-400 animate-pulse'
              : connectionStatus === 'connecting'
              ? 'bg-amber-400 animate-ping'
              : 'bg-rose-500'
          }`}
        />
        <span className="text-slate-300 font-medium capitalize">{connectionStatus}</span>
      </div>

      {/* Online Collaborator Avatar Stack */}
      <div className="flex items-center -space-x-2">
        {/* Local user pill */}
        <div
          className="relative group cursor-pointer"
          title={`You (${currentUser.userName})`}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md border-2 border-slate-900"
            style={{ backgroundColor: currentUser.userColor }}
          >
            {currentUser.userName.substring(0, 2).toUpperCase()}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block bg-slate-900 text-xs text-slate-200 px-2 py-0.5 rounded shadow-lg border border-slate-700 whitespace-nowrap z-30">
            You ({currentUser.userName})
          </div>
        </div>

        {/* Remote Collaborators */}
        {collaborators.map((c) => (
          <div
            key={c.clientId}
            className="relative group cursor-pointer"
            title={`${c.userName} (${c.editingState})`}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md border-2 border-slate-900"
              style={{ backgroundColor: c.userColor }}
            >
              {c.userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block bg-slate-900 text-xs text-slate-200 px-2 py-0.5 rounded shadow-lg border border-slate-700 whitespace-nowrap z-30">
              {c.userName} &bull; {c.editingState}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
