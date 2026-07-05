import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Board, BoardTheme, BoardVisibility } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Folder, 
  Users, 
  Calendar, 
  User as UserIcon, 
  Eye, 
  PenTool, 
  Trash2, 
  Share2, 
  ExternalLink,
  LogOut,
  Sparkles,
  Search,
  Grid,
  Lock,
  Globe,
  Settings,
  
} from 'lucide-react';

interface DashboardViewProps {
  onOpenBoard: (boardId: string) => void;
}

export default function DashboardView({ onOpenBoard }: DashboardViewProps) {
  const { user, logout } = useAuth();
  
  // Data State
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search/Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [boardLink, setBoardLink] = useState("");

const handleJoinBoard = () => {
  if (!boardLink.trim()) {
    alert("Please paste a board link.");
    return;
  }

  try {
    const url = new URL(boardLink.trim());

    // Gets the last part of the URL
    const boardId = url.pathname.split("/").pop();

    if (!boardId) {
      alert("Invalid board link.");
      return;
    }

    onOpenBoard(boardId);
  } catch {
    alert("Invalid board link.");
  }
};

  // Create Board Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardTheme, setNewBoardTheme] = useState<BoardTheme>('white');
  const [newBoardVisibility, setNewBoardVisibility] = useState<BoardVisibility>('private');
  const [newBoardType, setNewBoardType] = useState<'presentation' | 'infinite'>('infinite');
  const [newSlideCount, setNewSlideCount] = useState<number>(50);
  const [creating, setCreating] = useState(false);

  // Invite/Share Modal State
  const [sharingBoard, setSharingBoard] = useState<Board | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePermission, setInvitePermission] = useState<'viewer' | 'editor'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Load Boards
  const fetchBoards = async () => {
    try {
      setLoading(true);
      const data = await api.getBoards();
      setBoards(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch boards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  // Create Board Handler
  // Create Board Handler
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      const created = await api.createBoard(
        newBoardName.trim(), 
        newBoardTheme, 
        newBoardVisibility,
        newBoardType,
        newBoardType === 'presentation' ? newSlideCount : 50
      );
      setIsCreateModalOpen(false);
      // Reset form
      setNewBoardName('');
      setNewBoardTheme('white');
      setNewBoardVisibility('private');
      setNewBoardType('infinite');
      setNewSlideCount(50);
      
      // Auto open newly created board
      onOpenBoard(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create board');
      setCreating(false);
    }
  };

  // Delete Board Handler
  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this whiteboard? All elements, history, and chat messages will be permanently destroyed.')) {
      return;
    }

    try {
      await api.deleteBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete board');
    }
  };

  // Invite Collaborator Handler
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingBoard || !inviteUsername.trim()) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await api.shareBoard(sharingBoard.id, inviteUsername.trim(), invitePermission);
      setInviteSuccess(`Successfully shared with ${inviteUsername}!`);
      setInviteUsername('');
      
      // Refresh board data
      fetchBoards();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  // Remove Collaborator
  const handleRemoveCollaborator = async (usernameToRemove: string) => {
    if (!sharingBoard) return;

    try {
      const res = await api.unshareBoard(sharingBoard.id, usernameToRemove);
      setSharingBoard(res.board);
      setInviteSuccess(`Removed ${usernameToRemove}`);
      fetchBoards();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to remove collaborator');
    }
  };

  // Separate owned vs shared boards
  const ownedBoards = boards.filter(
    (b) => b.owner.toLowerCase() === user?.username.toLowerCase()
  );
  
  const sharedBoards = boards.filter(
    (b) => b.owner.toLowerCase() !== user?.username.toLowerCase()
  );

  // Filtered by Search Term
  const filteredOwned = ownedBoards.filter((b) =>
    b.boardName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredShared = sharedBoards.filter((b) =>
    b.boardName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // View state for board management sub-pages
  const [currentView, setCurrentView] = useState<'management' | 'my-boards' | 'shared-boards'>('management');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      
      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        {/* Left Side: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Sparkles className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white font-display">CollabDraw</span>
            <span className="ml-1.5 text-[10px] bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">v1.2</span>
          </div>
        </div>

        {/* Center Side: Header */}
        <div className="hidden md:flex flex-col items-center">
          <h1 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
            {currentView === 'management' && 'BOARD MANAGEMENT'}
            {currentView === 'my-boards' && 'MY PERSONAL WORKSPACE'}
            {currentView === 'shared-boards' && 'SHARED WORKSPACES'}
          </h1>
        </div>

        {/* Right Side: Profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-700 dark:text-violet-400 font-bold text-sm">
              {user?.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight font-sans">{user?.fullName}</span>
              <span className="text-[10px] text-slate-400 font-mono">@{user?.username}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1.5 text-xs font-bold border border-red-200/50 dark:border-red-900/30 cursor-pointer"
            title="Log out of CollabDraw"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* DASHBOARD CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">

        {/* 1. MAIN BOARD MANAGEMENT LANDING VIEW */}
        {currentView === 'management' && (
          <div className="space-y-10">
            {/* Welcome banner */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm bg-gradient-to-r from-white via-violet-50/10 to-rose-50/10 dark:from-slate-900 dark:via-violet-950/5 dark:to-rose-950/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-display">
                  Welcome back, {user?.fullName}!
                </h2>
                <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-2 font-sans">
                  Manage your creative ideas or collaborate on shared canvases. Select a workspace view below to begin.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="self-start md:self-auto px-5 py-3 bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Create New Board</span>
              </button>
            </div>

            {/* TWO LARGE MODERN CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card 1: My Previous Boards */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                onClick={() => setCurrentView('my-boards')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col justify-between gap-8 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
              >
                {/* Accent glow corner */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                
                <div className="space-y-6">
                  {/* Icon Illustration */}
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200/50 dark:border-violet-800/50 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Folder className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                      My Previous Boards
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-sans">
                      Access, manage, and edit all collaborative whiteboard projects created by you. Includes options to share with editors and view past history version logs.
                    </p>
                  </div>
                </div>
                {/* JOIN BOARD */}

<div className="mt-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">

    <div className="flex items-center gap-3 mb-6">

        <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">

            <Link2 className="w-6 h-6 text-cyan-600"/>

        </div>

        <div>

            <h2 className="text-2xl font-bold">
                Join Board
            </h2>

            <p className="text-sm text-gray-500">
                Paste a board link shared with you.
            </p>

        </div>

    </div>

    <div className="flex gap-4">

        <input
            type="text"
            placeholder="Paste Board Link Here..."
            value={boardLink}
            onChange={(e)=>setBoardLink(e.target.value)}
            className="flex-1 border rounded-xl px-5 py-4 focus:ring-2 focus:ring-cyan-500 outline-none"
        />

        <button
            onClick={handleJoinBoard}
            className="px-8 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition"
        >
            Join Board
        </button>

    </div>

</div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-5">
                  <span className="text-xs font-mono font-bold text-violet-600 dark:text-rose-400 bg-violet-50 dark:bg-violet-950/40 px-3 py-1.5 rounded-full">
                    {ownedBoards.length} {ownedBoards.length === 1 ? 'Board' : 'Boards'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-rose-400 flex items-center gap-1.5 transition-colors">
                    <span>Manage Boards</span>
                    <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </motion.div>

              {/* Card 2: Shared Boards */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                onClick={() => setCurrentView('shared-boards')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col justify-between gap-8 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
              >
                {/* Accent glow corner */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                
                <div className="space-y-6">
                  {/* Icon Illustration */}
                  <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200/50 dark:border-rose-800/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                      Shared Boards
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-sans">
                      Whiteboards hosted by other creators that have been shared with you. View, review, or collaborate based on your assigned editor or viewer permissions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-5">
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-full">
                    {sharedBoards.length} {sharedBoards.length === 1 ? 'Board' : 'Boards'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 flex items-center gap-1.5 transition-colors">
                    <span>View Workspaces</span>
                    <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* 2. MY PREVIOUS BOARDS PAGE */}
        {currentView === 'my-boards' && (
          <div className="space-y-6">
            {/* Header controls & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('management')}
                  className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer font-sans"
                >
                  &larr; Back to Management
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">My Created Boards</h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl shadow-sm w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search my boards..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-full text-slate-900 dark:text-white placeholder-slate-400"
                  />
                </div>
                {/* Create Trigger */}
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Board</span>
                </button>
              </div>
            </div>

            {/* Owned Boards Content */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-44 bg-slate-200/50 dark:bg-slate-900/50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredOwned.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
                <Folder className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No personal boards found</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Get started by building your first collaborative whiteboard workspace!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOwned.map((board) => (
                  <motion.div
                    key={board.id}
                    whileHover={{ y: -4 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md flex flex-col justify-between gap-5 transition-all duration-200"
                  >
                    <div>
                      {/* Badge line */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {board.visibility === 'private' ? (
                            <>
                              <Lock className="w-2.5 h-2.5 text-rose-500" />
                              <span>Private</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-2.5 h-2.5 text-violet-500" />
                              <span>Shared</span>
                            </>
                          )}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">
                          {board.theme} theme
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1 font-display">
                        {board.boardName}
                      </h4>

                      <div className="mt-3 space-y-1 text-xs text-slate-400 dark:text-slate-500 font-sans">
                        <div className="flex justify-between">
                          <span>Created Date:</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {new Date(board.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Modified:</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {new Date(board.updatedAt || board.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
                      <button
                        onClick={() => onOpenBoard(board.id)}
                        className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>

                      <button
                        onClick={() => setSharingBoard(board)}
                        className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl transition border border-slate-200/50 dark:border-slate-800/50 cursor-pointer"
                        title="Manage invitations"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteBoard(board.id)}
                        className="p-2 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl transition border border-rose-200/20 dark:border-rose-900/20 cursor-pointer"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. SHARED BOARDS PAGE */}
        {currentView === 'shared-boards' && (
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('management')}
                  className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer font-sans"
                >
                  &larr; Back to Management
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Shared Workspaces</h2>
              </div>

              {/* Search Bar */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl shadow-sm w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search shared boards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs w-full text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>
            </div>

            {/* Shared boards listing */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1].map((n) => (
                  <div key={n} className="h-44 bg-slate-200/50 dark:bg-slate-900/50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredShared.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
                <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No shared boards found</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Boards that other users share with you will appear in this section.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredShared.map((board) => {
                  const userCol = board.collaborators?.find(c => c.username.toLowerCase() === user?.username.toLowerCase());
                  const permission = userCol?.permission || 'viewer';

                  return (
                    <motion.div
                      key={board.id}
                      whileHover={{ y: -4 }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md flex flex-col justify-between gap-5 transition-all duration-200"
                    >
                      <div>
                        {/* Permission badge and theme */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                            permission === 'editor' 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50' 
                              : 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200/50'
                          }`}>
                            {permission === 'editor' ? (
                              <>
                                <PenTool className="w-2.5 h-2.5" />
                                <span>Editor</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-2.5 h-2.5" />
                                <span>Viewer Only</span>
                              </>
                            )}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">
                            {board.theme} theme
                          </span>
                        </div>

                        <h4 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1 font-display">
                          {board.boardName}
                        </h4>

                        <div className="mt-3 space-y-1 text-xs text-slate-400 dark:text-slate-500 font-sans">
                          <div className="flex justify-between">
                            <span>Owner Name:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-300 font-mono">
                              @{board.owner}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Permission:</span>
                            <span className="font-bold uppercase text-[10px] text-slate-600 dark:text-slate-300">
                              {permission}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Open Action - ONLY Open is allowed, DELETE MUST NOT exist */}
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <button
                          onClick={() => onOpenBoard(board.id)}
                          className="w-full py-2 bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
        <span>CollabDraw Collaborative Whiteboard Tool &bull; Powered by Express, Socket.io, & HTML5 Canvas</span>
      </footer>

      {/* CREATE BOARD MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2 font-display">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  <span>Create New Whiteboard</span>
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateBoard} className="space-y-4">
                {/* Board Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Board Name</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="E.g. Brainstorming Session"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Theme Options */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Visual Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewBoardTheme('white')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition ${
                        newBoardTheme === 'white'
                          ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                      }`}
                    >
                      <div className="w-full h-8 bg-white border border-slate-200 rounded mb-1" />
                      <span className="text-[10px]">White Board</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBoardTheme('black')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition ${
                        newBoardTheme === 'black'
                          ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                      }`}
                    >
                      <div className="w-full h-8 bg-slate-950 border border-slate-800 rounded mb-1" />
                      <span className="text-[10px]">Black Board</span>
                    </button>
                  </div>
                </div>

                {/* Board Type Options */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Board Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewBoardType('infinite')}
                      className={`p-3 rounded-xl border flex flex-col items-start gap-1 cursor-pointer text-left transition ${
                        newBoardType === 'infinite'
                          ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                      }`}
                    >
                      <span className="text-xs font-bold">Infinite Canvas</span>
                      <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500">Expands right & down</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBoardType('presentation')}
                      className={`p-3 rounded-xl border flex flex-col items-start gap-1 cursor-pointer text-left transition ${
                        newBoardType === 'presentation'
                          ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                      }`}
                    >
                      <span className="text-xs font-bold">Presentation Mode</span>
                      <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500">Fixed screen-sized slides</span>
                    </button>
                  </div>
                </div>

                {/* Slide Count Input for Presentation Mode */}
                {newBoardType === 'presentation' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Number of Slides</label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={newSlideCount}
                      onChange={(e) => setNewSlideCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                 {/* Visibility */}
                 <div className="flex flex-col gap-1.5">
                   <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Board Visibility</label>
                   <div className="grid grid-cols-2 gap-3">
                     <button
                       type="button"
                       onClick={() => setNewBoardVisibility('private')}
                       className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition ${
                         newBoardVisibility === 'private'
                           ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 font-bold'
                           : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                       }`}
                     >
                       <Lock className="w-4 h-4" />
                       <span className="text-[10px]">Private (Only me)</span>
                     </button>
                     <button
                       type="button"
                       onClick={() => setNewBoardVisibility('shared')}
                       className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition ${
                         newBoardVisibility === 'shared'
                           ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 font-bold'
                           : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400'
                       }`}
                     >
                       <Globe className="w-4 h-4" />
                       <span className="text-[10px]">Shared (Link access)</span>
                     </button>
                   </div>
                 </div>
 
                 {/* Submit */}
                 <button
                   type="submit"
                   disabled={creating}
                   className="w-full mt-2 py-3 bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 disabled:from-violet-600/50 disabled:to-rose-500/50 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                 >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Create Board</span>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHARE / INVITE COLLABORATORS MODAL */}
      <AnimatePresence>
        {sharingBoard && (
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
                    <Share2 className="w-4.5 h-4.5 text-violet-500" />
                    <span>Share Board</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 leading-none">"{sharingBoard.boardName}"</span>
                </div>
                <button
                  onClick={() => {
                    setSharingBoard(null);
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
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unique Board URL Link</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/board/${sharingBoard.id}`}
                    className="bg-transparent border-none outline-none text-[10px] font-mono text-slate-600 dark:text-slate-400 flex-1 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/board/${sharingBoard.id}`);
                      setInviteSuccess('Copied link to clipboard!');
                    }}
                    className="px-2 py-1 bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 hover:bg-violet-200 text-[10px] font-bold rounded-lg cursor-pointer"
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
                      className="px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </form>

              {/* List of collaborators */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Collaborators</span>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {sharingBoard.collaborators?.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No invitees yet. This board is private.</p>
                  ) : (
                    sharingBoard.collaborators?.map((col, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">@{col.username}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            col.permission === 'editor' ? 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600' : 'bg-violet-50 dark:bg-violet-950/25 text-violet-600'
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
