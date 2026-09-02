import { DocumentModel, IDocumentModel, validateASTTree } from '../models/Document.js';
import { DocumentVersionModel, IDocumentVersionModel } from '../models/DocumentVersion.js';
import { createDocumentAST, DocumentNode, countNodes } from '@syncdoc/shared';
import { TransformationEngine } from '../transformation/TransformationEngine.js';

export class DocumentService {
  /**
   * Creates a new document
   */
  public async createDocument(title: string = 'Untitled Document', initialAST?: DocumentNode): Promise<IDocumentModel> {
    const root = initialAST || createDocumentAST(title);
    validateASTTree(root);

    const doc = new DocumentModel({
      title: title || root.title,
      version: root.version || 1,
      root,
      activeCollaborators: [],
    });

    const savedDoc = await doc.save();

    // Create initial version 1 snapshot
    await DocumentVersionModel.create({
      documentId: savedDoc._id.toString(),
      versionNumber: 1,
      astSnapshot: root,
      author: 'Creator',
      changeDescription: 'Initial document creation',
      nodeCount: countNodes(root),
    });

    return savedDoc;
  }

  /**
   * Lists documents with optional search and pagination
   */
  public async listDocuments(search?: string, page: number = 1, limit: number = 20): Promise<{ documents: IDocumentModel[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (search && search.trim() !== '') {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      DocumentModel.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      DocumentModel.countDocuments(query),
    ]);

    return { documents, total };
  }

  /**
   * Retrieves a document by ID
   */
  public async getDocumentById(id: string): Promise<IDocumentModel | null> {
    return DocumentModel.findById(id);
  }

  /**
   * Updates document title or AST
   */
  public async updateDocument(
    id: string,
    updates: { title?: string; root?: DocumentNode; author?: string; changeDescription?: string }
  ): Promise<IDocumentModel | null> {
    const doc = await DocumentModel.findById(id);
    if (!doc) return null;

    if (updates.title) {
      doc.title = updates.title;
      if (doc.root) {
        doc.root.title = updates.title;
      }
    }

    if (updates.root) {
      validateASTTree(updates.root);
      doc.root = updates.root;
      doc.version = (doc.version || 1) + 1;
      doc.root.version = doc.version;
    }

    const saved = await doc.save();

    // Create a version snapshot
    await DocumentVersionModel.create({
      documentId: saved._id.toString(),
      versionNumber: saved.version,
      astSnapshot: saved.root,
      author: updates.author || 'User',
      changeDescription: updates.changeDescription || `Updated document to version ${saved.version}`,
      nodeCount: countNodes(saved.root),
    });

    return saved;
  }

  /**
   * Deletes a document and its version history
   */
  public async deleteDocument(id: string): Promise<boolean> {
    const result = await DocumentModel.findByIdAndDelete(id);
    if (result) {
      await DocumentVersionModel.deleteMany({ documentId: id });
      return true;
    }
    return false;
  }

  /**
   * Gets version history for a document
   */
  public async getVersionHistory(documentId: string): Promise<IDocumentVersionModel[]> {
    return DocumentVersionModel.find({ documentId }).sort({ versionNumber: -1 });
  }

  /**
   * Creates an explicit named version snapshot
   */
  public async createVersionSnapshot(
    documentId: string,
    author: string = 'User',
    changeDescription: string = 'Manual snapshot'
  ): Promise<IDocumentVersionModel | null> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) return null;

    const nextVersion = doc.version + 1;
    doc.version = nextVersion;
    doc.root.version = nextVersion;
    await doc.save();

    return DocumentVersionModel.create({
      documentId,
      versionNumber: nextVersion,
      astSnapshot: doc.root,
      author,
      changeDescription,
      nodeCount: countNodes(doc.root),
    });
  }

  /**
   * Rolls back document to a specified version
   */
  public async rollbackToVersion(documentId: string, versionNumber: number): Promise<IDocumentModel | null> {
    const versionRecord = await DocumentVersionModel.findOne({ documentId, versionNumber });
    if (!versionRecord) return null;

    const doc = await DocumentModel.findById(documentId);
    if (!doc) return null;

    const newVersionNumber = doc.version + 1;
    const restoredRoot = versionRecord.astSnapshot;
    restoredRoot.version = newVersionNumber;

    doc.root = restoredRoot;
    doc.title = restoredRoot.title || doc.title;
    doc.version = newVersionNumber;

    const saved = await doc.save();

    await DocumentVersionModel.create({
      documentId,
      versionNumber: newVersionNumber,
      astSnapshot: restoredRoot,
      author: 'Rollback Service',
      changeDescription: `Rolled back to version ${versionNumber}`,
      nodeCount: countNodes(restoredRoot),
    });

    return saved;
  }

  /**
   * Exports document in specified format
   */
  public async exportDocument(documentId: string, format: 'html' | 'pdf' | 'markdown' | 'json'): Promise<{ data: string; contentType: string; filename: string } | null> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) return null;

    const safeTitle = doc.title.replace(/[^a-zA-Z0-9_-]/g, '_');

    switch (format) {
      case 'html':
        return {
          data: TransformationEngine.astToHTML(doc.root),
          contentType: 'text/html; charset=utf-8',
          filename: `${safeTitle}.html`,
        };
      case 'pdf':
        return {
          data: TransformationEngine.astToPrintableHTML(doc.root, doc.title),
          contentType: 'text/html; charset=utf-8',
          filename: `${safeTitle}_print.html`,
        };
      case 'markdown':
        return {
          data: TransformationEngine.astToMarkdown(doc.root),
          contentType: 'text/markdown; charset=utf-8',
          filename: `${safeTitle}.md`,
        };
      case 'json':
        return {
          data: JSON.stringify(doc.root, null, 2),
          contentType: 'application/json; charset=utf-8',
          filename: `${safeTitle}.json`,
        };
    }
  }

  /**
   * Imports Markdown to document
   */
  public async importMarkdown(markdown: string, title?: string, documentId?: string): Promise<IDocumentModel> {
    const root = TransformationEngine.markdownToAST(markdown, title);
    validateASTTree(root);

    if (documentId) {
      const existing = await DocumentModel.findById(documentId);
      if (existing) {
        existing.root = root;
        existing.title = root.title;
        existing.version = existing.version + 1;
        existing.root.version = existing.version;
        return existing.save();
      }
    }

    return this.createDocument(root.title, root);
  }
}

export const documentService = new DocumentService();
