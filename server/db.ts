import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, Board, ChatMessage, BoardVersion, DrawingObject } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory and files exist
function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const files = {
    'users.json': '[]',
    'boards.json': '[]',
    'messages.json': '[]',
    'versions.json': '[]'
  };

  Object.entries(files).forEach(([file, defaultContent]) => {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent, 'utf8');
    }
  });
}

initDB();

const activeBoardObjects = new Map<string, DrawingObject[]>();

// Helper to read a file
function readCollection<T>(fileName: string): T[] {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T[];
  } catch (err) {
    console.error(`Error reading ${fileName}:`, err);
    return [];
  }
}

// Helper to write a file
function writeCollection<T>(fileName: string, data: T[]): void {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${fileName}:`, err);
  }
}

// Custom ID Generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ==========================================
// USER DATABASE METHODS
// ==========================================

export interface DBUser extends User {
  passwordHash: string;
}

export const db = {
  // --- USERS ---
  getUsers(): DBUser[] {
    return readCollection<DBUser>('users.json');
  },

  findUserByUsername(username: string): DBUser | undefined {
    const users = this.getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  findUserByEmail(email: string): DBUser | undefined {
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  findUserById(id: string): DBUser | undefined {
    const users = this.getUsers();
    return users.find(u => u.id === id);
  },

  async registerUser(fullName: string, username: string, email: string, passwordPlain: string): Promise<User> {
    const users = this.getUsers();

    // Check duplicate
    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    if (users.some(u => u.username.toLowerCase() === normalizedUsername)) {
      throw new Error('Username is already taken');
    }
    if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const newUser: DBUser = {
      id: generateId(),
      fullName,
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeCollection('users.json', users);

    // Return without password hash
    const { passwordHash: _, ...userWithoutHash } = newUser;
    return userWithoutHash;
  },

  async authenticateUser(usernameOrEmail: string, passwordPlain: string): Promise<User> {
    const users = this.getUsers();
    const cleanSearch = usernameOrEmail.toLowerCase();

    const user = users.find(
      u => u.username.toLowerCase() === cleanSearch || u.email.toLowerCase() === cleanSearch
    );

    if (!user) {
      throw new Error('Invalid username, email, or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid username, email, or password');
    }

    const { passwordHash: _, ...userWithoutHash } = user;
    return userWithoutHash;
  },

  // --- BOARDS ---
  getActiveObjects(id: string): DrawingObject[] | undefined {
    return activeBoardObjects.get(id);
  },

  updateActiveObjects(id: string, objects: DrawingObject[]): void {
    activeBoardObjects.set(id, objects);
  },

  initActiveObjects(id: string, defaultObjects: DrawingObject[]): void {
    if (!activeBoardObjects.has(id)) {
      activeBoardObjects.set(id, defaultObjects);
    }
  },

  getBoards(): Board[] {
    const boards = readCollection<Board>('boards.json');
    return boards.map(b => {
      if (activeBoardObjects.has(b.id)) {
        return { ...b, objects: activeBoardObjects.get(b.id) || [] };
      }
      return b;
    });
  },

  getBoardsForUser(username: string): Board[] {
    const boards = this.getBoards();
    const cleanUser = username.toLowerCase();
    return boards.filter(b => 
      b.owner.toLowerCase() === cleanUser || 
      b.collaborators.some(c => c.username.toLowerCase() === cleanUser)
    );
  },

  getBoardById(id: string): Board | undefined {
    const boards = readCollection<Board>('boards.json');
    const board = boards.find(b => b.id === id);
    if (board) {
      if (!activeBoardObjects.has(id)) {
        activeBoardObjects.set(id, board.objects || []);
      }
      board.objects = activeBoardObjects.get(id) || [];
    }
    return board;
  },

  createBoard(boardName: string, owner: string, theme: 'white' | 'black', visibility: 'private' | 'shared', boardType: 'presentation' | 'infinite' = 'infinite', slideCount: number = 50): Board {
    const boards = readCollection<Board>('boards.json');

    const newBoard: Board = {
      id: generateId(),
      boardName,
      owner,
      theme,
      visibility,
      boardType,
      slideCount,
      objects: [],
      collaborators: [], // Empty initially, can invite editors/viewers
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    boards.push(newBoard);
    writeCollection('boards.json', boards);

    // Initialize in-memory cache
    activeBoardObjects.set(newBoard.id, []);

    // Save initial history version
    this.saveVersion(newBoard.id, 'System Initialized', [], newBoard.objects);

    return newBoard;
  },

  updateBoard(id: string, updates: Partial<Board>): Board {
    const boards = readCollection<Board>('boards.json');
    const index = boards.findIndex(b => b.id === id);

    if (index === -1) {
      throw new Error('Board not found');
    }

    const updatedBoard: Board = {
      ...boards[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    boards[index] = updatedBoard;
    writeCollection('boards.json', boards);

    // Also update in-memory active state if objects are being explicitly updated (saved)
    if (updates.objects !== undefined) {
      activeBoardObjects.set(id, updates.objects);
    }

    return updatedBoard;
  },

  deleteBoard(id: string, username: string): boolean {
    const boards = readCollection<Board>('boards.json');
    const board = boards.find(b => b.id === id);

    if (!board) {
      throw new Error('Board not found');
    }

    if (board.owner.toLowerCase() !== username.toLowerCase()) {
      throw new Error('Only the board owner can delete the board');
    }

    const filtered = boards.filter(b => b.id !== id);
    writeCollection('boards.json', filtered);

    // Remove from in-memory cache
    activeBoardObjects.delete(id);

    // Delete associated messages, versions
    const messages = this.getMessages(id);
    if (messages.length > 0) {
      const allMessages = readCollection<ChatMessage>('messages.json');
      const filteredMessages = allMessages.filter(m => m.boardId !== id);
      writeCollection('messages.json', filteredMessages);
    }

    const versions = this.getVersions(id);
    if (versions.length > 0) {
      const allVersions = readCollection<BoardVersion>('versions.json');
      const filteredVersions = allVersions.filter(v => v.boardId !== id);
      writeCollection('versions.json', filteredVersions);
    }

    return true;
  },

  // --- COLLABORATORS & PERMISSIONS ---
  addCollaborator(boardId: string, usernameToInvite: string, permission: 'viewer' | 'editor'): Board {
    const board = this.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const user = this.findUserByUsername(usernameToInvite);
    if (!user) {
      throw new Error(`User with username '${usernameToInvite}' not found`);
    }

    if (user.username.toLowerCase() === board.owner.toLowerCase()) {
      throw new Error('Owner already has full access to this board');
    }

    // Add or update collaborator
    const cleanUsername = user.username;
    let collaborators = [...board.collaborators];
    const existingIndex = collaborators.findIndex(c => c.username.toLowerCase() === cleanUsername.toLowerCase());

    if (existingIndex > -1) {
      collaborators[existingIndex] = { username: cleanUsername, permission };
    } else {
      collaborators.push({ username: cleanUsername, permission });
    }

    return this.updateBoard(boardId, { collaborators });
  },

  removeCollaborator(boardId: string, usernameToRemove: string): Board {
    const board = this.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const collaborators = board.collaborators.filter(
      c => c.username.toLowerCase() !== usernameToRemove.toLowerCase()
    );

    return this.updateBoard(boardId, { collaborators });
  },

  // --- CHAT MESSAGES ---
  getMessages(boardId: string): ChatMessage[] {
    const allMessages = readCollection<ChatMessage>('messages.json');
    return allMessages.filter(m => m.boardId === boardId);
  },

  createMessage(boardId: string, sender: string, messageText: string): ChatMessage {
    const allMessages = readCollection<ChatMessage>('messages.json');

    const newMessage: ChatMessage = {
      id: generateId(),
      boardId,
      sender,
      message: messageText,
      timestamp: new Date().toISOString()
    };

    allMessages.push(newMessage);
    writeCollection('messages.json', allMessages);
    return newMessage;
  },

  // --- VERSIONS / HISTORY ---
  getVersions(boardId: string): BoardVersion[] {
    const allVersions = readCollection<BoardVersion>('versions.json');
    return allVersions
      .filter(v => v.boardId === boardId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first
  },

  saveVersion(boardId: string, modifiedBy: string, oldObjects: DrawingObject[], newObjects: DrawingObject[]): BoardVersion {
    const allVersions = readCollection<BoardVersion>('versions.json');

    // To prevent saving exact duplicate versions back-to-back, check if last version is same
    const boardVersions = allVersions.filter(v => v.boardId === boardId);
    if (boardVersions.length > 0) {
      const lastVersion = boardVersions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (JSON.stringify(lastVersion.objects) === JSON.stringify(newObjects)) {
        return lastVersion; // No changes to record
      }
    }

    const newVersion: BoardVersion = {
      id: generateId(),
      boardId,
      timestamp: new Date().toISOString(),
      modifiedBy,
      objects: JSON.parse(JSON.stringify(newObjects)) // deep copy
    };

    allVersions.push(newVersion);
    writeCollection('versions.json', allVersions);
    return newVersion;
  },

  restoreVersion(boardId: string, versionId: string, username: string): Board {
    const allVersions = readCollection<BoardVersion>('versions.json');
    const version = allVersions.find(v => v.id === versionId && v.boardId === boardId);

    if (!version) {
      throw new Error('Version not found');
    }

    // Save current version first as a safety checkpoint
    const board = this.getBoardById(boardId);
    if (board) {
      this.saveVersion(boardId, `Pre-restore by ${username}`, board.objects, version.objects);
    }

    // Update board with the restored objects
    return this.updateBoard(boardId, {
      objects: version.objects,
      updatedAt: new Date().toISOString()
    });
  }
};
