import React from 'react';
import { Users, Activity } from 'lucide-react';
import { TeamMember } from '@syncdoc/shared';
import './TeamMembersPanel.css';

interface TeamMembersPanelProps {
  currentUserName: string;
  members: TeamMember[];
  loading?: boolean;
}

export const TeamMembersPanel: React.FC<TeamMembersPanelProps> = ({
  currentUserName,
  members,
  loading = false,
}) => {
  // Deduplicate members by normalized username / userId
  const uniqueMembersMap = new Map<string, TeamMember>();
  for (const m of members) {
    const key = m.userName.trim().toLowerCase();
    if (!uniqueMembersMap.has(key)) {
      uniqueMembersMap.set(key, m);
    } else {
      // If one entry is online, prioritize online state
      const existing = uniqueMembersMap.get(key)!;
      if (!existing.isOnline && m.isOnline) {
        uniqueMembersMap.set(key, m);
      }
    }
  }

  const uniqueMembers = Array.from(uniqueMembersMap.values());
  const onlineMembers = uniqueMembers.filter((m) => m.isOnline);
  const offlineMembers = uniqueMembers.filter((m) => !m.isOnline);

  const renderMemberItem = (member: TeamMember, isOnline: boolean) => {
    const isCurrentUser = member.userName.trim().toLowerCase() === currentUserName.trim().toLowerCase();
    const initial = member.userName.trim().charAt(0).toUpperCase() || 'U';
    const color = member.userColor || (isOnline ? '#3b82f6' : '#64748b');

    return (
      <li
        key={member.userId || member.userName}
        className={`team-member-item ${isOnline ? 'is-online' : 'is-offline'} ${isCurrentUser ? 'is-current-user' : ''}`}
        title={`${member.userName} - ${isOnline ? 'Online' : 'Offline'}`}
      >
        <div className="team-member-avatar-wrap">
          <div
            className="team-member-avatar"
            style={{
              borderColor: isOnline ? color : 'rgba(255, 255, 255, 0.1)',
              backgroundColor: isOnline ? `${color}20` : 'rgba(255, 255, 255, 0.04)',
              color: isOnline ? '#ffffff' : '#94a3b8',
            }}
          >
            {initial}
          </div>
          <span
            className={`team-status-indicator ${isOnline ? 'indicator-online' : 'indicator-offline'}`}
            aria-label={isOnline ? 'Online' : 'Offline'}
          />
        </div>

        <div className="team-member-info">
          <div className="team-member-name-row">
            <span className="team-member-name">
              {member.userName}
            </span>
            {isCurrentUser && (
              <span className="team-you-badge">You</span>
            )}
          </div>
          <div className="team-member-role-row">
            <span className="team-member-role">
              {member.role || 'Member'}
            </span>
            {isOnline && (
              <span className="team-online-live-tag">
                <span className="pulse-dot" /> Live
              </span>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <aside className="team-members-panel" aria-label="Team Members Presence Panel">
      {/* Panel Header */}
      <div className="team-panel-header">
        <div className="team-panel-title-wrap">
          <div className="team-panel-icon">
            <Users size={16} />
          </div>
          <div>
            <h2 className="team-panel-title">TEAM MEMBERS</h2>
            <p className="team-panel-subtitle">Real-time workspace presence</p>
          </div>
        </div>

        <div className="team-online-counter-pill" title={`${onlineMembers.length} members connected`}>
          <span className="counter-dot" />
          <span>{onlineMembers.length} Online</span>
        </div>
      </div>

      <div className="team-panel-content">
        {loading && members.length === 0 ? (
          <div className="team-panel-loading">
            <div className="team-skeleton-row" />
            <div className="team-skeleton-row" />
            <div className="team-skeleton-row" />
          </div>
        ) : (
          <>
            {/* ONLINE SECTION */}
            <div className="team-section">
              <div className="team-section-header">
                <span className="section-dot dot-green" />
                <h3 className="team-section-label">ONLINE</h3>
                <span className="team-section-count">({onlineMembers.length})</span>
              </div>

              {onlineMembers.length === 0 ? (
                <div className="team-empty-state">
                  <span>No active teammates right now</span>
                </div>
              ) : (
                <ul className="team-member-list">
                  {onlineMembers.map((m) => renderMemberItem(m, true))}
                </ul>
              )}
            </div>

            {/* OFFLINE SECTION */}
            <div className="team-section mt-4">
              <div className="team-section-header">
                <span className="section-dot dot-gray" />
                <h3 className="team-section-label">OFFLINE</h3>
                <span className="team-section-count">({offlineMembers.length})</span>
              </div>

              {offlineMembers.length === 0 ? (
                <div className="team-empty-state">
                  <span>All team members are online!</span>
                </div>
              ) : (
                <ul className="team-member-list">
                  {offlineMembers.map((m) => renderMemberItem(m, false))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer System Sync Info */}
      <div className="team-panel-footer">
        <div className="team-panel-footer-inner">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Activity size={12} className="text-emerald-400" />
            <span>CRDT Presence Active</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {uniqueMembers.length} members
          </span>
        </div>
      </div>
    </aside>
  );
};
