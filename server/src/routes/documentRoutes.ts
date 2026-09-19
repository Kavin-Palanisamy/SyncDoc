import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController.js';

const router = Router();

// Document CRUD
router.post('/documents', DocumentController.createDocument);
router.get('/documents', DocumentController.listDocuments);
router.get('/documents/:id', DocumentController.getDocumentById);
router.put('/documents/:id', DocumentController.updateDocument);
router.delete('/documents/:id', DocumentController.deleteDocument);

// AST specific
router.get('/documents/:id/ast', DocumentController.getDocumentAST);
router.put('/documents/:id/ast', DocumentController.updateDocumentAST);

// Version history & Rollback
router.get('/documents/:id/versions', DocumentController.getVersionHistory);
router.post('/documents/:id/versions', DocumentController.createVersionSnapshot);
router.post('/documents/:id/versions/:versionNumber/rollback', DocumentController.rollbackToVersion);
router.post('/documents/:id/rollback/:version', DocumentController.rollbackToVersion);

// Export & Import
router.get('/documents/:id/export', DocumentController.exportDocument);
router.get('/documents/:id/export/:format', DocumentController.exportDocument);
router.post('/documents/import', DocumentController.importMarkdown);
router.post('/documents/:id/import', DocumentController.importMarkdown);

// Conflict resolution endpoint
router.post('/conflict/merge', DocumentController.mergeConflict);
router.post('/documents/:id/merge', DocumentController.mergeConflict);

export default router;
