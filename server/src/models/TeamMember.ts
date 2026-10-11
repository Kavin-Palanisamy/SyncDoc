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

export const DEFAULT_TEAM_MEMBERS: Array<{
  userId: string;
  userName: string;
  userColor: string;
  role: string;
}> = [];

export const TeamMemberModel = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);
