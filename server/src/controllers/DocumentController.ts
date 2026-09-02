import { Request, Response } from 'express';
import { documentService } from '../services/DocumentService.js';
import { ConflictResolutionEngine } from '../conflict/ConflictResolutionEngine.js';
import { ASTOperation, DocumentNode } from '@syncdoc/shared';

export class DocumentController {
  private static getParamId(param: string | string[] | undefined): string | null {
    if (!param) return null;
    return Array.isArray(param) ? param[0] || null : param;
  }

  public static async createDocument(req: Request, res: Response): Promise<void> {
    try {
      const { title, root } = req.body;
      const document = await documentService.createDocument(title, root);
      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  public static async listDocuments(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

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
        error: (error as Error).message,
      });
    }
  }

  public static async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
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
        error: (error as Error).message,
      });
    }
  }

  public static async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
        return;
      }
      const { title, root, author, changeDescription } = req.body;

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
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  public static async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
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
        error: (error as Error).message,
      });
    }
  }

  public static async getDocumentAST(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
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
        error: (error as Error).message,
      });
    }
  }

  public static async updateDocumentAST(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
        return;
      }
      const { root, author, changeDescription } = req.body;

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
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  public static async getVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
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
        error: (error as Error).message,
      });
    }
  }

  public static async createVersionSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
        return;
      }
      const { author, changeDescription } = req.body;
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
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  public static async rollbackToVersion(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      const versionParam = DocumentController.getParamId(req.params.versionNumber);
      if (!id || !versionParam) {
        res.status(400).json({ success: false, error: 'Document ID and version number are required' });
        return;
      }
      const rolledBack = await documentService.rollbackToVersion(id, parseInt(versionParam, 10));

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
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  public static async exportDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = DocumentController.getParamId(req.params.id);
      const { format = 'html' } = req.query;

      if (!['html', 'pdf', 'markdown', 'json'].includes(format as string)) {
        res.status(400).json({
          success: false,
          error: `Unsupported export format '${format}'. Allowed formats: html, pdf, markdown, json.`,
        });
        return;
      }

      if (!id) {
        res.status(400).json({ success: false, error: 'Document ID is required' });
        return;
      }
      const exportData = await documentService.exportDocument(id, format as 'html' | 'pdf' | 'markdown' | 'json');

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
        error: (error as Error).message,
      });
    }
  }

  public static async importMarkdown(req: Request, res: Response): Promise<void> {
    try {
      const { markdown, title, documentId } = req.body;
      if (!markdown || typeof markdown !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Markdown content string is required.',
        });
        return;
      }

      const document = await documentService.importMarkdown(markdown, title, documentId);
      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  public static async mergeConflict(req: Request, res: Response): Promise<void> {
    try {
      const { baseAST, localOperations, remoteOperations } = req.body as {
        baseAST: DocumentNode;
        localOperations: ASTOperation[];
        remoteOperations: ASTOperation[];
      };

      if (!baseAST || !Array.isArray(localOperations) || !Array.isArray(remoteOperations)) {
        res.status(400).json({
          success: false,
          error: 'baseAST, localOperations array, and remoteOperations array are required.',
        });
        return;
      }

      const mergeResult = ConflictResolutionEngine.mergeChanges(baseAST, localOperations, remoteOperations);
      res.status(200).json({
        success: true,
        data: mergeResult,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}
