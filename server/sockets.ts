import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { PresenceUser, DrawingObject } from '../src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'collabdraw-secret-key-12345';

// Map of boardId -> array of PresenceUsers
const presenceMap = new Map<string, PresenceUser[]>();

// Keep track of which socket is in which board and who they are
const socketSessionMap = new Map<string, { boardId: string; username: string }>();

// Helper to assign a random pretty pastel color to user cursor
const CURSOR_COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF3',
  '#FFA500', '#8A2BE2', '#00FFFF', '#FF1493', '#00FF7F', '#FFD700',
  '#FF4500', '#ADFF2F', '#D2691E', '#9400D3', '#00BFFF'
];

function getRandomColor() {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // JOIN BOARD ROOM
    socket.on('join-board', (payload: { boardId: string; token: string }) => {
      const { boardId, token } = payload;
      if (!boardId || !token) {
        socket.emit('error-msg', 'Missing boardId or authorization token');
        return;
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET) as { username: string; fullName: string };
        const username = decoded.username;
        const fullName = decoded.fullName;

        // Retrieve board to check access permissions
        const board = db.getBoardById(boardId);
        if (!board) {
          socket.emit('error-msg', 'Board not found');
          return;
        }

        // Determine user permission
        let permission: 'viewer' | 'editor' | 'owner' = 'viewer';
        if (board.owner.toLowerCase() === username.toLowerCase()) {
          permission = 'owner';
        } else {
          const collaborator = board.collaborators.find(c => c.username.toLowerCase() === username.toLowerCase());
          if (collaborator) {
            permission = collaborator.permission;
          } else if (board.visibility === 'shared') {
            // Default permission for shared boards if not explicitly invited: viewer
            permission = 'viewer';
          } else {
            // Private board and user is not owner or invited collaborator
            socket.emit('error-msg', 'This is a private board and you do not have permission to access it');
            return;
          }
        }

        // Join room
        const roomName = `board:${boardId}`;
        socket.join(roomName);

        // Record session
        socketSessionMap.set(socket.id, { boardId, username });

        // Update presence map
        if (!presenceMap.has(boardId)) {
          presenceMap.set(boardId, []);
        }

        const usersInBoard = presenceMap.get(boardId)!;
        // Check if user is already in list (could be dual tab, remove old tab session)
        const updatedUsers = usersInBoard.filter(u => u.username.toLowerCase() !== username.toLowerCase());
        
        const presenceUser: PresenceUser = {
          socketId: socket.id,
          username,
          fullName,
          color: getRandomColor(),
          permission: permission === 'owner' ? 'owner' : permission
        };

        updatedUsers.push(presenceUser);
        presenceMap.set(boardId, updatedUsers);

        // Notify room of updated presence
        io.to(roomName).emit('presence:update', updatedUsers);
        
        console.log(`User ${username} (${permission}) joined board ${boardId}`);

        // Send confirmation to client along with current board state and permissions
        socket.emit('join-success', {
          permission,
          userColor: presenceUser.color,
          presenceList: updatedUsers
        });

      } catch (err) {
        socket.emit('error-msg', 'Authentication failed. Please login again.');
      }
    });

    // DRAWING: CURSOR MOVE
    socket.on('cursor:move', (payload: { x: number; y: number }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      // Update local presence coords
      const users = presenceMap.get(boardId);
      if (users) {
        const u = users.find(user => user.socketId === socket.id);
        if (u) {
          u.cursor = payload;
        }
      }

      // Broadcast coordinate change to other socket peers
      socket.to(roomName).emit('cursor:moved', {
        username,
        cursor: payload,
        socketId: socket.id
      });
    });

    // CANVAS UPDATES (ADD, MODIFY, REMOVE, CLEAR)
    socket.on('canvas:object-added', (payload: { object: DrawingObject }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      // Retrieve board
      const board = db.getBoardById(boardId);
      if (!board) return;

      // Verify permission
      const users = presenceMap.get(boardId);
      const activeUser = users?.find(u => u.socketId === socket.id);
      if (!activeUser || activeUser.permission === 'viewer') return;

      // Update objects in memory
      const existingObjects = db.getActiveObjects(boardId) || [];
      if (!existingObjects.some(obj => obj.id === payload.object.id)) {
        const updated = [...existingObjects, payload.object];
        db.updateActiveObjects(boardId, updated);
        
        // Broadcast addition to other peers
        socket.to(roomName).emit('canvas:object-added', {
          object: payload.object,
          modifiedBy: username
        });
      }
    });

    socket.on('canvas:object-modified', (payload: { object: DrawingObject }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      const board = db.getBoardById(boardId);
      if (!board) return;

      const users = presenceMap.get(boardId);
      const activeUser = users?.find(u => u.socketId === socket.id);
      if (!activeUser || activeUser.permission === 'viewer') return;

      // Update target object in memory
      const objects = db.getActiveObjects(boardId) || [];
      const index = objects.findIndex(obj => obj.id === payload.object.id);
      if (index > -1) {
        const updated = [...objects];
        updated[index] = payload.object;
        db.updateActiveObjects(boardId, updated);

        // Broadcast modification
        socket.to(roomName).emit('canvas:object-modified', {
          object: payload.object,
          modifiedBy: username
        });
      }
    });

    socket.on('canvas:object-removed', (payload: { id: string }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      const board = db.getBoardById(boardId);
      if (!board) return;

      const users = presenceMap.get(boardId);
      const activeUser = users?.find(u => u.socketId === socket.id);
      if (!activeUser || activeUser.permission === 'viewer') return;

      const objects = db.getActiveObjects(boardId) || [];
      const filtered = objects.filter(obj => obj.id !== payload.id);
      db.updateActiveObjects(boardId, filtered);

      // Broadcast deletion
      socket.to(roomName).emit('canvas:object-removed', {
        id: payload.id,
        modifiedBy: username
      });
    });

    socket.on('canvas:clear', () => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      const board = db.getBoardById(boardId);
      if (!board) return;

      const users = presenceMap.get(boardId);
      const activeUser = users?.find(u => u.socketId === socket.id);
      if (!activeUser || activeUser.permission === 'viewer') return;

      db.updateActiveObjects(boardId, []);

      // Broadcast clear
      socket.to(roomName).emit('canvas:cleared', {
        modifiedBy: username
      });
    });

    // FULL SYNC / REORDER (E.G. BRING FORWARD, SEND BACKWARD, REDO, UNDO)
    socket.on('canvas:sync', (payload: { objects: DrawingObject[]; label?: string }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      const board = db.getBoardById(boardId);
      if (!board) return;

      const users = presenceMap.get(boardId);
      const activeUser = users?.find(u => u.socketId === socket.id);
      if (!activeUser || activeUser.permission === 'viewer') return;

      // Update in-memory state
      db.updateActiveObjects(boardId, payload.objects);

      // Broadcast complete update
      socket.to(roomName).emit('canvas:synced', {
        objects: payload.objects,
        modifiedBy: username,
        label: payload.label
      });
    });

    // CHAT MESSAGES
    socket.on('chat:message', (payload: { message: string }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      const chatMsg = db.createMessage(boardId, username, payload.message);

      // Broadcast message to room including sender
      io.to(roomName).emit('chat:message', chatMsg);
    });

    // TYPING INDICATORS
    socket.on('chat:typing', (payload: { isTyping: boolean }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      socket.to(roomName).emit('chat:typing', {
        username,
        isTyping: payload.isTyping
      });
    });

    // BOARD THEME TOGGLE
    socket.on('board:update-theme', (payload: { theme: 'white' | 'black' }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId, username } = session;
      const roomName = `board:${boardId}`;

      const board = db.getBoardById(boardId);
      if (!board) return;

      const users = presenceMap.get(boardId);
      const activeUser = users?.find(u => u.socketId === socket.id);
      if (!activeUser || activeUser.permission === 'viewer') return;

      db.updateBoard(boardId, { theme: payload.theme });

      io.to(roomName).emit('board:theme-updated', {
        theme: payload.theme,
        modifiedBy: username
      });
    });

    // COLLABORATIVE SLIDE NAVIGATION FOR PRESENTATION BOARDS
    socket.on('slide:change', (payload: { slideIndex: number }) => {
      const session = socketSessionMap.get(socket.id);
      if (!session) return;

      const { boardId } = session;
      const roomName = `board:${boardId}`;

      // Broadcast slide change to others
      socket.to(roomName).emit('slide:changed', {
        slideIndex: payload.slideIndex
      });
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const session = socketSessionMap.get(socket.id);
      if (session) {
        const { boardId, username } = session;
        socketSessionMap.delete(socket.id);

        const usersInBoard = presenceMap.get(boardId);
        if (usersInBoard) {
          const updatedUsers = usersInBoard.filter(u => u.socketId !== socket.id);
          presenceMap.set(boardId, updatedUsers);

          const roomName = `board:${boardId}`;
          // Notify room of updated presence
          io.to(roomName).emit('presence:update', updatedUsers);
        }
      }
    });
  });
}
