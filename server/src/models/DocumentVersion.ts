import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import { DocumentNode } from '@syncdoc/shared';

export interface IDocumentVersionModel extends MongooseDocument {
  documentId: string;
  versionNumber: number;
  astSnapshot: DocumentNode;
  author: string;
  changeDescription: string;
  nodeCount: number;
  createdAt: Date;
}

const DocumentVersionSchema = new Schema<IDocumentVersionModel>(
  {
    documentId: { type: String, required: true, index: true },
    versionNumber: { type: Number, required: true },
    astSnapshot: { type: Schema.Types.Mixed, required: true },
    author: { type: String, default: 'System' },
    changeDescription: { type: String, default: 'Auto-saved version snapshot' },
    nodeCount: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

DocumentVersionSchema.index({ documentId: 1, versionNumber: -1 }, { unique: true });

export const DocumentVersionModel = mongoose.model<IDocumentVersionModel>(
  'DocumentVersion',
  DocumentVersionSchema
);
