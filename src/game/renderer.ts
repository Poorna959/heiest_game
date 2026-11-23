import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GameState,
  Gate,
  PLAYER_RADIUS,
  Plate,
  TILE_SIZE,
  Wall,
} from '../types';
import {
  getEchoFrameAtTick,
  getLevelGoldCases,
  getRemainingSeconds,
  getSweepingLaserSegment,
} from './engine';

const COLOR_FLOOR = '#0B0D12';
const COLOR_GRID = '#141923';
const COLOR_WALL_FILL = '#1A1F2B';
const COLOR_WALL_BORDER = '#334155';
const COLOR_KYOTO = '#E63946';
const COLOR_MASK = '#F8FAFC';
const COLOR_ECHO_RIM = '#38BDF8';
const COLOR_GOLD = '#FFD166';
const COLOR_SWITCH_ON = '#22C55E';
const COLOR_LASER = '#EF4444';

const floorCache = new Map<number, HTMLCanvasElement>();

function getCachedVaultFloor(chapter: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const existing = floorCache.get(chapter);
  if (existing) return existing;

  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_WIDTH;
  offscreen.height = CANVAS_HEIGHT;
  const octx = offscreen.getContext('2d');
  if (!octx) return null;

  octx.fillStyle = COLOR_FLOOR;
  octx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle architectural radial lighting gradient across vault floor
  const rad = octx.createRadialGradient(
    CANVAS_WIDTH * 0.5,
    CANVAS_HEIGHT * 0.5,
    40,
    CANVAS_WIDTH * 0.5,
    CANVAS_HEIGHT * 0.5,
    560
  );
  rad.addColorStop(0, 'rgba(30, 41, 59, 0.22)');
  rad.addColorStop(1, 'rgba(7, 9, 13, 0.35)');
  octx.fillStyle = rad;
  octx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 60px architectural floor grid
  octx.strokeStyle = COLOR_GRID;
  octx.lineWidth = 1;
  octx.beginPath();
  for (let x = TILE_SIZE; x < CANVAS_WIDTH; x += TILE_SIZE) {
    octx.moveTo(x + 0.5, 20);
    octx.lineTo(x + 0.5, CANVAS_HEIGHT - 20);
  }
  for (let y = TILE_SIZE; y < CANVAS_HEIGHT; y += TILE_SIZE) {
    octx.moveTo(20, y + 0.5);
    octx.lineTo(CANVAS_WIDTH - 20, y + 0.5);
  }
  octx.stroke();

  // Subtle floor grid intersection crosshairs
  octx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
  octx.lineWidth = 1;
  octx.beginPath();
  for (let x = TILE_SIZE; x < CANVAS_WIDTH; x += TILE_SIZE) {
    for (let y = TILE_SIZE; y < CANVAS_HEIGHT; y += TILE_SIZE) {
      octx.moveTo(x - 3, y + 0.5);
      octx.lineTo(x + 4, y + 0.5);
      octx.moveTo(x + 0.5, y - 3);
      octx.lineTo(x + 0.5, y + 4);
    }
  }
  octx.stroke();

  // Subtle floor sector stencil near spawn
  octx.fillStyle = 'rgba(148, 163, 184, 0.16)';
  octx.font = '600 11px "SFMono-Regular", Menlo, Consolas, monospace';
  octx.textAlign = 'left';
  octx.fillText(`ROYAL MINT · SECTOR 0${chapter}`, 34, 42);

  floorCache.set(chapter, offscreen);
  return offscreen;
}

function drawVaultFloor(ctx: CanvasRenderingContext2D, chapter: number): void {
  const cached = getCachedVaultFloor(chapter);
  if (cached) {
    ctx.drawImage(cached, 0, 0);
    return;
  }
  ctx.fillStyle = COLOR_FLOOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawSpawnZone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(230, 57, 70, 0.38)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(230, 57, 70, 0.08)';
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.45)';
  ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ENTRY', x, y + 36);
  ctx.restore();
}

function drawPlateToGateWires(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number
): void {
  for (const gate of state.level.gates) {
    const active = gate.linkedPlateIds.every((id) =>
      state.activePlateIds.has(id)
    );
    const points = gate.wireWaypoints;
    if (!points || points.length < 2) continue;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer recessed floor conduit channel
    ctx.strokeStyle = active
      ? 'rgba(34, 197, 94, 0.26)'
      : 'rgba(239, 68, 68, 0.16)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Crisp dark interior rail for high-contrast dashed power line
    ctx.strokeStyle = 'rgba(11, 13, 18, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Animated dashed power line flowing from Plate -> Gate
    ctx.strokeStyle = active ? COLOR_SWITCH_ON : '#F87171';
    ctx.lineWidth = active ? 2.6 : 2;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -(timeSec * (active ? 86 : 30));
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Compute total polyline length to animate traveling power pulse + directional chevrons
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const len = Math.hypot(
        points[i + 1].x - points[i].x,
        points[i + 1].y - points[i].y
      );
      segLens.push(len);
      totalLen += len;
    }

    const sampleAtDist = (targetDist: number) => {
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        const len = segLens[i];
        if (acc + len >= targetDist || i === segLens.length - 1) {
          const t = len > 0 ? Math.max(0, Math.min(1, (targetDist - acc) / len)) : 0;
          const a = points[i];
          const b = points[i + 1];
          return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            angle: Math.atan2(b.y - a.y, b.x - a.x),
          };
        }
        acc += len;
      }
      return { x: points[0].x, y: points[0].y, angle: 0 };
    };

    // Directional flow chevron at midpoint of conduit so link direction is unmistakable
    if (totalLen > 60) {
      const mid = sampleAtDist(totalLen * 0.52);
      ctx.save();
      ctx.translate(mid.x, mid.y);
      ctx.rotate(mid.angle);
      ctx.strokeStyle = active ? '#DCFCE7' : '#FCA5A5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(3, 0);
      ctx.lineTo(-4, 5);
      ctx.stroke();
      ctx.restore();
    }

    // Traveling bright energy pulse along active or standby wire
    if (totalLen > 20) {
      const speed = active ? 240 : 95;
      const pulseDist = (timeSec * speed) % totalLen;
      const pt = sampleAtDist(pulseDist);
      ctx.fillStyle = active ? '#DCFCE7' : '#FECACA';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, active ? 3.5 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Corner junction nodes
    for (let i = 1; i < points.length - 1; i++) {
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = active ? COLOR_SWITCH_ON : '#F87171';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Terminal connector node at Gate end
    const endPt = points[points.length - 1];
    ctx.fillStyle = active ? COLOR_SWITCH_ON : COLOR_LASER;
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawPlate(
  ctx: CanvasRenderingContext2D,
  plate: Plate,
  active: boolean,
  timeSec: number
): void {
  const cx = plate.x + plate.w * 0.5;
  const cy = plate.y + plate.h * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * (active ? 7 : 3));

  ctx.save();

  // Outer glow halo when active
  if (active) {
    ctx.fillStyle = `rgba(34, 197, 94, ${0.14 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.roundRect(plate.x - 6, plate.y - 6, plate.w + 12, plate.h + 12, 10);
    ctx.fill();
  }

  // Pad housing
  ctx.fillStyle = active ? 'rgba(34, 197, 94, 0.22)' : 'rgba(26, 31, 43, 0.9)';
  ctx.strokeStyle = active ? COLOR_SWITCH_ON : '#64748B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(plate.x, plate.y, plate.w, plate.h, 8);
  ctx.fill();
  ctx.stroke();

  // Biometric concentric arcs
  ctx.strokeStyle = active
    ? 'rgba(34, 197, 94, 0.85)'
    : `rgba(148, 163, 184, ${0.28 + pulse * 0.18})`;
  ctx.lineWidth = 1.5;
  for (const r of [12, 19]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();
  }

  // Label badge
  ctx.fillStyle = active ? '#DCFCE7' : '#CBD5E1';
  ctx.font = '700 13px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plate.label, cx, cy);

  // Status caption below plate
  ctx.fillStyle = active ? COLOR_SWITCH_ON : '#94A3B8';
  ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.fillText(active ? 'LOCKED ON' : `PLATE ${plate.label}`, cx, plate.y + plate.h + 11);

  ctx.restore();
}

function drawExit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number
): void {
  const exit = state.level.exit;
  const unlocked = !state.level.requiresGold || state.goldCollected;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 4.5);

  ctx.save();

  // Floor glow
  ctx.fillStyle = unlocked
    ? `rgba(255, 209, 102, ${0.12 + pulse * 0.1})`
    : 'rgba(100, 116, 139, 0.08)';
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);

  // Heavy gold vault doorframe
  ctx.strokeStyle = unlocked ? COLOR_GOLD : '#64748B';
  ctx.lineWidth = unlocked ? 2.5 : 2;
  ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);

  // Corner brackets
  const b = 10;
  ctx.strokeStyle = unlocked ? '#FEF08A' : '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(exit.x, exit.y + b);
  ctx.lineTo(exit.x, exit.y);
  ctx.lineTo(exit.x + b, exit.y);
  // Top-right
  ctx.moveTo(exit.x + exit.w - b, exit.y);
  ctx.lineTo(exit.x + exit.w, exit.y);
  ctx.lineTo(exit.x + exit.w, exit.y + b);
  // Bottom-left
  ctx.moveTo(exit.x, exit.y + exit.h - b);
  ctx.lineTo(exit.x, exit.y + exit.h);
  ctx.lineTo(exit.x + b, exit.y + exit.h);
  // Bottom-right
  ctx.moveTo(exit.x + exit.w - b, exit.y + exit.h);
  ctx.lineTo(exit.x + exit.w, exit.y + exit.h);
  ctx.lineTo(exit.x + exit.w, exit.y + exit.h - b);
  ctx.stroke();

  // Animated directional chevron arrows pointing into exit
  const cy = exit.y + exit.h * 0.5;
  const shift = unlocked ? ((timeSec * 24) % 14) - 7 : 0;
  ctx.strokeStyle = unlocked ? COLOR_GOLD : '#64748B';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = -1; i <= 1; i++) {
    const cx = exit.x + exit.w * 0.5 + i * 13 + shift * 0.45;
    ctx.globalAlpha = unlocked ? 0.5 + (i + 1) * 0.25 : 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 9);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx - 5, cy + 9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Label above doorway
  ctx.fillStyle = unlocked ? COLOR_GOLD : '#94A3B8';
  ctx.font = '700 10px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    unlocked ? (exit.label ?? 'EXIT') : 'NEED GOLD',
    exit.x + exit.w * 0.5,
    exit.y - 8
  );

  ctx.restore();
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall): void {
  ctx.save();
  if (wall.material === 'glass') {
    // Reinforced vault glass for Chapter 5 Decoy Chamber
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.78)';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);

    // Subtle specular diagonal glints
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (wall.w > wall.h) {
      for (let sx = wall.x + 18; sx < wall.x + wall.w - 14; sx += 38) {
        ctx.moveTo(sx, wall.y + 3);
        ctx.lineTo(sx + 10, wall.y + wall.h - 3);
      }
    } else {
      for (let sy = wall.y + 18; sy < wall.y + wall.h - 14; sy += 34) {
        ctx.moveTo(wall.x + 3, sy);
        ctx.lineTo(wall.x + wall.w - 3, sy + 10);
      }
    }
    ctx.stroke();
  } else {
    // Solid charcoal steel wall with slate bevel
    ctx.fillStyle = COLOR_WALL_FILL;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    // Subtle top/left highlight bevel
    ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.fillRect(wall.x + 2, wall.y + 2, Math.max(0, wall.w - 4), 3);

    ctx.strokeStyle = COLOR_WALL_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);

    // Architectural corner rivets on large pillars
    if (wall.w >= 48 && wall.h >= 48) {
      ctx.fillStyle = '#334155';
      const inset = 9;
      const pts = [
        [wall.x + inset, wall.y + inset],
        [wall.x + wall.w - inset, wall.y + inset],
        [wall.x + inset, wall.y + wall.h - inset],
        [wall.x + wall.w - inset, wall.y + wall.h - inset],
      ];
      for (const [rx, ry] of pts) {
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawGate(
  ctx: CanvasRenderingContext2D,
  gate: Gate,
  openProgress: number,
  timeSec: number
): void {
  const vertical = gate.h > gate.w;
  const closedness = 1 - openProgress;

  ctx.save();

  if (gate.isBlastDoor) {
    // Heavy mechanical Blast Door (Chapter 5)
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
    ctx.setLineDash([]);

    if (closedness > 0.02) {
      const halfH = (gate.h * 0.5) * closedness;
      // Top & bottom interlocking steel blast leaves
      ctx.fillStyle = '#272F40';
      ctx.strokeStyle = closedness > 0.5 ? COLOR_GOLD : COLOR_SWITCH_ON;
      ctx.lineWidth = 2;

      ctx.fillRect(gate.x, gate.y, gate.w, halfH);
      ctx.strokeRect(gate.x + 1, gate.y + 1, gate.w - 2, Math.max(2, halfH - 2));

      ctx.fillRect(gate.x, gate.y + gate.h - halfH, gate.w, halfH);
      ctx.strokeRect(
        gate.x + 1,
        gate.y + gate.h - halfH + 1,
        gate.w - 2,
        Math.max(2, halfH - 2)
      );

      // Center lock seam indicator
      if (closedness > 0.85) {
        ctx.fillStyle = COLOR_LASER;
        ctx.fillRect(gate.x + 4, gate.y + gate.h * 0.5 - 3, gate.w - 8, 6);
      }
    }

    // Label
    ctx.fillStyle = closedness < 0.35 ? COLOR_SWITCH_ON : COLOR_GOLD;
    ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      closedness < 0.35 ? 'OPEN' : 'BLAST DOOR',
      gate.x + gate.w * 0.5,
      gate.y - 8
    );
  } else {
    // Pulsing crimson Laser Gate
    if (openProgress >= 0.55) {
      // Faint open safety outline
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gate.x + 2, gate.y + 2, gate.w - 4, gate.h - 4);
      ctx.setLineDash([]);
    }

    if (closedness > 0.05) {
      const pulse = 0.78 + 0.22 * Math.sin(timeSec * 14);
      ctx.globalAlpha = closedness;

      // Outer neon glow
      ctx.fillStyle = `rgba(239, 68, 68, ${0.32 * pulse})`;
      ctx.fillRect(gate.x - 4, gate.y - 2, gate.w + 8, gate.h + 4);

      // Core laser bars
      ctx.fillStyle = COLOR_LASER;
      if (vertical) {
        const cx = gate.x + gate.w * 0.5;
        ctx.fillRect(cx - 4, gate.y, 8, gate.h);
        ctx.fillStyle = '#FECACA';
        ctx.fillRect(cx - 1.5, gate.y, 3, gate.h);
      } else {
        const cy = gate.y + gate.h * 0.5;
        ctx.fillRect(gate.x, cy - 4, gate.w, 8);
        ctx.fillStyle = '#FECACA';
        ctx.fillRect(gate.x, cy - 1.5, gate.w, 3);
      }
      ctx.globalAlpha = 1;
    }

    // Metal emitter housings on both ends
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = openProgress > 0.4 ? COLOR_SWITCH_ON : COLOR_LASER;
    ctx.lineWidth = 1.5;
    if (vertical) {
      ctx.fillRect(gate.x - 2, gate.y - 4, gate.w + 4, 8);
      ctx.strokeRect(gate.x - 2, gate.y - 4, gate.w + 4, 8);
      ctx.fillRect(gate.x - 2, gate.y + gate.h - 4, gate.w + 4, 8);
      ctx.strokeRect(gate.x - 2, gate.y + gate.h - 4, gate.w + 4, 8);
    } else {
      ctx.fillRect(gate.x - 4, gate.y - 2, 8, gate.h + 4);
      ctx.strokeRect(gate.x - 4, gate.y - 2, 8, gate.h + 4);
      ctx.fillRect(gate.x + gate.w - 4, gate.y - 2, 8, gate.h + 4);
      ctx.strokeRect(gate.x + gate.w - 4, gate.y - 2, 8, gate.h + 4);
    }

    // Matching linked-plate badge beside emitter on the open corridor side (never occluded by adjacent walls)
    const linkedSuffix = gate.linkedPlateIds
      .map((id) => id.split('-').pop()?.toUpperCase() ?? '')
      .filter(Boolean)
      .join('+');
    if (linkedSuffix) {
      const badgeW = linkedSuffix.length > 1 ? 28 : 20;
      const bx = vertical ? gate.x - (badgeW * 0.5 + 8) : gate.x + gate.w * 0.5;
      const by = vertical ? gate.y + 14 : gate.y - 15;
      ctx.fillStyle = 'rgba(11, 13, 18, 0.92)';
      ctx.strokeStyle = openProgress > 0.4 ? COLOR_SWITCH_ON : COLOR_LASER;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(bx - badgeW * 0.5, by - 8, badgeW, 16, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = openProgress > 0.4 ? '#DCFCE7' : '#FECACA';
      ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(linkedSuffix, bx, by);
    }
  }

  ctx.restore();
}

function drawSweepingLasers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number
): void {
  const pulse = 0.8 + 0.2 * Math.sin(timeSec * 16);

  for (const laser of state.level.sweepingLasers) {
    // Draw recessed patrol rails for moving lasers so players immediately read sweep range
    if (laser.periodSeconds > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(laser.startA.x, laser.startA.y);
      ctx.lineTo(laser.endA.x, laser.endA.y);
      ctx.moveTo(laser.startB.x, laser.startB.y);
      ctx.lineTo(laser.endB.x, laser.endB.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const seg = getSweepingLaserSegment(laser, state.tick);

    ctx.save();
    // Wide outer aura
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.28 * pulse})`;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.stroke();

    // Crimson beam
    ctx.strokeStyle = COLOR_LASER;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.stroke();

    // White-hot inner core
    ctx.strokeStyle = '#FEE2E2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.stroke();

    // Emitter nodes
    for (const [ex, ey] of [
      [seg.ax, seg.ay],
      [seg.bx, seg.by],
    ]) {
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = COLOR_LASER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawGoldCase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeSec: number,
  label = 'BULLION'
): void {
  const bob = Math.sin(timeSec * 4.5) * 2.5;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5);

  ctx.save();
  ctx.translate(x, y + bob);

  // Pulsing halo
  ctx.fillStyle = `rgba(255, 209, 102, ${0.14 + pulse * 0.14})`;
  ctx.beginPath();
  ctx.arc(0, 0, 26 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();

  // Briefcase handle
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-6, -15, 12, 6);

  // Briefcase body
  ctx.fillStyle = COLOR_GOLD;
  ctx.strokeStyle = '#FEF3C7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-15, -10, 30, 20, 4);
  ctx.fill();
  ctx.stroke();

  // Latch details
  ctx.fillStyle = '#92400E';
  ctx.fillRect(-10, -2, 20, 3);
  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(-8, -3, 4, 5);
  ctx.fillRect(4, -3, 4, 5);

  // Label below
  ctx.fillStyle = COLOR_GOLD;
  ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, 24 - bob);

  ctx.restore();
}

function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  hasGold: boolean,
  isEcho: boolean,
  badgeLabel: string | null,
  squashX = 1,
  squashY = 1,
  walkPhase = 0
): void {
  ctx.save();
  ctx.translate(x, y);

  if (isEcho) {
    ctx.globalAlpha = 0.52;
  }

  // Ground shadow
  ctx.fillStyle = isEcho ? 'rgba(56, 189, 248, 0.22)' : 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 4, PLAYER_RADIUS * 1.05, PLAYER_RADIUS * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle directional lantern glow for live Kyoto (zero gradient allocation per frame)
  if (!isEcho) {
    ctx.save();
    ctx.rotate(facing);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.13)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 44, -0.58, 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(248, 250, 252, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 28, -0.4, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Subtle walk bob scale
  const bob = Math.sin(walkPhase) * 0.05;
  ctx.save();
  ctx.rotate(facing);
  ctx.scale(squashX + bob, squashY - bob);

  // Crimson heist jumpsuit shoulders
  ctx.fillStyle = isEcho ? '#E63946' : COLOR_KYOTO;
  ctx.strokeStyle = isEcho ? COLOR_ECHO_RIM : '#991B1B';
  ctx.lineWidth = isEcho ? 2.5 : 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, PLAYER_RADIUS - 1, PLAYER_RADIUS + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Stark white heist mask face pointing forward
  ctx.fillStyle = COLOR_MASK;
  ctx.beginPath();
  ctx.ellipse(5, 0, 5.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iconic minimal mask eye slits
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(6, -3.5, 2.2, 2);
  ctx.fillRect(6, 1.5, 2.2, 2);

  // Miniature gold briefcase carried at Kyoto's side when collected
  if (hasGold) {
    ctx.fillStyle = COLOR_GOLD;
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-3, 10, 10, 7);
    ctx.strokeRect(-3, 10, 10, 7);
  }

  ctx.restore();

  // Holographic cyan outer ring & number badge for echoes
  if (isEcho) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = COLOR_ECHO_RIM;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (badgeLabel) {
      const badgeY = y < 50 ? PLAYER_RADIUS + 14 : -PLAYER_RADIUS - 13;
      ctx.fillStyle = 'rgba(11, 13, 18, 0.88)';
      ctx.strokeStyle = COLOR_ECHO_RIM;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-13, badgeY - 7, 26, 14, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E0F2FE';
      ctx.font = '700 10px "SFMono-Regular", Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, 0, badgeY);
    }
  }

  ctx.restore();
}

function drawEchoes(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let i = 0; i < state.echoes.length; i++) {
    const echo = state.echoes[i];
    if (echo.frames.length === 0) continue;

    // Draw faint cyan trailing ribbon behind echo
    const headIdx = Math.min(state.tick, echo.frames.length - 1);
    const tailStart = Math.max(0, headIdx - 22);
    if (headIdx > tailStart) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(echo.frames[tailStart].x, echo.frames[tailStart].y);
      for (let f = tailStart + 1; f <= headIdx; f++) {
        ctx.lineTo(echo.frames[f].x, echo.frames[f].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const pose = getEchoFrameAtTick(echo, state.tick);
    const isAnchored = state.tick >= echo.frames.length - 1;

    // Anchored lock ring when echo finished early and is holding its final pose
    if (isAnchored) {
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pose.x, pose.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterSprite(
      ctx,
      pose.x,
      pose.y,
      pose.facing,
      pose.hasGold,
      true,
      `#${i + 1}`
    );
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSirenVignette(
  ctx: CanvasRenderingContext2D,
  remainingSec: number,
  timeSec: number
): void {
  if (remainingSec >= 3.0) return;

  const urgency = Math.min(1, (3.0 - remainingSec) / 3.0);
  // Crisp double-strobe police lightbar cadence alternating red (left/top) & blue (right/bottom)
  const phase = (timeSec * 2.4) % 1;
  const redPulse =
    phase < 0.45
      ? Math.pow(Math.sin((phase / 0.45) * Math.PI * 2), 2)
      : 0.12;
  const bluePulse =
    phase >= 0.5 && phase < 0.95
      ? Math.pow(Math.sin(((phase - 0.5) / 0.45) * Math.PI * 2), 2)
      : 0.12;

  const leftAlpha = (0.14 + 0.22 * urgency) * (0.35 + 0.65 * redPulse);
  const rightAlpha = (0.14 + 0.22 * urgency) * (0.35 + 0.65 * bluePulse);

  ctx.save();
  // Red SWAT siren vignette — left & top-left edge
  const leftGrad = ctx.createLinearGradient(0, 0, 150, 0);
  leftGrad.addColorStop(0, `rgba(239, 68, 68, ${leftAlpha})`);
  leftGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, 150, CANVAS_HEIGHT);

  const topGrad = ctx.createLinearGradient(0, 0, 0, 68);
  topGrad.addColorStop(0, `rgba(239, 68, 68, ${leftAlpha * 0.72})`);
  topGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH * 0.6, 68);

  // Blue SWAT siren vignette — right & bottom-right edge
  const rightGrad = ctx.createLinearGradient(
    CANVAS_WIDTH - 150,
    0,
    CANVAS_WIDTH,
    0
  );
  rightGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
  rightGrad.addColorStop(1, `rgba(59, 130, 246, ${rightAlpha})`);
  ctx.fillStyle = rightGrad;
  ctx.fillRect(CANVAS_WIDTH - 150, 0, 150, CANVAS_HEIGHT);

  const bottomGrad = ctx.createLinearGradient(
    0,
    CANVAS_HEIGHT - 68,
    0,
    CANVAS_HEIGHT
  );
  bottomGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
  bottomGrad.addColorStop(1, `rgba(59, 130, 246, ${rightAlpha * 0.72})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(CANVAS_WIDTH * 0.4, CANVAS_HEIGHT - 68, CANVAS_WIDTH * 0.6, 68);

  // Crisp 3px split perimeter alert frame
  ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(0.85, leftAlpha * 2.2)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.5, 2);
  ctx.lineTo(2, 2);
  ctx.lineTo(2, CANVAS_HEIGHT - 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(59, 130, 246, ${Math.min(0.85, rightAlpha * 2.2)})`;
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT - 2);
  ctx.lineTo(CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
  ctx.lineTo(CANVAS_WIDTH - 2, 2);
  ctx.stroke();

  ctx.restore();
}

function drawRewindFlash(ctx: CanvasRenderingContext2D, timer: number): void {
  if (timer <= 0) return;
  const alpha = Math.min(1, timer / 0.25);
  const progress = 1 - alpha;

  ctx.save();
  // Cool VHS tape tint wash
  ctx.fillStyle = `rgba(56, 189, 248, ${0.18 * alpha})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Chromatic aberration horizontal tear strips (cyan + crimson offset)
  const tearOffsets = [0.18, 0.42, 0.68, 0.84];
  for (let i = 0; i < tearOffsets.length; i++) {
    const ty = ((tearOffsets[i] + progress * 0.55) % 1) * CANVAS_HEIGHT;
    const h = i % 2 === 0 ? 10 : 5;
    ctx.fillStyle = `rgba(56, 189, 248, ${0.34 * alpha})`;
    ctx.fillRect(10, ty - 2, CANVAS_WIDTH - 10, h);
    ctx.fillStyle = `rgba(230, 57, 70, ${0.32 * alpha})`;
    ctx.fillRect(0, ty + 2, CANVAS_WIDTH - 10, h);
  }

  // Dense CRT VHS scanlines
  ctx.fillStyle = `rgba(248, 250, 252, ${0.24 * alpha})`;
  for (let y = 0; y < CANVAS_HEIGHT; y += 8) {
    ctx.fillRect(0, y, CANVAS_WIDTH, y % 24 === 0 ? 2 : 1);
  }

  // Sweeping white static tracking band
  const barY = (1 - progress) * CANVAS_HEIGHT;
  ctx.fillStyle = `rgba(248, 250, 252, ${0.38 * alpha})`;
  ctx.fillRect(0, barY, CANVAS_WIDTH, 14);

  // Diegetic VCR REWIND OSD badge
  ctx.fillStyle = `rgba(11, 13, 18, ${0.82 * alpha})`;
  ctx.fillRect(28, 28, 132, 28);
  ctx.strokeStyle = `rgba(56, 189, 248, ${0.9 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, 132, 28);
  ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
  ctx.font = '700 13px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('◄◄ REWIND', 42, 42);

  ctx.restore();
}

function drawChapter5FreezeFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number
): void {
  // Spotlight coordinates: focus on trapped echo inside Decoy Chamber (or chamber center)
  let spotX = 450;
  let spotY = 270;
  if (state.echoes.length > 0) {
    const lastEcho = state.echoes[state.echoes.length - 1];
    const pose = getEchoFrameAtTick(lastEcho, state.tick);
    spotX = pose.x;
    spotY = pose.y;
  }

  ctx.save();

  // Dramatic noir radial shadow spotlighting the trapped echo
  const maskGrad = ctx.createRadialGradient(spotX, spotY, 38, spotX, spotY, 340);
  maskGrad.addColorStop(0, 'rgba(7, 9, 13, 0)');
  maskGrad.addColorStop(0.45, 'rgba(7, 9, 13, 0.58)');
  maskGrad.addColorStop(1, 'rgba(7, 9, 13, 0.88)');
  ctx.fillStyle = maskGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Alternating red/blue SWAT searchlight rings on the decoy
  const flash = Math.sin(timeSec * 18) > 0;
  ctx.strokeStyle = flash
    ? 'rgba(239, 68, 68, 0.85)'
    : 'rgba(59, 130, 246, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(spotX, spotY, 54, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle targeting brackets around the trapped decoy
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 2;
  const r = 34;
  ctx.beginPath();
  ctx.moveTo(spotX - r, spotY - r + 10);
  ctx.lineTo(spotX - r, spotY - r);
  ctx.lineTo(spotX - r + 10, spotY - r);

  ctx.moveTo(spotX + r - 10, spotY - r);
  ctx.lineTo(spotX + r, spotY - r);
  ctx.lineTo(spotX + r, spotY - r + 10);

  ctx.moveTo(spotX - r, spotY + r - 10);
  ctx.lineTo(spotX - r, spotY + r);
  ctx.lineTo(spotX - r + 10, spotY + r);

  ctx.moveTo(spotX + r - 10, spotY + r);
  ctx.lineTo(spotX + r, spotY + r);
  ctx.lineTo(spotX + r, spotY + r - 10);
  ctx.stroke();

  // Cinema letterbox bars
  ctx.fillStyle = '#050609';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 44);
  ctx.fillRect(0, CANVAS_HEIGHT - 44, CANVAS_WIDTH, 44);

  // Crisp caption inside bottom letterbox bar
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 13px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'BLAST DOOR SEALED  ·  SWAT LOCKED ON DECOY',
    CANVAS_WIDTH * 0.5,
    CANVAS_HEIGHT - 22
  );

  ctx.restore();
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number
): void {
  ctx.save();

  // Apply decaying trauma camera shake
  if (state.shakeTimer > 0) {
    const t = Math.min(1, state.shakeTimer / 0.35);
    const mag = state.shakeIntensity * t * t;
    const ox = (Math.random() * 2 - 1) * mag;
    const oy = (Math.random() * 2 - 1) * mag;
    ctx.translate(ox, oy);
  }

  drawVaultFloor(ctx, state.level.chapter);
  drawSpawnZone(ctx, state.level.spawn.x, state.level.spawn.y);
  drawPlateToGateWires(ctx, state, timeSec);
  drawExit(ctx, state, timeSec);

  for (const plate of state.level.plates) {
    drawPlate(ctx, plate, state.activePlateIds.has(plate.id), timeSec);
  }

  const goldCases = getLevelGoldCases(state.level);
  for (let i = 0; i < goldCases.length; i++) {
    if (state.collectedGoldIds?.has(i)) continue;
    const gc = goldCases[i];
    drawGoldCase(ctx, gc.x, gc.y, timeSec, gc.label ?? 'BULLION');
  }

  for (const gate of state.level.gates) {
    drawGate(ctx, gate, state.gateOpenProgress[gate.id] ?? 0, timeSec);
  }

  drawSweepingLasers(ctx, state, timeSec);

  for (const wall of state.level.walls) {
    drawWall(ctx, wall);
  }

  // Draw past holographic echoes underneath live Kyoto
  drawEchoes(ctx, state);

  // Gaze-routed chronometer ring around Kyoto under 3.00s
  const remainingSec = getRemainingSeconds(state.tick);
  if (remainingSec < 3.0 && !state.freezeFrameActive) {
    ctx.save();
    ctx.strokeStyle = COLOR_LASER;
    ctx.lineWidth = 2.5;
    const frac = remainingSec / 3.0;
    ctx.beginPath();
    ctx.arc(
      state.player.x,
      state.player.y,
      PLAYER_RADIUS + 8,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + Math.PI * 2 * frac
    );
    ctx.stroke();
    ctx.restore();
  }

  // Draw Kyoto (live player)
  drawCharacterSprite(
    ctx,
    state.player.x,
    state.player.y,
    state.player.facing,
    state.player.hasGold,
    false,
    null,
    state.player.squashX,
    state.player.squashY,
    state.player.walkPhase
  );

  drawParticles(ctx, state);

  // Screen-space feedback overlays
  if (state.hitFlashTimer > 0) {
    const a = Math.min(1, state.hitFlashTimer / 0.3);
    ctx.fillStyle = `rgba(239, 68, 68, ${a * 0.34})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Electric zap shockwave ring at the laser impact location
    if (state.lastLaserHitPos) {
      const r = 12 + (1 - a) * 44;
      ctx.save();
      ctx.strokeStyle = `rgba(254, 202, 202, ${a * 0.9})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(state.lastLaserHitPos.x, state.lastLaserHitPos.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Crisp status pill telling player echoes were preserved
    ctx.save();
    ctx.fillStyle = `rgba(11, 13, 18, ${0.85 * a})`;
    ctx.fillRect(CANVAS_WIDTH * 0.5 - 145, 28, 290, 26);
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.95 * a})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CANVAS_WIDTH * 0.5 - 145, 28, 290, 26);
    ctx.fillStyle = `rgba(254, 226, 226, ${a})`;
    ctx.font = '700 11px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      state.echoes.length > 0
        ? 'LASER CONTACT · ECHOES PRESERVED'
        : 'LASER CONTACT · LOOP RESET',
      CANVAS_WIDTH * 0.5,
      41
    );
    ctx.restore();
  }

  // Subtle top hairline 10-second loop progress bar directly integrated into canvas frame
  if (!state.freezeFrameActive) {
    const frac = remainingSec / 10;
    ctx.fillStyle = remainingSec < 3.0 ? COLOR_LASER : 'rgba(230, 57, 70, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH * frac, 3);
  }

  drawRewindFlash(ctx, state.rewindFlashTimer);
  drawSirenVignette(ctx, remainingSec, timeSec);

  if (state.freezeFrameActive) {
    drawChapter5FreezeFrame(ctx, state, timeSec);
  }

  ctx.restore();
}

/**
 * Live animated Royal Mint architectural blueprint backdrop for the Title Screen.
 * Keeps left 40% calm negative space for the bespoke SVG title lockup & CTA,
 * while staging an atmospheric heist floorplan + orbiting echo on the right.
 */
export function renderTitleBlueprint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number
): void {
  ctx.fillStyle = '#07090D';
  ctx.fillRect(0, 0, width, height);

  // Subtle blueprint grid
  const grid = 48;
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x += grid) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y < height; y += grid) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();

  // Right-side focal vault schematic (leaving left 42% calm dark negative space)
  const cx = width * 0.72;
  const cy = height * 0.5;
  const scale = Math.min(width / 1280, height / 720);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Outer blueprint chamber rings
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-220, -170, 440, 340);

  // Architectural inner vault chamber (echoing Chapter 5's glass Decoy Chamber)
  ctx.fillStyle = 'rgba(26, 31, 43, 0.65)';
  ctx.fillRect(-105, -85, 210, 170);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-105, -85, 210, 170);

  // Central biometric plate pulse
  const p = 0.5 + 0.5 * Math.sin(timeSec * 3.2);
  ctx.fillStyle = `rgba(34, 197, 94, ${0.14 + p * 0.12})`;
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-26, -26, 52, 52, 8);
  ctx.fill();
  ctx.stroke();

  // Dashed conduit wire to right blast door
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -timeSec * 42;
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(220, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sweeping red laser beam across the schematic
  const sweepY = Math.sin(timeSec * 1.4) * 135;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(125, sweepY);
  ctx.lineTo(212, sweepY);
  ctx.stroke();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(125, sweepY);
  ctx.lineTo(212, sweepY);
  ctx.stroke();

  // Orbiting live Kyoto + trailing cyan holographic Echo #1
  const angle = timeSec * 0.75;
  const rx = 165;
  const ry = 128;

  // Echo trail arc
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = angle - 1.15 - i * 0.04;
    const tx = Math.cos(a) * rx;
    const ty = Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.stroke();

  // Echo ghost
  const echoAngle = angle - 1.15;
  drawCharacterSprite(
    ctx,
    Math.cos(echoAngle) * rx,
    Math.sin(echoAngle) * ry,
    echoAngle + Math.PI * 0.5,
    false,
    true,
    '#1'
  );

  // Live Kyoto runner
  drawCharacterSprite(
    ctx,
    Math.cos(angle) * rx,
    Math.sin(angle) * ry,
    angle + Math.PI * 0.5,
    true,
    false,
    null
  );

  // 10-second radial chronometer arc around vault schematic
  const loopFrac = 1 - ((timeSec % 10) / 10);
  ctx.strokeStyle = loopFrac < 0.3 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(230, 57, 70, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 210, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * loopFrac);
  ctx.stroke();

  ctx.restore();

  // Calm left-side reading scrim so title lockup & CTA always have maximum contrast
  const leftScrim = ctx.createLinearGradient(0, 0, width * 0.58, 0);
  leftScrim.addColorStop(0, 'rgba(7, 9, 13, 0.96)');
  leftScrim.addColorStop(0.68, 'rgba(7, 9, 13, 0.84)');
  leftScrim.addColorStop(1, 'rgba(7, 9, 13, 0)');
  ctx.fillStyle = leftScrim;
  ctx.fillRect(0, 0, width * 0.62, height);
}
