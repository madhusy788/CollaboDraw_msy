import { DrawingObject } from '../types';

/**
 * Draws an arrow from (x1,y1) to (x2,y2) with a triangular arrowhead
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeColor: string,
  strokeWidth: number,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Draw arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 15 + strokeWidth;

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = strokeColor;
  ctx.fill();

  ctx.restore();
}

/**
 * Checks if a point (px, py) hits a given shape, considering zoom and pan
 */
export function isPointInObject(
  px: number,
  py: number,
  obj: DrawingObject
): boolean {
  const { x, y, width = 0, height = 0, type } = obj;

  switch (type) {
    case 'rect':
    case 'sticky':
    case 'image': {
      const minX = Math.min(x, x + width);
      const maxX = Math.max(x, x + width);
      const minY = Math.min(y, y + height);
      const maxY = Math.max(y, y + height);
      return px >= minX && px <= maxX && py >= minY && py <= maxY;
    }

    case 'circle': {
      const radius = Math.abs(Math.max(width, height) / 2);
      const centerX = x + (width / 2);
      const centerY = y + (height / 2);
      const distance = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
      return distance <= radius;
    }

    case 'triangle': {
      const minX = Math.min(x, x + width);
      const maxX = Math.max(x, x + width);
      const minY = Math.min(y, y + height);
      const maxY = Math.max(y, y + height);
      return px >= minX && px <= maxX && py >= minY && py <= maxY;
    }

    case 'line':
    case 'arrow': {
      // Distance from point to line segment
      const x1 = x;
      const y1 = y;
      const x2 = x + width;
      const y2 = y + height;

      const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2) < 10;

      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));

      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);
      const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);

      return dist < 8; // Selection threshold of 8 pixels
    }

    case 'pencil': {
      if (!obj.points || obj.points.length === 0) return false;
      // Check if clicked point is near any line segments of the freehand drawing
      for (let i = 0; i < obj.points.length - 1; i++) {
        const pt1 = obj.points[i];
        const pt2 = obj.points[i + 1];

        const x1 = pt1.x;
        const y1 = pt1.y;
        const x2 = pt2.x;
        const y2 = pt2.y;

        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) {
          if (Math.sqrt((px - x1) ** 2 + (py - y1) ** 2) < 8) return true;
          continue;
        }

        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);

        if (dist < 8) return true;
      }
      return false;
    }

    case 'text': {
      // Calculate font size exactly as rendered on the canvas
      const fs = (obj.strokeWidth && obj.strokeWidth >= 15) ? obj.strokeWidth : Math.max(25, (obj.strokeWidth ?? 3) * 5 + 12);
      const textLines = (obj.text || '').split('\n');
      const textLinesCount = textLines.length;
      const longestLine = textLines.reduce((max, line) => line.length > max ? line.length : max, 0);
      const estWidth = Math.max(longestLine * (fs * 0.55), 120);
      const estHeight = Math.max(textLinesCount * (fs * 1.25), fs);
      return px >= x && px <= x + estWidth && py >= y && py <= y + estHeight;
    }

    default:
      return false;
  }
}

/**
 * Draws the visual grid patterns on the canvas background
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number,
  theme: 'white' | 'black'
) {
  // The canvas must be plain with no visible grid.
}
