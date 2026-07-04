import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Pointer, 
  Pencil, 
  Slash, 
  Square, 
  Circle as CircleIcon, 
  Triangle as TriangleIcon, 
  MoveRight, 
  Type, 
  FileText, 
  Image as ImageIcon, 
  Eraser, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Hand, 
  Sparkles,
  ChevronDown,
  Undo,
  Redo
} from 'lucide-react';
import { DrawingObject, PresenceUser, BoardTheme } from '../types';
import { drawArrow, isPointInObject, drawGrid } from '../lib/canvasUtils';

interface DrawingCanvasProps {
  boardId: string;
  theme: BoardTheme;
  objects: DrawingObject[];
  onUpdateObjects: (updated: DrawingObject[], label?: string) => void;
  socket: Socket | null;
  permission: 'viewer' | 'editor' | 'owner';
  activeUsers: PresenceUser[];
  userColor: string;
  boardType?: 'presentation' | 'infinite';
  slideCount?: number;
  currentSlideIndex?: number;
}

export default function DrawingCanvas({
  boardId,
  theme,
  objects,
  onUpdateObjects,
  socket,
  permission,
  activeUsers,
  userColor,
  boardType = 'infinite',
  slideCount = 50,
  currentSlideIndex = 0
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Canvas View State
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Pan constraint adjustment helper to limit panning right/down only (coordinates >= 0)
  const adjustPan = (newPan: { x: number; y: number }) => {
    if (boardType === 'infinite') {
      setPan({
        x: Math.min(0, newPan.x),
        y: Math.min(0, newPan.y)
      });
    } else {
      setPan(newPan);
    }
  };

  const adjustPanFunc = (updater: (prev: { x: number; y: number }) => { x: number; y: number }) => {
    setPan((prev) => {
      const next = updater(prev);
      if (boardType === 'infinite') {
        return {
          x: Math.min(0, next.x),
          y: Math.min(0, next.y)
        };
      }
      return next;
    });
  };

  const [activeTool, setActiveTool] = useState<
    'pointer' | 'pencil' | 'line' | 'rect' | 'circle' | 'triangle' | 'arrow' | 'text' | 'sticky' | 'eraser' | 'hand' | 'laser'
  >('pencil');

  const handleToolChange = (tool: typeof activeTool) => {
    setActiveTool(tool);
    setSelectedObjectId(null); // Clear selection on tool change to avoid clutter
    if (tool === 'text') {
      if (strokeWidth < 15) {
        setStrokeWidth(28); // Default font size to 28px (minimum of 25px)
      }
    } else {
      if (strokeWidth >= 15) {
        setStrokeWidth(3); // Reset to line width
      }
    }
  };

  // Drawing Styles State
  const [strokeColor, setStrokeColor] = useState('#3b82f6');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);

  // Active interaction state
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [objectStartPos, setObjectStartPos] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Undo/Redo queues (History stacks)
  const [undoStack, setUndoStack] = useState<DrawingObject[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingObject[][]>([]);

  // Text inputs & sticky notes overlay state
  const [textInput, setTextInput] = useState<{
    id?: string;
    x: number;
    y: number;
    type: 'text' | 'sticky';
    value: string;
    stickyColor?: string;
  } | null>(null);

  // Cached HTML Image elements for instant rendering (High FPS)
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Copy paste board
  const [clipboard, setClipboard] = useState<DrawingObject | null>(null);

  // Filter objects depending on slide mode
  const visibleObjects = useMemo(() => {
    if (boardType === 'presentation') {
      return objects.filter((obj) => (obj.slideIndex ?? 0) === currentSlideIndex);
    }
    return objects;
  }, [objects, boardType, currentSlideIndex]);

  // Reset zoom and pan when boardType is presentation
  useEffect(() => {
    if (boardType === 'presentation') {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [boardType]);

  // Laser trail points for laser pointer tool
  const [laserTrail, setLaserTrail] = useState<{ x: number; y: number; age: number }[]>([]);
  const laserIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync color with theme defaults if client requests
  useEffect(() => {
    if (theme === 'black' && strokeColor === '#000000') {
      setStrokeColor('#ffffff');
    } else if (theme === 'white' && strokeColor === '#ffffff') {
      setStrokeColor('#1f2937');
    }
  }, [theme]);

  // Handle Resize using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update Canvas Sizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    render();
  }, [dimensions, zoom, pan, visibleObjects, theme, selectedObjectId, activeUsers, laserTrail]);

  // Redraw loop helper
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Screen
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw grid first
    drawGrid(ctx, dimensions.width, dimensions.height, zoom, pan.x, pan.y, theme);

    // Apply viewport transform (Zoom and Pan)
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw all objects
    visibleObjects.forEach((obj) => {
      ctx.save();
      ctx.globalAlpha = obj.opacity ?? 1;

      // Selection outline highlight
      const isSelected = obj.id === selectedObjectId;

      switch (obj.type) {
        case 'pencil': {
          if (!obj.points || obj.points.length === 0) return;
          ctx.strokeStyle = obj.strokeColor || '#000000';
          ctx.lineWidth = obj.strokeWidth || 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(obj.points[0].x, obj.points[0].y);
          for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y);
          }
          ctx.stroke();
          break;
        }

        case 'line': {
          ctx.strokeStyle = obj.strokeColor || '#000000';
          ctx.lineWidth = obj.strokeWidth || 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          ctx.lineTo(obj.x + (obj.width ?? 0), obj.y + (obj.height ?? 0));
          ctx.stroke();
          break;
        }

        case 'arrow': {
          drawArrow(
            ctx,
            obj.x,
            obj.y,
            obj.x + (obj.width ?? 0),
            obj.y + (obj.height ?? 0),
            obj.strokeColor || '#000000',
            obj.strokeWidth || 2,
            obj.opacity ?? 1
          );
          break;
        }

        case 'rect': {
          if (obj.fillColor && obj.fillColor !== 'transparent') {
            ctx.fillStyle = obj.fillColor;
            ctx.fillRect(obj.x, obj.y, obj.width ?? 0, obj.height ?? 0);
          }
          ctx.strokeStyle = obj.strokeColor || '#000000';
          ctx.lineWidth = obj.strokeWidth || 2;
          ctx.strokeRect(obj.x, obj.y, obj.width ?? 0, obj.height ?? 0);
          break;
        }

        case 'circle': {
          const r = Math.max(obj.width ?? 0, obj.height ?? 0) / 2;
          const cx = obj.x + r;
          const cy = obj.y + r;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, 2 * Math.PI);
          if (obj.fillColor && obj.fillColor !== 'transparent') {
            ctx.fillStyle = obj.fillColor;
            ctx.fill();
          }
          ctx.strokeStyle = obj.strokeColor || '#000000';
          ctx.lineWidth = obj.strokeWidth || 2;
          ctx.stroke();
          break;
        }

        case 'triangle': {
          const w = obj.width ?? 0;
          const h = obj.height ?? 0;
          ctx.beginPath();
          ctx.moveTo(obj.x + w / 2, obj.y);
          ctx.lineTo(obj.x, obj.y + h);
          ctx.lineTo(obj.x + w, obj.y + h);
          ctx.closePath();
          if (obj.fillColor && obj.fillColor !== 'transparent') {
            ctx.fillStyle = obj.fillColor;
            ctx.fill();
          }
          ctx.strokeStyle = obj.strokeColor || '#000000';
          ctx.lineWidth = obj.strokeWidth || 2;
          ctx.stroke();
          break;
        }

        case 'text': {
          ctx.fillStyle = obj.strokeColor || (theme === 'black' ? '#ffffff' : '#000000');
          const fs = (obj.strokeWidth && obj.strokeWidth >= 15) ? obj.strokeWidth : Math.max(25, (obj.strokeWidth ?? 3) * 5 + 12);
          ctx.font = `${fs}px Inter, sans-serif`;
          ctx.textBaseline = 'top';
          const lines = (obj.text || '').split('\n');
          lines.forEach((line, i) => {
            ctx.fillText(line, obj.x, obj.y + i * (fs * 1.25));
          });
          break;
        }

        case 'sticky': {
          const w = obj.width ?? 120;
          const h = obj.height ?? 120;
          
          // Draw sticky shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 3;

          ctx.fillStyle = obj.fillColor || '#fef08a'; // Pastel yellow
          ctx.fillRect(obj.x, obj.y, w, h);
          ctx.shadowColor = 'transparent'; // Reset shadow
          
          // Outer border
          ctx.strokeStyle = 'rgba(0,0,0,0.05)';
          ctx.lineWidth = 1;
          ctx.strokeRect(obj.x, obj.y, w, h);

          // Render centered text
          ctx.fillStyle = '#1e293b'; // Slate 800 for legibility
          ctx.font = '14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const maxWordsPerLine = 3;
          const words = (obj.text || '').split(' ');
          const lines: string[] = [];
          let currentLine = '';

          words.forEach((word) => {
            if (currentLine.split(' ').length >= maxWordsPerLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = currentLine ? `${currentLine} ${word}` : word;
            }
          });
          if (currentLine) lines.push(currentLine);

          const totalTextHeight = lines.length * 18;
          const startY = obj.y + h / 2 - totalTextHeight / 2 + 9;

          lines.forEach((line, i) => {
            ctx.fillText(line, obj.x + w / 2, startY + i * 18);
          });
          break;
        }

        case 'image': {
          if (obj.imageUrl) {
            let img = imageCache.current.get(obj.imageUrl);
            if (!img) {
              img = new Image();
              img.src = obj.imageUrl;
              img.onload = () => {
                render(); // Redraw once loaded
              };
              imageCache.current.set(obj.imageUrl, img);
            }

            if (img.complete && img.naturalWidth > 0) {
              ctx.drawImage(img, obj.x, obj.y, obj.width ?? 150, obj.height ?? 150);
            } else {
              // Image placeholder while loading
              ctx.strokeStyle = '#9ca3af';
              ctx.lineWidth = 1;
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(obj.x, obj.y, obj.width ?? 150, obj.height ?? 150);
              ctx.font = '12px Inter, sans-serif';
              ctx.fillStyle = '#6b7280';
              ctx.textAlign = 'center';
              ctx.fillText('Loading Image...', obj.x + (obj.width ?? 150) / 2, obj.y + (obj.height ?? 150) / 2);
              ctx.setLineDash([]); // Reset
            }
          }
          break;
        }
      }

      // Draw Selection Highlight outline around shape
      if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        
        const pad = 6;
        if (obj.type === 'pencil' || obj.type === 'line' || obj.type === 'arrow') {
          // Wrap line bounding box
          ctx.strokeRect(
            obj.x - pad,
            obj.y - pad,
            (obj.width ?? 0) + pad * 2,
            (obj.height ?? 0) + pad * 2
          );
        } else {
          ctx.strokeRect(
            obj.x - pad,
            obj.y - pad,
            (obj.width ?? 100) + pad * 2,
            (obj.height ?? 100) + pad * 2
          );
        }
        ctx.setLineDash([]); // Reset
      }

      ctx.restore();
    });

    // Draw dynamic laser pointers
    laserTrail.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = pt.age;
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 * pt.age, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore(); // Restore zoom/pan

    // Draw active users' cursor coordinates in real time on HTML overlay (for low-latency smoothness)
  };

  // Convert screen coordinates to virtual world coordinates
  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let x = (clientX - rect.left - pan.x) / zoom;
    let y = (clientY - rect.top - pan.y) / zoom;

    if (boardType === 'infinite') {
      x = Math.max(0, x);
      y = Math.max(0, y);
    }
    return { x, y };
  };

  // Mouse Down Event
  const handleMouseDown = (e: React.MouseEvent) => {
    if (permission === 'viewer') return;
    if (e.button !== 0) return; // Only allow left clicks

    // If a text input or sticky note is active, finalize it first on canvas click
    if (textInput) {
      handleTextSubmit();
      return;
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Hand tool or active Space bar
    if (activeTool === 'hand' || e.shiftKey) {
      if (boardType === 'presentation') return; // Disable panning in presentation mode
      setIsDrawing(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Pointer selection tool
    if (activeTool === 'pointer') {
      // Find top-most object hit
      let hitId: string | null = null;
      for (let i = objects.length - 1; i >= 0; i--) {
        if (isPointInObject(worldPos.x, worldPos.y, objects[i])) {
          hitId = objects[i].id;
          break;
        }
      }

      // Re-selection edit check: if clicking on an already selected text or sticky note, open it for editing
      if (hitId && hitId === selectedObjectId) {
        const hitObj = objects.find(o => o.id === hitId)!;
        if (hitObj.type === 'text' || hitObj.type === 'sticky') {
          setTextInput({
            id: hitObj.id,
            x: hitObj.x,
            y: hitObj.y,
            type: hitObj.type as 'text' | 'sticky',
            value: hitObj.text || '',
            stickyColor: hitObj.fillColor
          });
          setSelectedObjectId(null); // Clear selection so input has full focus
          return;
        }
      }

      setSelectedObjectId(hitId);

      if (hitId) {
        setUndoStack([...undoStack, objects]);
        setRedoStack([]);
        const hitObj = objects.find(o => o.id === hitId)!;
        setIsDrawing(true);
        setDragStart({ x: worldPos.x, y: worldPos.y });
        setObjectStartPos({ x: hitObj.x, y: hitObj.y });
      }
      return;
    }

    // Creating Text or Sticky Note via mouse click
    if (activeTool === 'text' || activeTool === 'sticky') {
      // Check if clicked on an existing object of same type to edit it
      let hitId: string | null = null;
      for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].type === activeTool && isPointInObject(worldPos.x, worldPos.y, objects[i])) {
          hitId = objects[i].id;
          break;
        }
      }

      if (hitId) {
        const hitObj = objects.find(o => o.id === hitId)!;
        setTextInput({
          id: hitObj.id,
          x: hitObj.x,
          y: hitObj.y,
          type: activeTool,
          value: hitObj.text || '',
          stickyColor: hitObj.fillColor
        });
        setSelectedObjectId(null);
        return;
      }

      setTextInput({
        x: worldPos.x,
        y: worldPos.y,
        type: activeTool,
        value: '',
        stickyColor: fillColor === 'transparent' ? '#fef08a' : fillColor
      });
      return;
    }

    // Start drawing drawing tools
    setIsDrawing(true);
    setDragStart({ x: worldPos.x, y: worldPos.y });

    // Store history state before creating new object
    setUndoStack([...undoStack, objects]);
    setRedoStack([]); // Clear redo on action

    const newId = Math.random().toString(36).substring(2, 9);
    
    let newObject: DrawingObject | null = null;

    if (activeTool === 'pencil') {
      newObject = {
        id: newId,
        type: 'pencil',
        x: worldPos.x,
        y: worldPos.y,
        strokeColor,
        strokeWidth,
        opacity,
        points: [{ x: worldPos.x, y: worldPos.y }]
      };
    } else if (activeTool === 'line' || activeTool === 'arrow') {
      newObject = {
        id: newId,
        type: activeTool,
        x: worldPos.x,
        y: worldPos.y,
        width: 0,
        height: 0,
        strokeColor,
        strokeWidth,
        opacity
      };
    } else if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle') {
      newObject = {
        id: newId,
        type: activeTool,
        x: worldPos.x,
        y: worldPos.y,
        width: 0,
        height: 0,
        strokeColor,
        fillColor,
        strokeWidth,
        opacity
      };
    } else if (activeTool === 'eraser') {
      // Direct erasing on click
      const hitObj = objects.find(obj => isPointInObject(worldPos.x, worldPos.y, obj));
      if (hitObj) {
        const updated = objects.filter(o => o.id !== hitObj.id);
        onUpdateObjects(updated, `Erased shape`);
        if (socket) socket.emit('canvas:object-removed', { id: hitObj.id });
      }
    }

    if (newObject) {
      if (boardType === 'presentation') {
        newObject.slideIndex = currentSlideIndex;
      }
      setSelectedObjectId(newObject.id);
      onUpdateObjects([...objects, newObject]);
    }
  };

  // Mouse Move Event
  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Socket.io Cursor presence tracking
    if (socket) {
      socket.emit('cursor:move', { x: worldPos.x, y: worldPos.y });
    }

    if (!isDrawing) return;

    // View Panning
    if (activeTool === 'hand' || e.shiftKey) {
      if (boardType === 'presentation') return; // Disable panning in presentation mode
      adjustPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    // Pointer dragging and moving
    if (activeTool === 'pointer' && selectedObjectId) {
      const dx = worldPos.x - dragStart.x;
      const dy = worldPos.y - dragStart.y;

      const updated = objects.map((obj) => {
        if (obj.id === selectedObjectId) {
          const modObj = {
            ...obj,
            x: objectStartPos.x + dx,
            y: objectStartPos.y + dy
          };

          // Throttle socket modified broadcast during dragging for lower network overload
          if (socket) {
            socket.emit('canvas:object-modified', { object: modObj });
          }

          return modObj;
        }
        return obj;
      });

      onUpdateObjects(updated);
      return;
    }

    // Erasing continuously
    if (activeTool === 'eraser') {
      const hitObj = objects.find(obj => isPointInObject(worldPos.x, worldPos.y, obj));
      if (hitObj) {
        const updated = objects.filter(o => o.id !== hitObj.id);
        onUpdateObjects(updated, `Erased shape`);
        if (socket) socket.emit('canvas:object-removed', { id: hitObj.id });
      }
      return;
    }

    // Laser trail painting
    if (activeTool === 'laser') {
      setLaserTrail((prev) => [...prev, { x: worldPos.x, y: worldPos.y, age: 1.0 }]);
      return;
    }

    // Shape resizing during creation
    if (selectedObjectId) {
      const updated = objects.map((obj) => {
        if (obj.id === selectedObjectId) {
          const dx = worldPos.x - dragStart.x;
          const dy = worldPos.y - dragStart.y;

          if (obj.type === 'pencil') {
            const pts = obj.points ? [...obj.points, { x: worldPos.x, y: worldPos.y }] : [];
            return { ...obj, points: pts };
          } else if (obj.type === 'circle' || obj.type === 'triangle' || obj.type === 'rect') {
            // Support isometric square shape holding Shift key
            const finalWidth = e.shiftKey ? Math.max(dx, dy) : dx;
            const finalHeight = e.shiftKey ? Math.max(dx, dy) : dy;
            return {
              ...obj,
              width: finalWidth,
              height: finalHeight
            };
          } else {
            return {
              ...obj,
              width: dx,
              height: dy
            };
          }
        }
        return obj;
      });

      onUpdateObjects(updated);
    }
  };

  // Mouse Up Event
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDrawing(false);

    if (permission === 'viewer') return;

    if (selectedObjectId) {
      const finalObj = objects.find(o => o.id === selectedObjectId);
      if (finalObj && activeTool !== 'pointer') {
        // Broaden object addition to MongoDB and other Sockets
        if (socket) {
          socket.emit('canvas:object-added', { object: finalObj });
        }
      } else if (finalObj && activeTool === 'pointer') {
        // Update selection completion to database
        if (socket) {
          socket.emit('canvas:object-modified', { object: finalObj });
        }
      }
    }

    // If text tool click was pending, we don't clear selectedObjectId
    if (activeTool !== 'pointer' && activeTool !== 'text' && activeTool !== 'sticky') {
      setSelectedObjectId(null);
    }
  };

  // Laser effect fading ticks
  useEffect(() => {
    if (activeTool === 'laser') {
      laserIntervalRef.current = setInterval(() => {
        setLaserTrail((prev) => 
          prev
            .map((pt) => ({ ...pt, age: pt.age - 0.08 }))
            .filter((pt) => pt.age > 0)
        );
      }, 50);
    } else {
      setLaserTrail([]);
      if (laserIntervalRef.current) {
        clearInterval(laserIntervalRef.current);
      }
    }

    return () => {
      if (laserIntervalRef.current) clearInterval(laserIntervalRef.current);
    };
  }, [activeTool]);

  // Handle Zoom operations
  const handleZoom = (factor: number) => {
    if (boardType === 'presentation') return; // Disable zoom/pan in presentation mode
    setZoom((prev) => Math.max(0.1, Math.min(10, prev * factor)));
  };

  const handleZoomReset = () => {
    setZoom(1);
    adjustPan({ x: 0, y: 0 });
  };

  // Wheel zoom helper
  const handleWheel = (e: React.WheelEvent) => {
    if (boardType === 'presentation') return; // Disable zoom/pan in presentation mode
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      handleZoom(zoomFactor);
    } else {
      // Normal panning on trackpad swipe
      adjustPanFunc((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Close Text overlays and save
  const handleTextSubmit = () => {
    if (!textInput) return;

    const trimmed = textInput.value.trim();
    if (!trimmed) {
      setTextInput(null);
      return;
    }

    // Record action stack
    setUndoStack([...undoStack, objects]);
    setRedoStack([]);

    const newId = textInput.id || Math.random().toString(36).substring(2, 9);
    
    let newObject: DrawingObject;

    if (textInput.type === 'text') {
      newObject = {
        id: newId,
        type: 'text',
        x: textInput.x,
        y: textInput.y,
        text: trimmed,
        strokeColor,
        strokeWidth,
        opacity
      };
    } else {
      // Sticky Note
      newObject = {
        id: newId,
        type: 'sticky',
        x: textInput.x,
        y: textInput.y,
        width: 130,
        height: 130,
        text: trimmed,
        fillColor: textInput.stickyColor || '#fef08a',
        opacity: 0.95
      };
    }

    if (boardType === 'presentation') {
      if (textInput.id) {
        const oldObj = objects.find(o => o.id === textInput.id);
        newObject.slideIndex = oldObj ? oldObj.slideIndex : currentSlideIndex;
      } else {
        newObject.slideIndex = currentSlideIndex;
      }
    }

    const updated = textInput.id 
      ? objects.map(o => o.id === textInput.id ? newObject : o)
      : [...objects, newObject];

    onUpdateObjects(updated, `Added ${textInput.type}`);
    setSelectedObjectId(newId);

    if (socket) {
      if (textInput.id) {
        socket.emit('canvas:object-modified', { object: newObject });
      } else {
        socket.emit('canvas:object-added', { object: newObject });
      }
    }

    setTextInput(null);
  };

  // Image upload triggers
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Save history
      setUndoStack([...undoStack, objects]);
      setRedoStack([]);

      const newId = Math.random().toString(36).substring(2, 9);
      const newImageObject: DrawingObject = {
        id: newId,
        type: 'image',
        x: (dimensions.width / 2 - pan.x - 100) / zoom,
        y: (dimensions.height / 2 - pan.y - 100) / zoom,
        width: 200,
        height: 150,
        imageUrl: dataUrl,
        opacity: 1
      };

      if (boardType === 'presentation') {
        newImageObject.slideIndex = currentSlideIndex;
      }

      onUpdateObjects([...objects, newImageObject], `Uploaded Image`);
      setSelectedObjectId(newId);

      if (socket) {
        socket.emit('canvas:object-added', { object: newImageObject });
      }
    };
    reader.readAsDataURL(file);
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return; // Skip if user is actively writing
      }

      if (permission === 'viewer') return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (!isCtrl) {
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          handleToolChange('pointer');
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          handleToolChange('hand');
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          handleToolChange('pencil');
        } else if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          handleToolChange('laser');
        } else if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          handleToolChange('text');
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleToolChange('sticky');
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          handleToolChange('eraser');
        }
      }

      // Undo (Ctrl+Z)
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (undoStack.length > 0) {
          const previous = undoStack[undoStack.length - 1];
          const newUndo = undoStack.slice(0, -1);
          setUndoStack(newUndo);
          setRedoStack([objects, ...redoStack]);
          
          onUpdateObjects(previous, `Undo Action`);
          if (socket) {
            socket.emit('canvas:sync', { objects: previous, label: 'Undo' });
          }
        }
      }

      // Redo (Ctrl+Y)
      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (redoStack.length > 0) {
          const next = redoStack[0];
          const newRedo = redoStack.slice(1);
          setRedoStack(newRedo);
          setUndoStack([...undoStack, objects]);

          onUpdateObjects(next, `Redo Action`);
          if (socket) {
            socket.emit('canvas:sync', { objects: next, label: 'Redo' });
          }
        }
      }

      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          e.preventDefault();
          setUndoStack([...undoStack, objects]);
          setRedoStack([]);
          const updated = objects.filter(o => o.id !== selectedObjectId);
          onUpdateObjects(updated, `Deleted element`);
          if (socket) socket.emit('canvas:object-removed', { id: selectedObjectId });
          setSelectedObjectId(null);
        }
      }

      // Copy (Ctrl+C)
      if (isCtrl && e.key.toLowerCase() === 'c') {
        if (selectedObjectId) {
          e.preventDefault();
          const target = objects.find(o => o.id === selectedObjectId);
          if (target) {
            setClipboard(target);
          }
        }
      }

      // Paste (Ctrl+V)
      if (isCtrl && e.key.toLowerCase() === 'v') {
        if (clipboard) {
          e.preventDefault();
          const newId = Math.random().toString(36).substring(2, 9);
          const offset = 20;
          const pasted: DrawingObject = {
            ...clipboard,
            id: newId,
            x: clipboard.x + offset,
            y: clipboard.y + offset
          };
          onUpdateObjects([...objects, pasted], `Pasted copy`);
          setSelectedObjectId(newId);
          if (socket) socket.emit('canvas:object-added', { object: pasted });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [objects, undoStack, redoStack, selectedObjectId, clipboard, permission]);

  // Object Order mutations (Bring Forward / Send Backward)
  const handleReorder = (direction: 'forward' | 'backward') => {
    if (!selectedObjectId || permission === 'viewer') return;

    const index = objects.findIndex(o => o.id === selectedObjectId);
    if (index === -1) return;

    const newObjects = [...objects];
    
    if (direction === 'forward' && index < objects.length - 1) {
      // Swap with next
      const temp = newObjects[index];
      newObjects[index] = newObjects[index + 1];
      newObjects[index + 1] = temp;
    } else if (direction === 'backward' && index > 0) {
      // Swap with previous
      const temp = newObjects[index];
      newObjects[index] = newObjects[index - 1];
      newObjects[index - 1] = temp;
    }

    onUpdateObjects(newObjects, `Reordered elements`);
    if (socket) socket.emit('canvas:sync', { objects: newObjects, label: 'Reorder' });
  };

  // Duplicate Object
  const handleDuplicate = () => {
    if (!selectedObjectId || permission === 'viewer') return;
    const target = objects.find(o => o.id === selectedObjectId);
    if (target) {
      const newId = Math.random().toString(36).substring(2, 9);
      const duplicated: DrawingObject = {
        ...target,
        id: newId,
        x: target.x + 25,
        y: target.y + 25
      };
      onUpdateObjects([...objects, duplicated], `Duplicated shape`);
      setSelectedObjectId(newId);
      if (socket) socket.emit('canvas:object-added', { object: duplicated });
    }
  };

  // Delete Selected Object
  const handleDeleteSelected = () => {
    if (!selectedObjectId || permission === 'viewer') return;
    setUndoStack([...undoStack, objects]);
    setRedoStack([]);
    const updated = objects.filter(o => o.id !== selectedObjectId);
    onUpdateObjects(updated, `Deleted element`);
    if (socket) socket.emit('canvas:object-removed', { id: selectedObjectId });
    setSelectedObjectId(null);
  };

  // Manual Undo Trigger
  const handleUndo = () => {
    if (permission === 'viewer') return;
    if (undoStack.length > 0) {
      const previous = undoStack[undoStack.length - 1];
      const newUndo = undoStack.slice(0, -1);
      setUndoStack(newUndo);
      setRedoStack([objects, ...redoStack]);
      
      onUpdateObjects(previous, `Undo Action`);
      if (socket) {
        socket.emit('canvas:sync', { objects: previous, label: 'Undo' });
      }
    }
  };

  // Manual Redo Trigger
  const handleRedo = () => {
    if (permission === 'viewer') return;
    if (redoStack.length > 0) {
      const next = redoStack[0];
      const newRedo = redoStack.slice(1);
      setRedoStack(newRedo);
      setUndoStack([...undoStack, objects]);

      onUpdateObjects(next, `Redo Action`);
      if (socket) {
        socket.emit('canvas:sync', { objects: next, label: 'Redo' });
      }
    }
  };

  // Manual Clear Canvas Trigger
  const handleClearCanvas = () => {
    if (permission === 'viewer') return;
    if (window.confirm('Clear all drawings and shapes on this board? This action will synchronize for all collaborators.')) {
      setUndoStack([...undoStack, objects]);
      setRedoStack([]);
      onUpdateObjects([], `Cleared Canvas`);
      if (socket) {
        socket.emit('canvas:sync', { objects: [], label: 'Clear' });
      }
    }
  };

  // Active user cursor coordinates mapping (smooth CSS transition layout)
  const remoteCursors = useMemo(() => {
    return activeUsers.filter(user => user.socketId !== socket?.id && user.cursor);
  }, [activeUsers, socket]);

  return (
    <div className="relative w-full h-full flex flex-row select-none" ref={containerRef}>
      {/* LEFT TOOLBAR */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col p-2 gap-1.5">
        <button
          onClick={() => handleToolChange('pointer')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'pointer'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Pointer (V)"
        >
          <Pointer className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('hand')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'hand'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Hand Tool (Shift + Drag)"
        >
          <Hand className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('pencil')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'pencil'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Freehand Pencil (P)"
        >
          <Pencil className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('laser')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'laser'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Laser Pointer (L)"
        >
          <Sparkles className="w-5 h-5 text-red-500" />
        </button>

        <button
          onClick={() => handleToolChange('line')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'line'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Straight Line"
        >
          <Slash className="w-5 h-5 rotate-45" />
        </button>

        <button
          onClick={() => handleToolChange('arrow')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'arrow'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Arrow Tool"
        >
          <MoveRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('rect')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'rect'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Rectangle"
        >
          <Square className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('circle')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'circle'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Circle"
        >
          <CircleIcon className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('triangle')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'triangle'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Triangle"
        >
          <TriangleIcon className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('text')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'text'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Text Tool (T)"
        >
          <Type className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleToolChange('sticky')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'sticky'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Sticky Note (N)"
        >
          <FileText className="w-5 h-5" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          title="Upload Image"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageFileChange}
          accept="image/*"
          className="hidden"
        />

        <button
          onClick={() => handleToolChange('eraser')}
          className={`p-2.5 rounded-xl transition-all ${
            activeTool === 'eraser'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Eraser (E)"
        >
          <Eraser className="w-5 h-5" />
        </button>

        {selectedObjectId && (
          <div className="w-full border-t border-slate-200 dark:border-slate-800 my-1 pt-1.5 flex flex-col gap-1">
            <button
              onClick={() => handleReorder('forward')}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Bring Forward"
            >
              <ArrowUp className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => handleReorder('backward')}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Send Backward"
            >
              <ArrowDown className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={handleDuplicate}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Duplicate (Ctrl+D)"
            >
              <Copy className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={handleDeleteSelected}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              title="Delete Selected (Del)"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
      </div>

      {/* CANVAS CONTAINER */}
      <div 
        className={`flex-1 h-full overflow-hidden relative cursor-crosshair transition-colors duration-300 ${
          theme === 'black' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
        }`}
        onWheel={handleWheel}
      >
        <canvas
          id="drawing-board-canvas"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute inset-0 block touch-none"
        />

        {/* INPUT OVERLAYS (FOR ACTIVE TEXT EDITING) */}
        {textInput && (
          <div 
            className="absolute z-20"
            style={{
              left: textInput.x * zoom + pan.x,
              top: textInput.y * zoom + pan.y,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            {textInput.type === 'text' ? (
              <textarea
                ref={(el) => { if (el) { el.focus(); } }}
                autoFocus
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onBlur={handleTextSubmit}
                placeholder="Start typing..."
                className="bg-transparent border-b-2 border-blue-500 outline-none text-slate-900 dark:text-white font-sans text-base p-1 resize-none w-48 h-20"
                style={{ fontSize: `${strokeWidth >= 15 ? strokeWidth : Math.max(25, strokeWidth * 5 + 12)}px` }}
              />
            ) : (
              <div 
                className="p-3 shadow-xl border border-black/10 flex flex-col"
                style={{
                  backgroundColor: textInput.stickyColor || '#fef08a',
                  width: '130px',
                  height: '130px'
                }}
              >
                <textarea
                  ref={(el) => { if (el) { el.focus(); } }}
                  autoFocus
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onBlur={handleTextSubmit}
                  placeholder="Sticky text..."
                  className="bg-transparent border-none outline-none text-slate-800 font-sans text-xs w-full h-full resize-none placeholder-slate-500"
                />
              </div>
            )}
          </div>
        )}

        {/* REMOTE USER LIVE CURSORS */}
        {remoteCursors.map((user) => {
          if (!user.cursor) return null;
          // Coordinates derived dynamically from screen transform
          const screenX = user.cursor.x * zoom + pan.x;
          const screenY = user.cursor.y * zoom + pan.y;

          // Hide cursor if out of viewport bounding box
          if (screenX < 0 || screenX > dimensions.width || screenY < 0 || screenY > dimensions.height) {
            return null;
          }

          return (
            <div
              key={user.socketId}
              className="absolute pointer-events-none z-30 transition-all duration-75 flex flex-col items-start"
              style={{
                left: screenX,
                top: screenY
              }}
            >
              {/* Cursor Arrow */}
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="drop-shadow-md"
              >
                <path 
                  d="M5.5 3.5L18.5 11.5L12.5 13.5L15.5 19.5L13.5 20.5L10.5 14.5L5.5 19.5V3.5Z" 
                  fill={user.color} 
                  stroke="white" 
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              {/* Username label */}
              <span 
                className="mt-1 px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-md backdrop-blur-sm whitespace-nowrap"
                style={{ backgroundColor: user.color }}
              >
                {user.username}
              </span>
            </div>
          );
        })}

        {/* CONTROLS (ZOOMING / PANNING DETAILS) */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-xl rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400">
          <button 
            onClick={() => handleZoom(0.85)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => handleZoom(1.15)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
          <button 
            onClick={handleZoomReset}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          
          {/* Canvas Controls Section */}
          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
          <button 
            onClick={handleUndo}
            disabled={undoStack.length === 0 || permission === 'viewer'}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleRedo}
            disabled={redoStack.length === 0 || permission === 'viewer'}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
          <button 
            onClick={handleClearCanvas}
            disabled={permission === 'viewer'}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            title="Clear Canvas"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
          <span className="text-[10px] text-slate-400">Shift+Drag to Pan | Ctrl+Wheel to Zoom</span>
        </div>
      </div>

      {/* RIGHT CONTROLS PANEL (STYLING CONTROLS) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col p-4 w-52 gap-4">
        {/* Stroke / Outline Color */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Stroke Color</label>
          <div className="grid grid-cols-5 gap-1.5">
            {['#1f2937', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#f97316', '#14b8a6'].map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className="w-6 h-6 rounded-md border border-black/10 relative cursor-pointer"
                style={{ backgroundColor: color }}
              >
                {strokeColor === color && (
                  <div className="absolute inset-0 m-1 border-2 border-white dark:border-slate-900 rounded-sm" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fill Color */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Fill Color</label>
          <div className="grid grid-cols-5 gap-1.5">
            {['transparent', '#f3f4f6', '#fee2e2', '#dcfce7', '#dbeafe', '#fef9c3', '#f3e8ff', '#fce7f3', '#ffedd5', '#ccfbf1'].map((color) => (
              <button
                key={color}
                onClick={() => setFillColor(color)}
                className="w-6 h-6 rounded-md border border-black/10 relative cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
              >
                {color === 'transparent' && <div className="text-[10px] text-slate-400">Ø</div>}
                {fillColor === color && color !== 'transparent' && (
                  <div className="absolute inset-0 m-1 border-2 border-white rounded-sm" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Width / Font Size Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>{activeTool === 'text' ? 'Font Size' : 'Stroke Width'}</span>
            <span className="font-mono text-xs">{strokeWidth}px</span>
          </div>
          <input
            type="range"
            min={activeTool === 'text' ? '25' : '1'}
            max={activeTool === 'text' ? '72' : '12'}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Opacity Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Opacity</span>
            <span className="font-mono text-xs">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
