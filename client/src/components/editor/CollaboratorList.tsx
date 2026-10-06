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
    <div className="flex items-center gap-2">
      {/* Connection Status Indicator */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs shadow-sm"
        title={`Connection status: ${connectionStatus}`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
              : connectionStatus === 'connecting'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-rose-500'
          }`}
        />
        <span className="text-slate-300 font-medium text-[11px] capitalize tracking-wide">
          {connectionStatus === 'connected' ? 'Live' : connectionStatus}
        </span>
      </div>

      {/* Collaborator Avatars */}
      <div className="flex items-center -space-x-1.5">
        {/* Local user avatar */}
        <div
          className="relative group cursor-pointer"
          title={`You (${currentUser.userName})`}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md border-2 border-slate-950 transition-transform group-hover:scale-110 group-hover:z-10"
            style={{ backgroundColor: currentUser.userColor || '#3b82f6' }}
          >
            {currentUser.userName.substring(0, 2).toUpperCase()}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:flex items-center gap-1 bg-slate-900 text-[11px] text-slate-200 px-2 py-1 rounded-md shadow-xl border border-slate-800 whitespace-nowrap z-50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>You ({currentUser.userName})</span>
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
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md border-2 border-slate-950 transition-transform group-hover:scale-110 group-hover:z-10"
              style={{ backgroundColor: c.userColor || '#8b5cf6' }}
            >
              {c.userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:flex flex-col bg-slate-900 text-[11px] text-slate-200 px-2.5 py-1 rounded-md shadow-xl border border-slate-800 whitespace-nowrap z-50">
              <span className="font-semibold text-white">{c.userName}</span>
              <span className="text-[10px] text-slate-400 capitalize">{c.editingState || 'viewing'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

