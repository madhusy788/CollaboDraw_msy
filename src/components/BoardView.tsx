import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { api, getToken } from '../lib/api';
import { Board, DrawingObject, PresenceUser, ChatMessage, BoardVersion, BoardTheme } from '../types';
import DrawingCanvas from './DrawingCanvas';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Save, 
  Share2, 
  Users, 
  Sun, 
  Moon, 
  MessageSquare, 
  History, 
  Download, 
  Send, 
  Trash2, 
  ShieldAlert, 
  Check, 
  Clock, 
  Globe, 
  Lock,
  UserPlus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface BoardViewProps {
  boardId: string;
  onBackToDashboard: () => void;
}

export default function BoardView({ boardId, onBackToDashboard }: BoardViewProps) {
  const { user } = useAuth();
  const token = getToken();

  // Socket Reference
  const [socket, setSocket] = useState<Socket | null>(null);

  // Board Data State
  const [board, setBoard] = useState<Board | null>(null);
  const [objects, setObjects] = useState<DrawingObject[]>([]);
  const [permission, setPermission] = useState<'viewer' | 'editor' | 'owner'>('viewer');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Presence State
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [userColor, setUserColor] = useState('#3b82f6');

  // Interactive Floating Chat Panel State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<{ [username: string]: NodeJS.Timeout }>({});
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Board Version Timeline History State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [versionsList, setVersionsList] = useState<BoardVersion[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  // Invite Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePermission, setInvitePermission] = useState<'viewer' | 'editor'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Auto-save tracker
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load of Board Details
  const loadBoardData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getBoardDetails(boardId);
      setBoard(data.board);
      setObjects(data.board.objects || []);
      setPermission(data.permission);

      // Fetch chat messages
      const msgs = await api.getOldMessages(boardId);
      setChatMessages(msgs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load board details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoardData();
  }, [boardId]);

  // 2. Establish Socket.io Connections
  useEffect(() => {
    if (!token || !boardId || loading || errorMsg) return;

    // Connect to WebSockets (Socket.io binds to Port 3000 alongside Express)
    const socketInstance = io();
//     const socketInstance = io("http://localhost:3000", {
//   transports: ["websocket"],
// });

    socketInstance.on('connect', () => {
      console.log('Connected to collaboration socket');
      // Request joining the isolated board room session
      socketInstance.emit('join-board', { boardId, token });
    });

    socketInstance.on('join-success', (payload: { permission: any; userColor: string; presenceList: PresenceUser[] }) => {
      setUserColor(payload.userColor);
      setActiveUsers(payload.presenceList);
    });

    socketInstance.on('error-msg', (msg: string) => {
      setErrorMsg(msg);
      socketInstance.disconnect();
    });

    // Realtime canvas synchronization listeners
    socketInstance.on('presence:update', (usersList: PresenceUser[]) => {
      setActiveUsers(usersList);
    });

    socketInstance.on('canvas:object-added', (payload: { object: DrawingObject }) => {
      // Prevent duplicate rendering
      setObjects((prev) => {
        if (prev.some(obj => obj.id === payload.object.id)) return prev;
        return [...prev, payload.object];
      });
    });

    socketInstance.on('canvas:object-modified', (payload: { object: DrawingObject }) => {
      setObjects((prev) =>
        prev.map(obj => obj.id === payload.object.id ? payload.object : obj)
      );
    });

    socketInstance.on('canvas:object-removed', (payload: { id: string }) => {
      setObjects((prev) => prev.filter(obj => obj.id !== payload.id));
    });

    socketInstance.on('canvas:cleared', () => {
      setObjects([]);
    });

    socketInstance.on('canvas:synced', (payload: { objects: DrawingObject[] }) => {
      setObjects(payload.objects);
    });

    // Theme updates
    socketInstance.on('board:theme-updated', (payload: { theme: 'white' | 'black' }) => {
      setBoard((prev) => prev ? { ...prev, theme: payload.theme } : null);
    });

    // Slides updates
    socketInstance.on('slide:changed', (payload: { slideIndex: number }) => {
      setCurrentSlideIndex(payload.slideIndex);
    });

    // Chat listeners
    socketInstance.on('chat:message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socketInstance.on('chat:typing', (payload: { username: string; isTyping: boolean }) => {
      const { username, isTyping } = payload;
      setTypingUsers((prev) => {
        if (isTyping) {
          if (prev.includes(username)) return prev;
          return [...prev, username];
        } else {
          return prev.filter(u => u !== username);
        }
      });
    });

    socketInstance.on('board:deleted', () => {
      setErrorMsg('This board has been permanently deleted by the owner. Redirecting to dashboard...');
      setTimeout(() => {
        onBackToDashboard();
      }, 3000);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [boardId, loading, errorMsg]);

  // Redraw cursors/dimensions when chat drawer pushes contents
  useEffect(() => {
    // Scroll chat bottom
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // Callback to update objects from DrawingCanvas operations
  const handleUpdateObjects = (updated: DrawingObject[], label?: string) => {
    setObjects(updated);
    setSaveStatus('dirty');
  };

  // Immediate manual Save Trigger
  const handleManualSave = async () => {
    if (permission === 'viewer') return;
    setSaveStatus('saving');
    try {
      await api.updateBoard(boardId, {
        objects,
        theme: board?.theme || 'white'
      });

      // Trigger a socket-based state sync which enforces server to save version + state to disk
      if (socket) {
        socket.emit('canvas:sync', { objects, label: 'Manual Save Checkpoint' });
      }
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('dirty');
    }
  };

  // 4. CHAT ACTIONS
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit('chat:message', { message: chatInput.trim() });
    setChatInput('');

    // Trigger typing stop
    socket.emit('chat:typing', { isTyping: false });
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    if (!socket) return;

    // Send typing status
    socket.emit('chat:typing', { isTyping: true });

    // Clear typing timeout
    if (typingTimeoutRef.current[user!.username]) {
      clearTimeout(typingTimeoutRef.current[user!.username]);
    }

    typingTimeoutRef.current[user!.username] = setTimeout(() => {
      socket.emit('chat:typing', { isTyping: false });
    }, 1500);
  };

  // 5. THEME TOGGLES
  const handleToggleTheme = () => {
    if (permission === 'viewer' || !board) return;
    const nextTheme = board.theme === 'white' ? 'black' : 'white';
    
    setBoard({ ...board, theme: nextTheme });
    
    if (socket) {
      socket.emit('board:update-theme', { theme: nextTheme });
    }
  };

  // 6. HISTORY LOG ROLLBACKS
  const handleOpenHistory = async () => {
    setIsHistoryOpen(true);
    setFetchingHistory(true);
    try {
      const list = await api.getVersions(boardId);
      setVersionsList(list);
    } catch (err) {
      console.error('Failed to load history list:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (permission === 'viewer') return;
    if (!window.confirm('Are you sure you want to restore the canvas objects to this past historical backup? All users currently in this room will see the restored layout.')) {
      return;
    }

    try {
      const res = await api.restoreVersion(boardId, versionId);
      setObjects(res.board.objects || []);
      setSaveStatus('saved');
      setIsHistoryOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to restore past checkpoint');
    }
  };

  // 7. INVITE / SHARING HANDLER
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await api.shareBoard(boardId, inviteUsername.trim(), invitePermission);
      setBoard(res.board);
      setInviteSuccess(`Successfully shared with @${inviteUsername}!`);
      setInviteUsername('');
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  // Remove Collaborator
  const handleRemoveCollaborator = async (usernameToRemove: string) => {
    try {
      const res = await api.unshareBoard(boardId, usernameToRemove);
      setBoard(res.board);
      setInviteSuccess(`Removed ${usernameToRemove}`);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to remove collaborator');
    }
  };

  // 8. IMAGE EXPORTS (PNG, JPEG, PDF)
  const handleExport = async (format: 'png' | 'jpeg' | 'pdf') => {
    const originalCanvas = document.getElementById('drawing-board-canvas') as HTMLCanvasElement;
    if (!originalCanvas) {
      alert('Unable to extract canvas context buffer');
      return;
    }

    // Prompt user to select filename
    const defaultFileName = `${board?.boardName || 'whiteboard'}_export`;
    let customName = window.prompt("Enter a filename for your export:", defaultFileName);
    if (customName === null) return; // User cancelled
    customName = customName.trim() || defaultFileName;

    // Creating high resolution off-screen canvas to capture proper background theme coloring
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = originalCanvas.width;
    exportCanvas.height = originalCanvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Fill background color based on board theme
    ctx.fillStyle = board?.theme === 'black' ? '#090d16' : '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw the drawings over background
    ctx.drawImage(originalCanvas, 0, 0);

    if (format === 'png' || format === 'jpeg') {
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = exportCanvas.toDataURL(mime);
      
      // Try using modern File System Access API for custom save location/dialog
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${customName}.${format}`,
            types: [
              {
                description: format === 'png' ? 'PNG Image' : 'JPEG Image',
                accept: {
                  [mime]: [`.${format}`],
                },
              },
            ],
          });
          const writable = await handle.createWritable();
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return; // User cancelled the native save dialog
          }
          console.warn('showSaveFilePicker failed, falling back to anchor click', err);
        }
      }

      // Fallback standard download
      const link = document.createElement('a');
      link.download = `${customName}.${format}`;
      link.href = dataUrl;
      link.click();
    } else if (format === 'pdf') {
      // PDF export compiles vector drawings into printable template
      const dataUrl = exportCanvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to export as PDF print formats');
        return;
      }
      
      printWindow.document.write(`
        <html>
          <head>
            <title>${customName}</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; background: #e5e7eb; font-family: sans-serif; }
              .card { background: white; padding: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-radius: 8px; max-width: 95%; text-align: center; }
              img { max-width: 100%; border: 1px solid #d1d5db; border-radius: 4px; }
              .btn-print { margin-top: 15px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
              @media print {
                body { background: white; }
                .btn-print, h2 { display: none; }
                .card { box-shadow: none; padding: 0; }
                img { border: none; }
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>${customName}</h2>
              <img src="${dataUrl}" />
              <br/>
              <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleClearCanvas = () => {
    if (permission === 'viewer') return;
    if (window.confirm('Clear all drawings and shapes on this board? This action will synchronize for all collaborators.')) {
      setObjects([]);
      if (socket) socket.emit('canvas:clear');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500">Synchronizing whiteboard space...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Workspace Loading Failed</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md mt-2">{errorMsg}</p>
        <button
          onClick={onBackToDashboard}
          className="mt-6 px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-2 hover:bg-blue-500 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      
      {/* TOPBAR NAVIGATION BAR */}
      <nav className="h-16 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-10 shadow-sm backdrop-blur-md">
        
        {/* Left Section: Back & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-900 dark:text-white leading-tight font-sans line-clamp-1">{board?.boardName}</span>
            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
              {board?.visibility === 'private' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5 text-green-500" />}
              <span>{board?.visibility} &bull; owner: @{board?.owner}</span>
            </span>
          </div>
        </div>

        {/* Center Section: Collaboration & Presence */}
        <div className="hidden lg:flex items-center gap-4">
          
          {/* Save Status Indicators */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <div className="w-3.5 h-3.5 border border-brand-teal border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider font-mono">Saving...</span>
              </>
            )}
            {saveStatus === 'dirty' && (
              <>
                <Save className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">Unsaved Changes</span>
              </>
            )}
          </div>

          {/* Connected User Avatars lists */}
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {activeUsers.slice(0, 4).map((user, idx) => (
                <div
                  key={user.socketId}
                  className="w-7.5 h-7.5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center font-bold text-xs text-white shadow-md relative"
                  style={{ backgroundColor: user.color }}
                  title={`${user.fullName} (@${user.username}) - ${user.permission}`}
                >
                  {user.fullName.charAt(0).toUpperCase()}
                  {/* Status dot indicator */}
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white dark:border-slate-900 rounded-full" />
                </div>
              ))}
              {activeUsers.length > 4 && (
                <div className="w-7.5 h-7.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 border-2 border-white dark:border-slate-900 flex items-center justify-center font-bold text-xs">
                  +{activeUsers.length - 4}
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold text-slate-400 font-mono">
              {activeUsers.length} online
            </span>
          </div>
        </div>

        {/* Right Section: Interactive actions */}
        <div className="flex items-center gap-1.5">
          
          {/* Clear canvas tool */}
          {permission !== 'viewer' && (
            <button
              onClick={handleClearCanvas}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-xl transition cursor-pointer"
              title="Clear Canvas objects"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          {/* Save Whiteboard button */}
          {permission !== 'viewer' && (
            <button
              onClick={handleManualSave}
              disabled={saveStatus === 'saving'}
              className={`px-3.5 py-2 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer ${
                saveStatus === 'dirty' 
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 ring-2 ring-amber-400 ring-offset-1 animate-pulse' 
                  : 'bg-brand-teal hover:bg-brand-teal/90 shadow-brand-teal/20'
              }`}
              title="Save all changes to the database"
            >
              <Save className="w-4 h-4" />
              <span>{saveStatus === 'saving' ? 'Saving...' : 'Save'}</span>
            </button>
          )}

          {/* Share Board button */}
          {permission === 'owner' && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-3.5 py-2 bg-brand-slate hover:bg-brand-slate/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-slate/20 transition flex items-center gap-1.5 cursor-pointer"
              title="Manage access permissions"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {/* Version history backup button */}
          <button
            onClick={handleOpenHistory}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
            title="Board restoration timelines"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Floating Export Menu */}
          <div className="relative group/export">
            <button
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer flex items-center"
              title="Download canvas"
            >
              <Download className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover/export:flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 w-32 gap-1 z-20">
              <button
                onClick={() => handleExport('png')}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
              >
                Export PNG
              </button>
              <button
                onClick={() => handleExport('jpeg')}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
              >
                Export JPEG
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
              >
                Print / PDF
              </button>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

          {/* Chat Panel Trigger */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2.5 rounded-xl transition relative cursor-pointer ${
              isChatOpen 
                ? 'bg-blue-500 text-white shadow-lg' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            title="Floating board chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

        </div>
      </nav>

      {/* INNER WORKSPACE AREA (CANVAS + FLOATING CHATS & TIMELINES) */}
      <div className="flex-1 w-full flex flex-row overflow-hidden relative">
        
        {/* DRAWING CANVAS FIELD */}
        <div className="flex-1 h-full relative">
          <DrawingCanvas
            boardId={boardId}
            theme={board?.theme || 'white'}
            objects={objects}
            onUpdateObjects={handleUpdateObjects}
            socket={socket}
            permission={permission}
            activeUsers={activeUsers}
            userColor={userColor}
            boardType={board?.boardType || 'infinite'}
            slideCount={board?.slideCount || 50}
            currentSlideIndex={currentSlideIndex}
          />

          {/* Slide navigation controls for Presentation boards */}
          {board?.boardType === 'presentation' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-4 py-2 shadow-2xl rounded-2xl select-none">
              <button
                onClick={() => {
                  if (currentSlideIndex > 0) {
                    const nextIdx = currentSlideIndex - 1;
                    setCurrentSlideIndex(nextIdx);
                    if (socket) socket.emit('slide:change', { slideIndex: nextIdx });
                  }
                }}
                disabled={currentSlideIndex === 0}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition font-bold cursor-pointer"
                title="Previous Slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center min-w-[70px]">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Slide Deck</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white font-sans">
                  {currentSlideIndex + 1} <span className="text-slate-400 font-normal">/</span> {board.slideCount || 50}
                </span>
              </div>

              <button
                onClick={() => {
                  const maxSlides = board.slideCount || 50;
                  if (currentSlideIndex < maxSlides - 1) {
                    const nextIdx = currentSlideIndex + 1;
                    setCurrentSlideIndex(nextIdx);
                    if (socket) socket.emit('slide:change', { slideIndex: nextIdx });
                  }
                }}
                disabled={currentSlideIndex >= (board.slideCount || 50) - 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition font-bold cursor-pointer"
                title="Next Slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* FLOATING REAL-TIME CHAT PANEL DRAWER */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-4 bottom-20 top-4 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col z-20 overflow-hidden"
            >
              {/* Chat Header */}
              <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span className="font-bold text-xs uppercase tracking-wider font-sans">Board Room Chat</span>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-white hover:text-blue-200 font-bold text-sm cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-xs font-bold text-slate-500">Room chat is empty</p>
                    <p className="text-[10px] text-slate-400 mt-1">Send a message to sync with other active drawers!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.sender.toLowerCase() === user?.username.toLowerCase();
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[9px] text-slate-400 font-mono px-1.5 mb-0.5">
                          {isMe ? 'You' : `@${msg.sender}`} &bull; {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs shadow-sm font-medium ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Typing indicators */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic">
                    <div className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>{typingUsers.join(', ')} typing...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={handleChatInputChange}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl shadow cursor-pointer transition flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* BOARD HISTORY VERSION TIMELINE DRAWER */}
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              className="absolute right-4 bottom-20 top-4 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col z-20 overflow-hidden"
            >
              <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4.5 h-4.5" />
                  <span className="font-bold text-xs uppercase tracking-wider font-sans">Version Timelines</span>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="text-white hover:text-indigo-200 font-bold text-sm cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {fetchingHistory ? (
                  <div className="h-full flex items-center justify-center flex-col">
                    <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-xs text-slate-400">Loading checkpoint list...</span>
                  </div>
                ) : versionsList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">No past versions logged yet.</p>
                ) : (
                  <div className="relative border-l border-indigo-200 dark:border-indigo-950 pl-4 ml-2 space-y-6 py-2">
                    {versionsList.map((ver, idx) => (
                      <div key={ver.id} className="relative group">
                        {/* Timeline node */}
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 group-hover:bg-indigo-400 transition" />
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 font-mono uppercase">
                            <Clock className="w-3 h-3" />
                            {new Date(ver.timestamp).toLocaleDateString()} {new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                            Modified by: <strong className="font-bold text-slate-900 dark:text-white">@{ver.modifiedBy}</strong>
                          </span>
                          <span className="text-[10px] text-slate-400">{ver.objects?.length || 0} drawing vectors</span>
                          
                          {permission !== 'viewer' && (
                            <button
                              onClick={() => handleRestoreVersion(ver.id)}
                              className="mt-1.5 self-start px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 text-[10px] font-extrabold rounded transition cursor-pointer"
                            >
                              Restore version
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>

      {/* SHARE / INVITE OVERLAY MODAL */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Share2 className="w-4.5 h-4.5 text-indigo-500" />
                    <span>Invite Collaborators</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Manage whiteboard shared permissions</span>
                </div>
                <button
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setInviteSuccess(null);
                    setInviteError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Share link block */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl mb-4">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Copy Board Invitation Link</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/board/${boardId}`}
                    className="bg-transparent border-none outline-none text-[10px] font-mono text-slate-600 dark:text-slate-400 flex-1 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`);
                      setInviteSuccess('Copied link to clipboard!');
                    }}
                    className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 text-[10px] font-bold rounded-lg cursor-pointer"
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {inviteSuccess && (
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-950/25 border border-green-200 dark:border-green-900/50 text-[11px] text-green-600 dark:text-green-400 font-semibold rounded-lg">
                  {inviteSuccess}
                </div>
              )}

              {inviteError && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900/50 text-[11px] text-red-600 dark:text-red-400 font-semibold rounded-lg">
                  {inviteError}
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-3.5 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Invite by Username</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="E.g. janesmith"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                    />
                    <select
                      value={invitePermission}
                      onChange={(e) => setInvitePermission(e.target.value as 'viewer' | 'editor')}
                      className="px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </form>

              {/* List of collaborators */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Invitees</span>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {!board?.collaborators || board.collaborators.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No invitees yet. This board is private.</p>
                  ) : (
                    board.collaborators.map((col, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">@{col.username}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            col.permission === 'editor' ? 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600' : 'bg-indigo-50 dark:bg-indigo-950/25 text-indigo-600'
                          }`}>
                            {col.permission}
                          </span>
                          <button
                            onClick={() => handleRemoveCollaborator(col.username)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 rounded cursor-pointer"
                            title="Remove collaborator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
