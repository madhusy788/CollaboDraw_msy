/**
 * CollabDraw Client API Service
 */

import { User, Board, ChatMessage, BoardVersion } from '../types';

const API_BASE = '/api';

// Helper to retrieve token
export function getToken(): string | null {
  return localStorage.getItem('collabdraw_token');
}

// Helper to store token
export function setToken(token: string): void {
  localStorage.setItem('collabdraw_token', token);
}

// Helper to remove token
export function removeToken(): void {
  localStorage.removeItem('collabdraw_token');
}

// Low-level fetch wrapper with auth header
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

export const api = {
  // --- AUTHENTICATION ---
  async login(usernameOrEmail: string, passwordPlain: string): Promise<{ user: User; token: string }> {
    const data = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password: passwordPlain })
    });
    setToken(data.token);
    return data;
  },

  async register(fullName: string, username: string, email: string, passwordPlain: string): Promise<{ user: User; token: string }> {
    const data = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, username, email, password: passwordPlain })
    });
    setToken(data.token);
    return data;
  },

  async getProfile(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/profile');
  },

  // --- BOARDS ---
  async getBoards(): Promise<Board[]> {
    return request<Board[]>('/boards');
  },

  async createBoard(
    boardName: string, 
    theme: 'white' | 'black' = 'white', 
    visibility: 'private' | 'shared' = 'private',
    boardType: 'presentation' | 'infinite' = 'infinite',
    slideCount: number = 50
  ): Promise<Board> {
    return request<Board>('/boards', {
      method: 'POST',
      body: JSON.stringify({ boardName, theme, visibility, boardType, slideCount })
    });
  },

  async getBoardDetails(id: string): Promise<{ board: Board; permission: 'viewer' | 'editor' | 'owner' }> {
    return request<{ board: Board; permission: 'viewer' | 'editor' | 'owner' }>(`/boards/${id}`);
  },

  async deleteBoard(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/boards/${id}`, {
      method: 'DELETE'
    });
  },

  async shareBoard(id: string, usernameToInvite: string, permission: 'viewer' | 'editor'): Promise<{ success: boolean; board: Board }> {
    return request<{ success: boolean; board: Board }>(`/boards/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ usernameToInvite, permission })
    });
  },

  async unshareBoard(id: string, usernameToRemove: string): Promise<{ success: boolean; board: Board }> {
    return request<{ success: boolean; board: Board }>(`/boards/${id}/unshare`, {
      method: 'POST',
      body: JSON.stringify({ usernameToRemove })
    });
  },

  async updateBoard(id: string, updates: Partial<Board>): Promise<Board> {
    return request<Board>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // --- MESSAGES ---
  async getOldMessages(boardId: string): Promise<ChatMessage[]> {
    return request<ChatMessage[]>(`/boards/${boardId}/messages`);
  },

  // --- VERSIONS / HISTORY ---
  async getVersions(boardId: string): Promise<BoardVersion[]> {
    return request<BoardVersion[]>(`/boards/${boardId}/versions`);
  },

  async restoreVersion(boardId: string, versionId: string): Promise<{ success: boolean; board: Board }> {
    return request<{ success: boolean; board: Board }>(`/boards/${boardId}/versions/${versionId}/restore`, {
      method: 'POST'
    });
  }
};
