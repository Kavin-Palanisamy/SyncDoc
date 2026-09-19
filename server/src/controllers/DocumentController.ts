import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { documentService } from '../services/DocumentService.js';
import { ConflictResolutionEngine } from '../conflict/ConflictResolutionEngine.js';
import { DocumentNode } from '@syncdoc/shared';
import { validateASTTree } from '../models/Document.js';

export class DocumentController {
  private static sanitizeErrorMessage(err: unknown): string {
    if (!err) return 'An internal server error occurred.';
    let msg = (err as Error).message || String(err);
    msg = msg.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://[REDACTED]');
    if (
      msg.includes('MongoServerError') ||
      msg.includes('MongooseError') ||
      msg.includes('connection <monitor>') ||
      msg.includes('TopologyDescription') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('C:\\') ||
      msg.includes('/Users/') ||
      msg.includes('/home/') ||
      msg.includes('node_modules')
    ) {
      return 'An internal database error occurred.';
    }
    return msg;
  }

  private static isClientValidationError(err: unknown): boolean {
    if (!err) return false;
    if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
      return true;
    }
    const msg = (err as Error).message || String(err);
    if (
      msg.includes('MongoServerError') ||
      msg.includes('MongooseError') ||
      msg.includes('connection <monitor>') ||
      msg.includes('TopologyDescription') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('C:\\') ||
      msg.includes('/Users/') ||
      msg.includes('/home/') ||
      msg.includes('node_modules')
    ) {
      return false;
    }
    return true;
  }

  private static handleError(res: Response, err: unknown, defaultStatus: number = 500): void {
    const isValidation = DocumentController.isClientValidationError(err);
    const status = isValidation ? 400 : defaultStatus;
    res.status(status).json({
      success: false,
      error: DocumentController.sanitizeErrorMessage(err),
    });
  }

  private static getParamId(param: string | string[] | undefined): string | null {
    if (!param) return null;
    return Array.isArray(param) ? param[0] || null : param;
  }

  public static async createDocument(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ success: false, error: 'Request body must be a valid JSON object.' });
        return;
      }
      const { title, root } = req.body;
      if (root !== undefined) {
        if (!root || typeof root !== 'object') {
          res.status(400).json({
            success: false,
            error: 'AST root must be a valid document node object.',
          });
          return;
        }
        validateASTTree(root);
      }

      const document = await documentService.createDocument(title, root);
      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }

  public static async listDocuments(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await documentService.listDocuments(search, page, limit);
      res.status(200).json({
        success: true,
        data: result.documents,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: DocumentController.sanitizeErrorMessage(error),
      });
    }
  }

  public static async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const document = await documentService.getDocumentById(id);
      if (!document) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: document,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: DocumentController.sanitizeErrorMessage(error),
      });
    }
  }

  public static async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ success: false, error: 'Request body must be an object.' });
        return;
      }
      const { title, root, author, changeDescription } = req.body;

      if (root !== undefined) {
        if (!root || typeof root !== 'object') {
          res.status(400).json({ success: false, error: 'Invalid AST root object.' });
          return;
        }
        validateASTTree(root);
      }

      const updated = await documentService.updateDocument(id, {
        title,
        root,
        author,
        changeDescription,
      });

      if (!updated) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }

  public static async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const deleted = await documentService.deleteDocument(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Document deleted successfully.',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: DocumentController.sanitizeErrorMessage(error),
      });
    }
  }

  public static async getDocumentAST(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const document = await documentService.getDocumentById(id);
      if (!document) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: document.root,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: DocumentController.sanitizeErrorMessage(error),
      });
    }
  }

  public static async updateDocumentAST(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ success: false, error: 'Request body must be an object.' });
        return;
      }
      const { root, author, changeDescription } = req.body;
      if (!root || typeof root !== 'object') {
        res.status(400).json({ success: false, error: 'AST root object is required.' });
        return;
      }

      validateASTTree(root);

      const updated = await documentService.updateDocument(id, {
        root,
        author,
        changeDescription,
      });

      if (!updated) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updated.root,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }

  public static async getVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const doc = await documentService.getDocumentById(id);
      if (!doc) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const history = await documentService.getVersionHistory(id);
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: DocumentController.sanitizeErrorMessage(error),
      });
    }
  }

  public static async createVersionSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const { author, changeDescription } = req.body || {};
      const snapshot = await documentService.createVersionSnapshot(id, author, changeDescription);

      if (!snapshot) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }

  public static async rollbackToVersion(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      const versionParam =
        DocumentController.getParamId(req.params.versionNumber) ||
        DocumentController.getParamId(req.params.version);

      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      if (!versionParam) {
        res.status(400).json({ success: false, error: 'Document ID and version number are required.' });
        return;
      }

      const versionNumber = parseInt(versionParam, 10);
      if (isNaN(versionNumber) || versionNumber < 1) {
        res.status(400).json({ success: false, error: `Invalid version number '${versionParam}'.` });
        return;
      }

      const rolledBack = await documentService.rollbackToVersion(id, versionNumber);

      if (!rolledBack) {
        res.status(404).json({
          success: false,
          error: `Version ${versionParam} not found for document '${id}'.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: rolledBack,
        message: `Successfully rolled back to version ${versionParam}.`,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }

  public static async exportDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      const formatParam =
        DocumentController.getParamId(req.params.format) ||
        (req.query.format as string) ||
        'html';

      if (!['html', 'pdf', 'markdown', 'json'].includes(formatParam)) {
        res.status(400).json({
          success: false,
          error: `Unsupported export format '${formatParam}'. Allowed formats: html, pdf, markdown, json.`,
        });
        return;
      }

      if (!id || !mongoose.isValidObjectId(id)) {
        res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
        return;
      }
      const exportData = await documentService.exportDocument(id, formatParam as any);

      if (!exportData) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' not found.`,
        });
        return;
      }

      res.setHeader('Content-Type', exportData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.status(200).send(exportData.data);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: DocumentController.sanitizeErrorMessage(error),
      });
    }
  }

  public static async importMarkdown(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Request body must be a valid JSON object.',
        });
        return;
      }

      const { markdown, title, documentId, root, ast } = req.body;
      const targetDocId = documentId || DocumentController.getParamId(req.params.id) || undefined;

      if (targetDocId && !mongoose.isValidObjectId(targetDocId)) {
        res.status(404).json({ success: false, error: `Document with ID '${targetDocId}' not found.` });
        return;
      }

      const astInput = root || ast;

      let document: any;
      if (astInput) {
        document = await documentService.importAST(astInput, title, targetDocId);
      } else if (typeof markdown === 'string') {
        document = await documentService.importMarkdown(markdown, title, targetDocId);
      } else {
        res.status(400).json({
          success: false,
          error: 'Markdown content string or valid AST root is required.',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }

  public static async mergeConflict(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Request body must be a valid JSON object.',
        });
        return;
      }

      const id = DocumentController.getParamId(req.params.id);
      let baseAST = req.body.baseAST as DocumentNode | undefined;
      const { localOperations, remoteOperations } = req.body;

      if (id) {
        if (!mongoose.isValidObjectId(id)) {
          res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
          return;
        }
        const existingDoc = await documentService.getDocumentById(id);
        if (!existingDoc) {
          res.status(404).json({ success: false, error: `Document with ID '${id}' not found.` });
          return;
        }
        if (!baseAST) {
          baseAST = existingDoc.root;
        }
      }

      if (!baseAST || typeof baseAST !== 'object' || !Array.isArray(localOperations) || !Array.isArray(remoteOperations)) {
        res.status(400).json({
          success: false,
          error: 'baseAST, localOperations array, and remoteOperations array are required.',
        });
        return;
      }

      validateASTTree(baseAST);

      const mergeResult = ConflictResolutionEngine.mergeChanges(baseAST, localOperations, remoteOperations);

      if (mergeResult.mergedAST) {
        validateASTTree(mergeResult.mergedAST);
      }

      if (id && mergeResult.success) {
        const updatedDoc = await documentService.updateDocument(id, {
          root: mergeResult.mergedAST,
          author: 'Conflict Merge Service',
          changeDescription: `Merged ${localOperations.length} local and ${remoteOperations.length} remote operations`,
        });
        res.status(200).json({
          success: true,
          data: {
            ...mergeResult,
            document: updatedDoc,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: mergeResult,
      });
    } catch (error) {
      DocumentController.handleError(res, error, 500);
    }
  }
}

