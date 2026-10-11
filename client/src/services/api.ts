import { DocumentNode, TeamMember } from '@syncdoc/shared';

const API_BASE = '/api';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  userColor: string;
  avatarUrl?: string;
  role: string;
  authProvider?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
  message?: string;
}

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
  public static getToken(): string | null {
    return localStorage.getItem('syncdoc_token');
  }

  public static getAuthHeaders(): Record<string, string> {
    const token = ApiService.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // Auth APIs
  public static async login(identifier: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Login failed: ${res.statusText}`);
    }
    return json;
  }

  public static async signup(fullName: string, email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Signup failed: ${res.statusText}`);
    }
    return json;
  }

  public static async googleLogin(credential: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Google authentication failed: ${res.statusText}`);
    }
    return json;
  }

  public static async getMe(): Promise<AuthUser> {
    const token = ApiService.getToken();
    if (!token) throw new Error('No authentication token found');

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: ApiService.getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to authenticate user session');
    }
    return json.user;
  }

  public static async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: ApiService.getAuthHeaders(),
      });
    } catch {}
    localStorage.removeItem('syncdoc_token');
    localStorage.removeItem('syncdoc_auth');
    localStorage.removeItem('syncdoc_user');
    localStorage.removeItem('syncdoc_user_name');
    localStorage.removeItem('syncdoc_user_id');
    localStorage.removeItem('syncdoc_user_color');
    sessionStorage.removeItem('syncdoc_token');
    sessionStorage.removeItem('syncdoc_auth');
    sessionStorage.removeItem('syncdoc_user');
    sessionStorage.removeItem('syncdoc_user_name');
    sessionStorage.removeItem('syncdoc_user_id');
  }

  // Document APIs
  public static async listDocuments(search?: string, page: number = 1): Promise<{ documents: DocumentSummary[]; total: number }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', page.toString());

    const res = await fetch(`${API_BASE}/documents?${params.toString()}`, {
      headers: ApiService.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list documents: ${res.statusText}`);
    const json = await res.json();
    return { documents: json.data, total: json.pagination.total };
  }

  public static async getDocument(id: string): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      headers: ApiService.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get document ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async createDocument(title: string, root?: DocumentNode): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: ApiService.getAuthHeaders(),
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
      headers: ApiService.getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update document ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: ApiService.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete document ${id}: ${res.statusText}`);
    return true;
  }

  public static async getVersionHistory(id: string): Promise<VersionSummary[]> {
    const res = await fetch(`${API_BASE}/documents/${id}/versions`, {
      headers: ApiService.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get versions for ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async createVersionSnapshot(id: string, author?: string, changeDescription?: string): Promise<VersionSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}/versions`, {
      method: 'POST',
      headers: ApiService.getAuthHeaders(),
      body: JSON.stringify({ author, changeDescription }),
    });
    if (!res.ok) throw new Error(`Failed to create snapshot for ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async rollbackToVersion(id: string, versionNumber: number): Promise<DocumentSummary> {
    const res = await fetch(`${API_BASE}/documents/${id}/versions/${versionNumber}/rollback`, {
      method: 'POST',
      headers: ApiService.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to rollback to version ${versionNumber}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async exportDocument(id: string, format: 'html' | 'pdf' | 'markdown' | 'json'): Promise<{ blob: Blob; filename: string }> {
    const token = ApiService.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/documents/${id}/export?format=${format}`, {
      headers,
    });
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
      headers: ApiService.getAuthHeaders(),
      body: JSON.stringify({ markdown, title, documentId }),
    });
    if (!res.ok) throw new Error(`Failed to import markdown: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  public static async getTeamMembers(): Promise<TeamMember[]> {
    const res = await fetch(`${API_BASE}/members`, {
      headers: ApiService.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch team members: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }
}
