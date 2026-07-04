/**
 * CollabDraw Type Definitions
 */

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  createdAt: string;
}

export type BoardTheme = 'white' | 'black';
export type BoardVisibility = 'private' | 'shared';
export type UserPermission = 'viewer' | 'editor';

export interface BoardCollaborator {
  username: string;
  permission: UserPermission;
}

export interface DrawingObject {
  id: string;
  type: 'pencil' | 'line' | 'rect' | 'circle' | 'triangle' | 'arrow' | 'text' | 'sticky' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  points?: { x: number; y: number }[]; // For freehand pencil
  text?: string; // For text and sticky notes
  scaleX?: number;
  scaleY?: number;
  imageUrl?: string; // For images
  slideIndex?: number; // Slide index for presentation mode
}

export interface Board {
  id: string;
  boardName: string;
  owner: string; // username of the owner
  theme: BoardTheme;
  visibility: BoardVisibility;
  objects: DrawingObject[];
  collaborators: BoardCollaborator[];
  createdAt: string;
  updatedAt: string;
  boardType?: 'presentation' | 'infinite';
  slideCount?: number;
}

export interface ChatMessage {
  id: string;
  boardId: string;
  sender: string;
  message: string;
  timestamp: string;
}

export interface BoardVersion {
  id: string;
  boardId: string;
  timestamp: string;
  modifiedBy: string;
  objects: DrawingObject[];
}

export interface PresenceUser {
  socketId: string;
  username: string;
  fullName: string;
  cursor?: { x: number; y: number };
  color: string;
  permission: UserPermission | 'owner';
}
