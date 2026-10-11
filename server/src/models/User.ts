import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  email: string;
  name: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  userColor: string;
  role: string;
  authProvider: 'local' | 'google';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, sparse: true, index: true },
    avatarUrl: { type: String },
    userColor: { type: String, default: '#3b82f6' },
    role: { type: String, default: 'Member' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
