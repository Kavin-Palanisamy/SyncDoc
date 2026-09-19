import * as Y from 'yjs';
import {
  ASTNode,
  DocumentNode,
  DiffResult,
  cloneAST,
} from '@syncdoc/shared';
import { validateASTTree } from '../models/Document.js';
import { ConflictResolutionEngine } from '../conflict/ConflictResolutionEngine.js';

/**
 * Result structure for AST state transition analysis around a Yjs update
 */
export interface ASTAnalysisResult {
  isValid: boolean;
  validationError?: string;
  diff: DiffResult;
  hasStructuralChanges: boolean;
  summary: {
    addedCount: number;
    modifiedCount: number;
    deletedCount: number;
    reorderedCount: number;
  };
}

/**
 * ASTCollaborationBridge
 *
 * ARCHITECTURAL BOUNDARY AND DESIGN NOTES:
 * -----------------------------------------------------------------------------
 * 1. Yjs Responsibility:
 *    Yjs handles distributed, peer-to-peer and client-server CRDT state convergence
 *    at the binary delta level using Lamport timestamps and state vectors.
 *
 * 2. AST Engine Responsibility:
 *    The ConflictResolutionEngine handles semantic, tree-structured conflict analysis,
 *    node integrity validation, and explainable merge/resolution policies.
 *
 * 3. Why Yjs updates are NOT converted to ASTOperation objects:
 *    A Yjs binary update (Uint8Array) contains opaque RLE-encoded CRDT item structs.
 *    Attempting to decompile arbitrary binary CRDT updates into high-level ASTOperation
 *    objects (e.g. INSERT_NODE, DELETE_NODE, MOVE_NODE with targetParentId and targetIndex)
 *    is lossy, speculative, and prone to race conditions.
 *    Creating "fake" ASTOperation objects would compromise system correctness.
 *
 * 4. Intermediate Integration Strategy:
 *    Instead of fake operation synthesis, this bridge derives the canonical AST state
 *    immediately before and after a Yjs update is applied to the server Y.Doc.
 *    It validates the post-update AST against all structural rules (no circular references,
 *    correct parent-child types, non-negative orders, valid heading levels) and uses
 *    ConflictResolutionEngine.compareVersions() to detect, log, and monitor actual
 *    structural changes without interfering with Yjs CRDT convergence.
 * -----------------------------------------------------------------------------
 */
export class ASTCollaborationBridge {
  /**
   * Creates an isolated temporary Y.Doc with a copy of the source doc's state
   * for safe candidate validation before committing updates to the live session doc.
   */
  public static createTrialDoc(sourceDoc: Y.Doc): Y.Doc {
    const trialDoc = new Y.Doc();
    const state = Y.encodeStateAsUpdate(sourceDoc);
    Y.applyUpdate(trialDoc, state);
    return trialDoc;
  }

  /**
   * Extracts a clean, canonical DocumentNode AST representation from a Y.Doc instance
   */
  public static extractCanonicalAST(
    doc: Y.Doc,
    documentId: string,
    versionOverride?: number
  ): DocumentNode {
    const yNodesArray = doc.getArray<ASTNode>('nodes');
    const yMetaMap = doc.getMap<unknown>('meta');

    const title = (yMetaMap.get('title') as string) || 'Untitled Document';
    const rootId = (yMetaMap.get('id') as string) || `doc_${documentId}`;
    const version =
      typeof versionOverride === 'number'
        ? versionOverride
        : (yMetaMap.get('version') as number) || 1;

    const childrenNodes = yNodesArray.toArray();

    const metaRaw = yMetaMap.get('metadata');
    const metadata: Record<string, unknown> =
      metaRaw && typeof metaRaw === 'object'
        ? (JSON.parse(JSON.stringify(metaRaw)) as Record<string, unknown>)
        : {};

    const updatedAt = yMetaMap.get('updatedAt');
    if (typeof updatedAt === 'number') {
      metadata.updatedAt = updatedAt;
    }

    return {
      id: rootId,
      type: 'document',
      title,
      version,
      parentId: null,
      children: childrenNodes.map((child) => cloneAST(child)),
      order: 0,
      metadata,
    };
  }

  /**
   * Analyzes the transition between pre-update AST and post-update AST.
   * Performs recursive tree validation and structural diff calculation.
   */
  public static analyzeTransition(
    preAST: DocumentNode,
    postAST: DocumentNode
  ): ASTAnalysisResult {
    // 1. Validate post-update AST tree integrity
    let isValid = true;
    let validationError: string | undefined = undefined;

    try {
      validateASTTree(postAST);
    } catch (err) {
      isValid = false;
      validationError = (err as Error).message;
    }

    // 2. Compute structural differences using ConflictResolutionEngine
    const diff = ConflictResolutionEngine.compareVersions(preAST, postAST);

    const summary = {
      addedCount: diff.added.length,
      modifiedCount: diff.modified.length,
      deletedCount: diff.deleted.length,
      reorderedCount: diff.reordered.length,
    };

    const hasStructuralChanges =
      summary.addedCount > 0 ||
      summary.modifiedCount > 0 ||
      summary.deletedCount > 0 ||
      summary.reorderedCount > 0;

    return {
      isValid,
      validationError,
      diff,
      hasStructuralChanges,
      summary,
    };
  }
}
