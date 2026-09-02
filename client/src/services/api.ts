import { DocumentNode } from '@syncdoc/shared';

const API_BASE = '/api';

export interface DocumentSummary {
  _id: string;
  title: string;
  version: number;
  ownerId: string;
  activeCollaborators: string[];
  createdAt: string;
  updatedAt: string;
  root: DocumentNode;
}

export interface VersionSummary {
  _id: string;
  documentId: string;
  versionNumber: number;
  astSnapshot: DocumentNode;
  author: string;
  changeDescription: string;
  nodeCount: number;
  createdAt: string;
}

export class ApiService {
  public static async listDocuments(search?: string, page: number = 1): Promise<{ documents: DocumentSummary[]; total: number }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', page.toString());

    const res = await fetch(`${API_BASE}/documents?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to list documents: ${res.statusText}`);
    const json = await res.json();
    return { documents: json.data, total: json.pagination.total };
  }

  public static async getDocument(id: string): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    if (!res.ok) throw new Error(`Failed to get document ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async createDocument(title: string, root?: DocumentNode): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, root }),
    });
    if (!res.ok) throw new Error(`Failed to create document: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async updateDocument(
    id: string,
    updates: { title?: string; root?: DocumentNode; author?: string; changeDescription?: string }
  ): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update document ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete document ${id}: ${res.statusText}`);
    return true;
  }

  public static async getVersionHistory(id: string): Promise<VersionSummary[]> {
    const res = await fetch(`${API_BASE}/documents/${id}/versions`);
    if (!res.ok) throw new Error(`Failed to get versions for ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async createVersionSnapshot(id: string, author?: string, changeDescription?: string): Promise<VersionSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, changeDescription }),
    });
    if (!res.ok) throw new Error(`Failed to create snapshot for ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async rollbackToVersion(id: string, versionNumber: number): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}/versions/${versionNumber}/rollback`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to rollback to version ${versionNumber}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async exportDocument(id: string, format: 'html' | 'pdf' | 'markdown' | 'json'): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(`${API_BASE}/documents/${id}/export?format=${format}`);
    if (!res.ok) throw new Error(`Failed to export document in ${format} format: ${res.statusText}`);
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match && match[1] ? match[1] : `syncdoc_export.${format === 'pdf' ? 'html' : format}`;
    const blob = await res.blob();
    return { blob, filename };
  }

  public static async importMarkdown(markdown: string, title?: string, documentId?: string): Promise<DocumentSummary> {
    const endpoint = documentId ? `${API_BASE}/documents/${documentId}/import` : `${API_BASE}/documents/import`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, title, documentId }),
    });
    if (!res.ok) throw new Error(`Failed to import markdown: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }
}
