import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db } from './server/db';
import { setupSockets } from './server/sockets';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

//const PORT = 5173;
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'collabdraw-secret-key-12345';

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom JWT Authentication Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    fullName: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded as { id: string; username: string; email: string; fullName: string };
    next();
  });
}

// ========================================================
// API ROUTES
// ========================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
  const { fullName, username, email, password } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const user = await db.registerUser(fullName, username, email, password);
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.status(201).json({ user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Username/Email and Password are required' });
  }

  try {
    const user = await db.authenticateUser(usernameOrEmail, password);
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/profile', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// --- BOARDS ---

// Get all boards accessible to user (owned or shared)
app.get('/api/boards', authenticateToken, (req: AuthenticatedRequest, res) => {
  const username = req.user!.username;
  const boards = db.getBoardsForUser(username);
  res.json(boards);
});

// Create a board
app.post('/api/boards', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { boardName, theme, visibility, boardType, slideCount } = req.body;
  const username = req.user!.username;

  if (!boardName) {
    return res.status(400).json({ error: 'Board name is required' });
  }

  try {
    const board = db.createBoard(
      boardName, 
      username, 
      theme || 'white', 
      visibility || 'private',
      boardType || 'infinite',
      slideCount || 50
    );
    res.status(201).json(board);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single board (with access check)
app.get('/api/boards/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const username = req.user!.username;

  const board = db.getBoardById(id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const isOwner = board.owner.toLowerCase() === username.toLowerCase();
  const isCollaborator = board.collaborators.some(c => c.username.toLowerCase() === username.toLowerCase());

  if (!isOwner && !isCollaborator && board.visibility === 'private') {
    return res.status(403).json({ error: 'You do not have access permission to this private board' });
  }

  // Get current permission level
  let permission = 'viewer';
  if (isOwner) {
    permission = 'owner';
  } else if (isCollaborator) {
    const col = board.collaborators.find(c => c.username.toLowerCase() === username.toLowerCase());
    permission = col ? col.permission : 'viewer';
  } else {
    // Shared public board
    permission = 'viewer';
  }

  res.json({ board, permission });
});

// Update a board (owner or editor)
app.put('/api/boards/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { boardName, theme, visibility, objects, boardType, slideCount } = req.body;
  const username = req.user!.username;

  try {
    const board = db.getBoardById(id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const isOwner = board.owner.toLowerCase() === username.toLowerCase();
    const collaborator = board.collaborators.find(c => c.username.toLowerCase() === username.toLowerCase());
    const isEditor = collaborator && collaborator.permission === 'editor';

    if (!isOwner && !isEditor) {
      return res.status(403).json({ error: 'You do not have permission to modify this board' });
    }

    const updates: any = {};
    if (boardName !== undefined) updates.boardName = boardName;
    if (theme !== undefined) updates.theme = theme;
    if (visibility !== undefined) updates.visibility = visibility;
    if (objects !== undefined) updates.objects = objects;
    if (boardType !== undefined) updates.boardType = boardType;
    if (slideCount !== undefined) updates.slideCount = slideCount;

    if (objects !== undefined) {
      db.saveVersion(id, username, board.objects, objects);
    }

    const updated = db.updateBoard(id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a board (owner only)
app.delete('/api/boards/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const username = req.user!.username;

  try {
    db.deleteBoard(id, username);
    // Broadcast deletion to all users in the board room
    io.to(`board:${id}`).emit('board:deleted', { boardId: id });
    res.json({ success: true, message: 'Board deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Share / Invite to a board (owner only)
app.post('/api/boards/:id/share', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { usernameToInvite, permission } = req.body;
  const currentUser = req.user!.username;

  if (!usernameToInvite || !permission) {
    return res.status(400).json({ error: 'Username and permission are required' });
  }

  const board = db.getBoardById(id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  if (board.owner.toLowerCase() !== currentUser.toLowerCase()) {
    return res.status(403).json({ error: 'Only the board owner can manage invitations' });
  }

  try {
    const updatedBoard = db.addCollaborator(id, usernameToInvite, permission);
    res.json({ success: true, board: updatedBoard });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Unshare / Remove collaborator (owner only)
app.post('/api/boards/:id/unshare', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { usernameToRemove } = req.body;
  const currentUser = req.user!.username;

  if (!usernameToRemove) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const board = db.getBoardById(id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  if (board.owner.toLowerCase() !== currentUser.toLowerCase()) {
    return res.status(403).json({ error: 'Only the board owner can manage invitations' });
  }

  try {
    const updatedBoard = db.removeCollaborator(id, usernameToRemove);
    res.json({ success: true, board: updatedBoard });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- BOARD CHAT MESSAGES ---
app.get('/api/boards/:id/messages', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const username = req.user!.username;

  const board = db.getBoardById(id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const isOwner = board.owner.toLowerCase() === username.toLowerCase();
  const isCollaborator = board.collaborators.some(c => c.username.toLowerCase() === username.toLowerCase());

  if (!isOwner && !isCollaborator && board.visibility === 'private') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const messages = db.getMessages(id);
  res.json(messages);
});

// --- BOARD HISTORY VERSIONS ---
app.get('/api/boards/:id/versions', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const username = req.user!.username;

  const board = db.getBoardById(id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const isOwner = board.owner.toLowerCase() === username.toLowerCase();
  const isCollaborator = board.collaborators.some(c => c.username.toLowerCase() === username.toLowerCase());

  if (!isOwner && !isCollaborator && board.visibility === 'private') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const versions = db.getVersions(id);
  res.json(versions);
});

// Restore board history version
app.post('/api/boards/:id/versions/:versionId/restore', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id, versionId } = req.params;
  const username = req.user!.username;

  const board = db.getBoardById(id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const isOwner = board.owner.toLowerCase() === username.toLowerCase();
  const isCollaborator = board.collaborators.some(c => c.username.toLowerCase() === username.toLowerCase());

  if (!isOwner && !isCollaborator && board.visibility === 'private') {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check editor or owner permission
  let permission = 'viewer';
  if (isOwner) permission = 'owner';
  else {
    const col = board.collaborators.find(c => c.username.toLowerCase() === username.toLowerCase());
    if (col) permission = col.permission;
  }

  if (permission === 'viewer') {
    return res.status(403).json({ error: 'Viewers cannot restore past board versions' });
  }

  try {
    const updatedBoard = db.restoreVersion(id, versionId, username);
    
    // Broadcast the updated canvas to all room sockets
    io.to(`board:${id}`).emit('canvas:synced', {
      objects: updatedBoard.objects,
      modifiedBy: username,
      label: `Restored past version`
    });

    res.json({ success: true, board: updatedBoard });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ========================================================
// INTEGRATION OF WEB PLUGINS (VITE & STATIC ASSETS)
// ========================================================

async function startServer() {
  setupSockets(io);

  if (process.env.NODE_ENV !== 'production') {
    // Developer Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Dev server running with Vite Middleware');
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production server running with static files');
  }

  // server.listen(PORT, '0.0.0.0', () => {
  //   console.log(`Server listening on port http://0.0.0.0:${PORT}`);
  // });

  server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
}

startServer();
