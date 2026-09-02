import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { ASTNode, createNode, DocumentNode } from '../shared/src/index.js';
import { validateASTTree } from '../server/src/models/Document.js';

describe('Multi-Client Stress Test Harness (10 Concurrent Clients)', () => {
  it('should converge 10 concurrent editing clients to an identical, valid AST state', async () => {
    const NUM_CLIENTS = 10;
    const documentId = 'stress_doc_10_clients';

    // 1. Initialize Server Y.Doc
    const serverDoc = new Y.Doc();
    const serverNodes = serverDoc.getArray<ASTNode>('nodes');

    // 2. Initialize 10 Client Y.Doc instances
    const clients: Array<{
      id: string;
      doc: Y.Doc;
      nodes: Y.Array<ASTNode>;
      meta: Y.Map<unknown>;
    }> = [];

    for (let i = 0; i < NUM_CLIENTS; i++) {
      const cDoc = new Y.Doc();
      clients.push({
        id: `client_${i}`,
        doc: cDoc,
        nodes: cDoc.getArray<ASTNode>('nodes'),
        meta: cDoc.getMap<unknown>('meta'),
      });
    }

    // 3. Network bus to broadcast updates among server and all clients
    const broadcastUpdate = (fromDoc: Y.Doc, update: Uint8Array) => {
      // Apply to server
      if (fromDoc !== serverDoc) {
        Y.applyUpdate(serverDoc, update);
      }
      // Apply to all other clients
      for (const client of clients) {
        if (client.doc !== fromDoc) {
          Y.applyUpdate(client.doc, update);
        }
      }
    };

    // Attach listeners
    for (const client of clients) {
      client.doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'network') {
          broadcastUpdate(client.doc, update);
        }
      });
    }

    // 4. Initial Document Setup by Client 0
    const initialHeading = createNode('heading', documentId, 0, {
      content: 'Concurrent Engineering Technical Spec',
      level: 1,
    });
    clients[0]!.doc.transact(() => {
      clients[0]!.meta.set('title', 'Concurrent Engineering Technical Spec');
      clients[0]!.nodes.push([initialHeading]);
    });

    // 5. Simultaneous Concurrent Actions by all 10 Clients
    // Client 0: Adds Overview Paragraph
    clients[0]!.doc.transact(() => {
      const p = createNode('paragraph', documentId, 1, {
        content: 'Client 0: Overview of multi-client sync.',
      });
      clients[0]!.nodes.push([p]);
    });

    // Client 1: Adds Problem Statement Heading
    clients[1]!.doc.transact(() => {
      const h2 = createNode('heading', documentId, 2, {
        content: 'Client 1: Problem Statement',
        level: 2,
      });
      clients[1]!.nodes.push([h2]);
    });

    // Client 2: Adds TypeScript Code Block
    clients[2]!.doc.transact(() => {
      const code = createNode('code_block', documentId, 3, {
        language: 'typescript',
        content: 'export function resolveConflict() { return true; }',
      });
      clients[2]!.nodes.push([code]);
    });

    // Client 3: Adds Blockquote
    clients[3]!.doc.transact(() => {
      const bq = createNode('blockquote', documentId, 4, {
        content: 'Client 3: Non-destructive CRDT editing guarantees consistency.',
      });
      clients[3]!.nodes.push([bq]);
    });

    // Client 4: Adds List with items
    clients[4]!.doc.transact(() => {
      const list = createNode('list', documentId, 5, { listType: 'bullet' });
      list.children = [
        createNode('list_item', list.id, 0, { content: 'Client 4: Point A' }) as any,
        createNode('list_item', list.id, 1, { content: 'Client 4: Point B' }) as any,
      ];
      clients[4]!.nodes.push([list]);
    });

    // Client 5: Adds Performance Section
    clients[5]!.doc.transact(() => {
      const p = createNode('paragraph', documentId, 6, {
        content: 'Client 5: Performance benchmarks report < 5ms latency.',
      });
      clients[5]!.nodes.push([p]);
    });

    // Client 6: Adds Python Code Block
    clients[6]!.doc.transact(() => {
      const code = createNode('code_block', documentId, 7, {
        language: 'python',
        content: 'def compute_crdt_state():\n    return "converged"',
      });
      clients[6]!.nodes.push([code]);
    });

    // Client 7: Adds Task List
    clients[7]!.doc.transact(() => {
      const taskList = createNode('list', documentId, 8, { listType: 'task' });
      taskList.children = [
        createNode('list_item', taskList.id, 0, { content: 'Unit Tests Passing', checked: true }) as any,
        createNode('list_item', taskList.id, 1, { content: 'Stress Test Passing', checked: true }) as any,
      ];
      clients[7]!.nodes.push([taskList]);
    });

    // Client 8: Adds Divider
    clients[8]!.doc.transact(() => {
      const divider = createNode('divider', documentId, 9, {});
      clients[8]!.nodes.push([divider]);
    });

    // Client 9: Adds Conclusion Paragraph
    clients[9]!.doc.transact(() => {
      const conclusion = createNode('paragraph', documentId, 10, {
        content: 'Client 9: Final conclusion: all edits successfully merged without loss.',
      });
      clients[9]!.nodes.push([conclusion]);
    });

    // 6. Verification: Convergence Across All 10 Clients + Server
    const expectedNodeCount = 11; // 1 initial heading + 10 client edits
    expect(serverNodes.length).toBe(expectedNodeCount);

    const baselineJson = JSON.stringify(serverNodes.toArray());

    for (let i = 0; i < NUM_CLIENTS; i++) {
      const clientNodes = clients[i]!.nodes.toArray();
      expect(clientNodes.length).toBe(expectedNodeCount);
      expect(JSON.stringify(clientNodes)).toBe(baselineJson);
    }

    // 7. Verify the final converged document passes recursive Mongoose AST validation
    const finalDocAST: DocumentNode = {
      id: documentId,
      type: 'document',
      title: 'Concurrent Engineering Technical Spec',
      version: 10,
      parentId: null,
      children: serverNodes.toArray(),
      order: 0,
      metadata: { convergedAt: Date.now() },
    };

    expect(() => validateASTTree(finalDocAST)).not.toThrow();

    // Clean up
    serverDoc.destroy();
    for (const c of clients) {
      c.doc.destroy();
    }
  });
});
