import mongoose, { Schema, Document } from 'mongoose';

export interface ITeamMember extends Document {
  userId: string;
  userName: string;
  userColor: string;
  role: string;
  lastSeen: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    userName: { type: String, required: true },
    userColor: { type: String, default: '#3b82f6' },
    role: { type: String, default: 'Member' },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const DEFAULT_TEAM_MEMBERS = [
  { userId: 'user_kavin', userName: 'Kavin', userColor: '#3b82f6', role: 'Lead Developer' },
  { userId: 'user_sam', userName: 'Sam Rivera', userColor: '#10b981', role: 'Collaborator' },
  { userId: 'user_alex', userName: 'Alex Chen', userColor: '#8b5cf6', role: 'Collaborator' },
  { userId: 'user_taylor', userName: 'Taylor Kim', userColor: '#f59e0b', role: 'Designer' },
  { userId: 'user_jordan', userName: 'Jordan Vance', userColor: '#ec4899', role: 'Reviewer' },
];

export const TeamMemberModel = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);
