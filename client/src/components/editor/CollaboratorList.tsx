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
    <div className="presence-bar">
      {/* Connection Status Indicator */}
      <div
        className="presence-status-pill"
        title={`Connection status: ${connectionStatus}`}
      >
        <span
          className={`presence-status-dot ${
            connectionStatus === 'connected'
              ? 'presence-status-dot--live'
              : connectionStatus === 'connecting'
              ? 'presence-status-dot--connecting'
              : 'presence-status-dot--offline'
          }`}
        />
        <span className="presence-status-label">
          {connectionStatus === 'connected' ? 'Live' : connectionStatus}
        </span>
      </div>

      {/* Collaborator Avatars */}
      <div className="presence-avatar-row">
        {/* Local user avatar */}
        <div
          className="presence-avatar-wrap group"
          title={`You (${currentUser.userName})`}
        >
          <div
            className="presence-avatar"
            style={{ backgroundColor: currentUser.userColor || '#3b82f6' }}
          >
            {currentUser.userName.substring(0, 2).toUpperCase()}
          </div>
          <div className="presence-tooltip">
            <span className="presence-tooltip-dot" />
            <span>You ({currentUser.userName})</span>
          </div>
        </div>

        {/* Remote Collaborators */}
        {/* {collaborators.map((c) => (
          <div
            key={c.clientId}
            className="presence-avatar-wrap group"
            title={`${c.userName} (${c.editingState})`}
          >
            <div
              className="presence-avatar"
              style={{ backgroundColor: c.userColor || '#8b5cf6' }}
            >
              {c.userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="presence-tooltip presence-tooltip--stacked">
              <span className="presence-tooltip-name">{c.userName}</span>
              <span className="presence-tooltip-state">{c.editingState || 'viewing'}</span>
            </div>
          </div>
        ))} */}

        
      </div>
    </div>
  );
};

