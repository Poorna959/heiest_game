import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  Gate,
  PLAYER_RADIUS,
  Plate,
  RIVAL_DASH_COOLDOWN_SECONDS,
  RIVAL_GUARD_THREAT_RADIUS,
  RIVAL_HACKER_JAM_RADIUS,
  RIVAL_TOTAL_LOOPS,
  RivalArenaId,
  RivalEcho,
  RivalGameState,
  RivalGoldItem,
  RivalRole,
  RivalStashDef,
  RivalTeam,
  TILE_SIZE,
  Wall,
} from '../types';
import { getRemainingSeconds } from './engine';
import {
  getActiveRivalLaserSegments,
  getActiveRivalLasers,
  getRivalEchoFrameIndex,
  isStashShieldedByHacker,
} from './rivalEngine';
import { RIVAL_ARENAS } from './rivalMaps';

const COLOR_FLOOR = '#0B0D12';
const COLOR_GRID = '#141923';
const COLOR_WALL_FILL = '#1A1F2B';
const COLOR_WALL_BORDER = '#334155';
const COLOR_P1 = '#E63946'; // Kyoto Crimson
const COLOR_P2 = '#38BDF8'; // Oslo Cobalt
const COLOR_GOLD = '#FFD166';
const COLOR_SWITCH_ON = '#22C55E';
const COLOR_LASER = '#EF4444';

const rivalFloorCache = new Map<RivalArenaId, HTMLCanvasElement>();

function getRivalFloorCache(arenaId: RivalArenaId): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cached = rivalFloorCache.get(arenaId);
  if (cached) return cached;

  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;
  const off = document.createElement('canvas');
  off.width = CANVAS_WIDTH;
  off.height = CANVAS_HEIGHT;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = COLOR_FLOOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle symmetric center spotlight
  const grad = ctx.createRadialGradient(480, 270, 30, 480, 270, 520);
  grad.addColorStop(0, 'rgba(30, 41, 59, 0.24)');
  grad.addColorStop(1, 'rgba(7, 9, 13, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 60px architectural grid
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = TILE_SIZE; x < CANVAS_WIDTH; x += TILE_SIZE) {
    ctx.moveTo(x + 0.5, 20);
    ctx.lineTo(x + 0.5, CANVAS_HEIGHT - 20);
  }
  for (let y = TILE_SIZE; y < CANVAS_HEIGHT; y += TILE_SIZE) {
    ctx.moveTo(20, y + 0.5);
    ctx.lineTo(CANVAS_WIDTH - 20, y + 0.5);
  }
  ctx.stroke();

  // Arena-specific center vault trim highlight
  ctx.fillStyle = 'rgba(255, 209, 102, 0.04)';
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.14)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  if (arenaId === 'TWIN_VAULTS') {
    ctx.fillRect(394, 24, 172, 146);
    ctx.strokeRect(400, 30, 160, 134);
    ctx.fillRect(394, 370, 172, 146);
    ctx.strokeRect(400, 376, 160, 134);
  } else {
    ctx.fillRect(384, 144, 192, 252);
    ctx.strokeRect(390, 150, 180, 240);
  }
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255, 209, 102, 0.24)';
  ctx.font = '700 10px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(arena.name, 480, arenaId === 'TWIN_VAULTS' ? 273 : 166);

  rivalFloorCache.set(arenaId, off);
  return off;
}

function drawStash(
  ctx: CanvasRenderingContext2D,
  stash: RivalStashDef,
  score: number,
  shielded: boolean,
  timeSec: number
): void {
  const isP1 = stash.team === 'P1';
  const accent = isP1 ? COLOR_P1 : COLOR_P2;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.5);

  ctx.save();
  ctx.fillStyle = isP1
    ? `rgba(230, 57, 70, ${0.1 + pulse * 0.05})`
    : `rgba(56, 189, 248, ${0.1 + pulse * 0.05})`;
  ctx.fillRect(stash.x, stash.y, stash.w, stash.h);

  ctx.strokeStyle = shielded ? COLOR_SWITCH_ON : accent;
  ctx.lineWidth = shielded ? 2.8 : 2;
  ctx.strokeRect(stash.x, stash.y, stash.w, stash.h);

  // Label
  ctx.fillStyle = shielded ? COLOR_SWITCH_ON : accent;
  ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    shielded
      ? 'ECM SHIELDED'
      : isP1
      ? 'KYOTO STASH'
      : 'OSLO STASH',
    stash.x + stash.w * 0.5,
    stash.y - 8
  );

  // Draw miniature banked bullion stack inside stash
  const barsToShow = Math.min(score, 12);
  const cols = 2;
  for (let i = 0; i < barsToShow; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = stash.x + 14 + col * 24;
    const by = stash.y + stash.h - 22 - row * 16;
    ctx.fillStyle = COLOR_GOLD;
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, 20, 11);
    ctx.strokeRect(bx, by, 20, 11);
  }

  // Score numeral stamp in stash
  ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
  ctx.font = '800 13px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.fillText(`${score} GOLD`, stash.x + stash.w * 0.5, stash.y + stash.h + 14);

  ctx.restore();
}

function drawRivalWires(
  ctx: CanvasRenderingContext2D,
  state: RivalGameState,
  timeSec: number
): void {
  for (const gate of state.gates) {
    const active = gate.linkedPlateIds.every((id) =>
      state.activePlateIds.has(id)
    );
    const pts = gate.wireWaypoints;
    if (!pts || pts.length < 2) continue;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = active
      ? 'rgba(34, 197, 94, 0.25)'
      : 'rgba(239, 68, 68, 0.16)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    ctx.strokeStyle = active ? COLOR_SWITCH_ON : '#F87171';
    ctx.lineWidth = active ? 2.5 : 2;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -(timeSec * (active ? 84 : 28));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 1; i < pts.length - 1; i++) {
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = active ? COLOR_SWITCH_ON : '#F87171';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRivalPlate(
  ctx: CanvasRenderingContext2D,
  plate: Plate,
  active: boolean,
  timeSec: number
): void {
  const cx = plate.x + plate.w * 0.5;
  const cy = plate.y + plate.h * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * (active ? 7 : 3));

  ctx.save();
  if (active) {
    ctx.fillStyle = `rgba(34, 197, 94, ${0.15 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.roundRect(plate.x - 5, plate.y - 5, plate.w + 10, plate.h + 10, 9);
    ctx.fill();
  }

  ctx.fillStyle = active ? 'rgba(34, 197, 94, 0.24)' : 'rgba(26, 31, 43, 0.9)';
  ctx.strokeStyle = active ? COLOR_SWITCH_ON : '#64748B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(plate.x, plate.y, plate.w, plate.h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = active ? '#DCFCE7' : '#CBD5E1';
  ctx.font = '700 13px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plate.label, cx, cy);

  ctx.fillStyle = active ? COLOR_SWITCH_ON : '#94A3B8';
  ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.fillText(
    active ? 'GATE OPEN' : `HACK ${plate.label}`,
    cx,
    plate.y + plate.h + 11
  );
  ctx.restore();
}

function drawRivalGate(
  ctx: CanvasRenderingContext2D,
  gate: Gate,
  openProgress: number,
  timeSec: number
): void {
  const closedness = 1 - openProgress;
  const vertical = gate.h > gate.w;
  ctx.save();

  if (openProgress >= 0.4) {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gate.x + 2, gate.y + 2, gate.w - 4, gate.h - 4);
    ctx.setLineDash([]);
  }

  if (closedness > 0.05) {
    const pulse = 0.8 + 0.2 * Math.sin(timeSec * 14);
    ctx.globalAlpha = closedness;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * pulse})`;
    ctx.fillRect(gate.x - 4, gate.y - 2, gate.w + 8, gate.h + 4);
    if (vertical) {
      const cx = gate.x + gate.w * 0.5;
      ctx.fillStyle = COLOR_LASER;
      ctx.fillRect(cx - 4, gate.y, 8, gate.h);
      ctx.fillStyle = '#FECACA';
      ctx.fillRect(cx - 1.5, gate.y, 3, gate.h);
    } else {
      const cy = gate.y + gate.h * 0.5;
      ctx.fillStyle = COLOR_LASER;
      ctx.fillRect(gate.x, cy - 4, gate.w, 8);
      ctx.fillStyle = '#FECACA';
      ctx.fillRect(gate.x, cy - 1.5, gate.w, 3);
    }
    ctx.globalAlpha = 1;
  }

  // Emitter caps
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

  // Linked badge A or B on outer corridor side
  const isLeft = gate.id === 'gate-left';
  const badge = isLeft ? 'A' : 'B';
  const bx = vertical
    ? isLeft
      ? gate.x - 16
      : gate.x + gate.w + 16
    : gate.x + gate.w * 0.5;
  const by = vertical
    ? gate.y + 14
    : isLeft
    ? gate.y + gate.h + 15
    : gate.y - 15;
  ctx.fillStyle = 'rgba(11, 13, 18, 0.92)';
  ctx.strokeStyle = openProgress > 0.4 ? COLOR_SWITCH_ON : COLOR_LASER;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.roundRect(bx - 9, by - 8, 18, 16, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = openProgress > 0.4 ? '#DCFCE7' : '#FECACA';
  ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, bx, by);

  ctx.restore();
}

function drawRivalWall(ctx: CanvasRenderingContext2D, wall: Wall): void {
  ctx.save();
  ctx.fillStyle = COLOR_WALL_FILL;
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.fillRect(wall.x + 2, wall.y + 2, Math.max(0, wall.w - 4), 3);
  ctx.strokeStyle = COLOR_WALL_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
  ctx.restore();
}

function drawGoldItem(
  ctx: CanvasRenderingContext2D,
  item: RivalGoldItem,
  timeSec: number
): void {
  if (item.location !== 'VAULT' && item.location !== 'FLOOR') return;
  const bob = Math.sin(timeSec * 4.5 + item.x * 0.03) * 2;

  ctx.save();
  ctx.translate(item.x, item.y + bob);

  if (item.isCrown) {
    // 3-Point Golden Crown (Loop 6)
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6);
    ctx.fillStyle = `rgba(255, 209, 102, ${0.2 + pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOR_GOLD;
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 9);
    ctx.lineTo(-16, -6);
    ctx.lineTo(-7, 1);
    ctx.lineTo(0, -12);
    ctx.lineTo(7, 1);
    ctx.lineTo(16, -6);
    ctx.lineTo(14, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E63946';
    ctx.beginPath();
    ctx.arc(0, 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FEF08A';
    ctx.font = '800 9px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('3-PT CROWN', 0, 22 - bob);
  } else if (item.isDiamond) {
    // 2-Point Diamond Briefcase (Loop 3)
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.5);
    ctx.fillStyle = `rgba(56, 189, 248, ${0.22 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#BAE6FD';
    ctx.font = '800 9px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('2-PT DIAMOND', 0, 21 - bob);
  } else {
    // Standard 1-Point Gold Bullion Bar
    ctx.fillStyle = 'rgba(255, 209, 102, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOR_GOLD;
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, 6);
    ctx.lineTo(-8, -6);
    ctx.lineTo(8, -6);
    ctx.lineTo(11, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#B45309';
    ctx.fillRect(-5, -2, 10, 2);
  }

  ctx.restore();
}

function drawRoleBadgeIcon(
  ctx: CanvasRenderingContext2D,
  role: RivalRole,
  cx: number,
  cy: number,
  color: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  if (role === 'GUARD') {
    // Shield silhouette
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4.5, -3);
    ctx.lineTo(4.5, 1);
    ctx.quadraticCurveTo(4.5, 4.5, 0, 6);
    ctx.quadraticCurveTo(-4.5, 4.5, -4.5, 1);
    ctx.lineTo(-4.5, -3);
    ctx.closePath();
    ctx.stroke();
  } else if (role === 'HACKER') {
    // Terminal >_ icon
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(-1, 0);
    ctx.lineTo(-4, 3);
    ctx.moveTo(0.5, 3);
    ctx.lineTo(4.5, 3);
    ctx.stroke();
  } else {
    // Lightning Bolt icon
    ctx.beginPath();
    ctx.moveTo(1, -5.5);
    ctx.lineTo(-3.5, 0.5);
    ctx.lineTo(0, 0.5);
    ctx.lineTo(-1, 5.5);
    ctx.lineTo(3.5, -0.5);
    ctx.lineTo(0, -0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRivalCharacter(
  ctx: CanvasRenderingContext2D,
  team: RivalTeam,
  x: number,
  y: number,
  facing: number,
  carriedGold: RivalGoldItem | undefined,
  stunTimer: number,
  isEcho: boolean,
  role: RivalRole | null,
  walkPhase: number,
  timeSec: number,
  dashTimer = 0,
  dashCooldown = 0
): void {
  const accent = team === 'P1' ? COLOR_P1 : COLOR_P2;
  const darkRim = team === 'P1' ? '#991B1B' : '#0369A1';

  ctx.save();
  ctx.translate(x, y);

  // Tactical aura rings for GUARD (34px threat) and HACKER (55px ECM jammer)
  if (isEcho && stunTimer <= 0) {
    if (role === 'GUARD') {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6);
      ctx.fillStyle =
        team === 'P1'
          ? `rgba(230, 57, 70, ${0.06 + pulse * 0.05})`
          : `rgba(56, 189, 248, ${0.06 + pulse * 0.05})`;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, RIVAL_GUARD_THREAT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (role === 'HACKER') {
      ctx.fillStyle =
        team === 'P1'
          ? 'rgba(230, 57, 70, 0.045)'
          : 'rgba(56, 189, 248, 0.045)';
      ctx.strokeStyle =
        team === 'P1'
          ? 'rgba(230, 57, 70, 0.45)'
          : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(timeSec * 24);
      ctx.beginPath();
      ctx.arc(0, 0, RIVAL_HACKER_JAM_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Chrono-Dash burst glow & cooldown ring on live players
  if (!isEcho) {
    if (dashTimer > 0) {
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS + 7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (dashCooldown > 0) {
      const readyFrac =
        1 - Math.min(1, dashCooldown / RIVAL_DASH_COOLDOWN_SECONDS);
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        PLAYER_RADIUS + 5,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + Math.PI * 2 * readyFrac
      );
      ctx.stroke();
    }
  }

  if (isEcho) {
    ctx.globalAlpha = 0.58;
  }

  // Ground shadow
  ctx.fillStyle = isEcho ? 'rgba(15, 23, 42, 0.35)' : 'rgba(0, 0, 0, 0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 4, PLAYER_RADIUS * 1.05, PLAYER_RADIUS * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = Math.sin(walkPhase) * 0.04;
  ctx.save();
  ctx.rotate(facing);
  ctx.scale(1 + bob, 1 - bob);

  // Team jumpsuit body
  ctx.fillStyle = accent;
  ctx.strokeStyle = isEcho ? '#F8FAFC' : darkRim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, PLAYER_RADIUS - 1, PLAYER_RADIUS + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // White heist mask
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.ellipse(5, 0, 5.2, 6.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(6, -3.2, 2.2, 1.9);
  ctx.fillRect(6, 1.3, 2.2, 1.9);

  // Carried gold bar or crown
  if (carriedGold) {
    ctx.fillStyle = COLOR_GOLD;
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 1.3;
    if (carriedGold.isCrown) {
      ctx.beginPath();
      ctx.arc(0, 13, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(-5, 10, 11, 7);
      ctx.strokeRect(-5, 10, 11, 7);
    }
  }
  ctx.restore();

  // Stun indicator ring (1.2s Guard stun)
  if (stunTimer > 0) {
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS + 6, timeSec * 6, timeSec * 6 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#FEF08A';
    ctx.font = '800 9px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STUNNED', 0, -PLAYER_RADIUS - 12);
  } else if (isEcho && role) {
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Role Icon + short label badge (placed below echo so it never collides with live P1/P2 tag above)
    const badgeY =
      y > CANVAS_HEIGHT - 54 ? -PLAYER_RADIUS - 16 : PLAYER_RADIUS + 16;
    const roleShort =
      role === 'GUARD' ? 'GRD' : role === 'HACKER' ? 'HCK' : 'RUN';
    ctx.fillStyle = 'rgba(11, 13, 18, 0.94)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-24, badgeY - 8, 48, 16, 3);
    ctx.fill();
    ctx.stroke();

    drawRoleBadgeIcon(ctx, role, -14, badgeY, accent);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 9px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(roleShort, -5, badgeY);
  } else if (!isEcho) {
    // Player P1 / P2 crisp pill indicator above live player
    const tagY = y < 52 ? PLAYER_RADIUS + 14 : -PLAYER_RADIUS - 13;
    ctx.fillStyle = 'rgba(11, 13, 18, 0.9)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-13, tagY - 7, 26, 14, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 9px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(team === 'P1' ? 'P1' : 'P2', 0, tagY);
  }

  ctx.restore();
}

function drawRivalEchoes(
  ctx: CanvasRenderingContext2D,
  state: RivalGameState,
  timeSec: number
): void {
  const allEchoes: RivalEcho[] = [...state.p1Echoes, ...state.p2Echoes];
  for (const echo of allEchoes) {
    if (echo.frames.length === 0) continue;
    const headIdx = getRivalEchoFrameIndex(echo, state.tick);
    const tailStart = Math.max(0, headIdx - 18);
    if (headIdx > tailStart) {
      ctx.save();
      ctx.strokeStyle =
        echo.team === 'P1'
          ? 'rgba(230, 57, 70, 0.28)'
          : 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(echo.frames[tailStart].x, echo.frames[tailStart].y);
      for (let i = tailStart + 1; i <= headIdx; i++) {
        ctx.lineTo(echo.frames[i].x, echo.frames[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const carried = echo.carriedGoldId
      ? state.goldItems.find((g) => g.id === echo.carriedGoldId)
      : undefined;

    drawRivalCharacter(
      ctx,
      echo.team,
      echo.x,
      echo.y,
      echo.facing,
      carried,
      echo.stunTimer,
      true,
      echo.role,
      0,
      timeSec
    );
  }
}

function drawRivalLasers(
  ctx: CanvasRenderingContext2D,
  state: RivalGameState,
  timeSec: number
): void {
  const arenaId = state.arenaId ?? 'BULLION_HALL';
  const lasers = getActiveRivalLasers(state.loopNumber, arenaId);
  const segs = getActiveRivalLaserSegments(state.loopNumber, state.tick, arenaId);
  const pulse = 0.8 + 0.2 * Math.sin(timeSec * 16);

  for (let i = 0; i < lasers.length; i++) {
    const l = lasers[i];
    const seg = segs[i];
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.16)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(l.startA.x, l.startA.y);
    ctx.lineTo(l.endA.x, l.endA.y);
    ctx.moveTo(l.startB.x, l.startB.y);
    ctx.lineTo(l.endB.x, l.endB.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = `rgba(239, 68, 68, ${0.28 * pulse})`;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.stroke();

    ctx.strokeStyle = COLOR_LASER;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.stroke();

    ctx.strokeStyle = '#FEE2E2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.stroke();

    for (const [ex, ey] of [
      [seg.ax, seg.ay],
      [seg.bx, seg.by],
    ]) {
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = COLOR_LASER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRivalSirenVignette(
  ctx: CanvasRenderingContext2D,
  remainingSec: number,
  timeSec: number
): void {
  if (remainingSec >= 3.0) return;
  const urgency = Math.min(1, (3.0 - remainingSec) / 3.0);
  const phase = (timeSec * 2.4) % 1;
  const redPulse =
    phase < 0.45 ? Math.pow(Math.sin((phase / 0.45) * Math.PI * 2), 2) : 0.12;
  const bluePulse =
    phase >= 0.5 && phase < 0.95
      ? Math.pow(Math.sin(((phase - 0.5) / 0.45) * Math.PI * 2), 2)
      : 0.12;

  const leftAlpha = (0.13 + 0.2 * urgency) * (0.35 + 0.65 * redPulse);
  const rightAlpha = (0.13 + 0.2 * urgency) * (0.35 + 0.65 * bluePulse);

  ctx.save();
  const lGrad = ctx.createLinearGradient(0, 0, 140, 0);
  lGrad.addColorStop(0, `rgba(239, 68, 68, ${leftAlpha})`);
  lGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = lGrad;
  ctx.fillRect(0, 0, 140, CANVAS_HEIGHT);

  const rGrad = ctx.createLinearGradient(CANVAS_WIDTH - 140, 0, CANVAS_WIDTH, 0);
  rGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
  rGrad.addColorStop(1, `rgba(59, 130, 246, ${rightAlpha})`);
  ctx.fillStyle = rGrad;
  ctx.fillRect(CANVAS_WIDTH - 140, 0, 140, CANVAS_HEIGHT);
  ctx.restore();
}

export function renderRivalGame(
  ctx: CanvasRenderingContext2D,
  state: RivalGameState,
  timeSec: number
): void {
  ctx.save();

  if (state.shakeTimer > 0) {
    const t = Math.min(1, state.shakeTimer / 0.28);
    const mag = state.shakeIntensity * t * t;
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }

  const arenaId = state.arenaId ?? 'BULLION_HALL';
  const floor = getRivalFloorCache(arenaId);
  if (floor) ctx.drawImage(floor, 0, 0);
  else {
    ctx.fillStyle = COLOR_FLOOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawStash(
    ctx,
    state.stashes.P1,
    state.p1Score,
    isStashShieldedByHacker(state, 'P1'),
    timeSec
  );
  drawStash(
    ctx,
    state.stashes.P2,
    state.p2Score,
    isStashShieldedByHacker(state, 'P2'),
    timeSec
  );
  drawRivalWires(ctx, state, timeSec);

  for (const plate of state.plates) {
    drawRivalPlate(ctx, plate, state.activePlateIds.has(plate.id), timeSec);
  }

  for (const item of state.goldItems) {
    drawGoldItem(ctx, item, timeSec);
  }

  for (const gate of state.gates) {
    drawRivalGate(ctx, gate, state.gateOpenProgress[gate.id] ?? 0, timeSec);
  }

  drawRivalLasers(ctx, state, timeSec);

  for (const wall of state.walls) {
    drawRivalWall(ctx, wall);
  }

  drawRivalEchoes(ctx, state, timeSec);

  const p1Gold = state.p1.carriedGoldId
    ? state.goldItems.find((g) => g.id === state.p1.carriedGoldId)
    : undefined;
  const p2Gold = state.p2.carriedGoldId
    ? state.goldItems.find((g) => g.id === state.p2.carriedGoldId)
    : undefined;

  drawRivalCharacter(
    ctx,
    'P1',
    state.p1.x,
    state.p1.y,
    state.p1.facing,
    p1Gold,
    state.p1.stunTimer,
    false,
    null,
    state.p1.walkPhase,
    timeSec,
    state.p1.dashTimer ?? 0,
    state.p1.dashCooldown ?? 0
  );
  drawRivalCharacter(
    ctx,
    'P2',
    state.p2.x,
    state.p2.y,
    state.p2.facing,
    p2Gold,
    state.p2.stunTimer,
    false,
    null,
    state.p2.walkPhase,
    timeSec,
    state.p2.dashTimer ?? 0,
    state.p2.dashCooldown ?? 0
  );

  // Pooled particles
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (!p.active) continue;
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Top hairline 10s loop progress bar
  const rem = getRemainingSeconds(state.tick);
  ctx.fillStyle =
    state.loopNumber === RIVAL_TOTAL_LOOPS
      ? COLOR_GOLD
      : rem < 3.0
      ? COLOR_LASER
      : '#E63946';
  ctx.fillRect(0, 0, CANVAS_WIDTH * (rem / 10), 3);

  // Event toast banner inside top center of arena
  if (state.bannerText && state.bannerTimer > 0) {
    const a = Math.min(1, state.bannerTimer * 2);
    ctx.save();
    ctx.fillStyle = `rgba(11, 13, 18, ${0.88 * a})`;
    ctx.strokeStyle =
      state.loopNumber === RIVAL_TOTAL_LOOPS
        ? `rgba(255, 209, 102, ${a})`
        : `rgba(148, 163, 184, ${0.7 * a})`;
    ctx.lineWidth = 1.5;
    ctx.fillRect(CANVAS_WIDTH * 0.5 - 195, 26, 390, 26);
    ctx.strokeRect(CANVAS_WIDTH * 0.5 - 195, 26, 390, 26);

    ctx.fillStyle = `rgba(248, 250, 252, ${a})`;
    ctx.font = '700 11px "SFMono-Regular", Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.bannerText, CANVAS_WIDTH * 0.5, 39);
    ctx.restore();
  }

  // Brief VHS rewind glitch flash at loop start
  if (state.rewindFlashTimer > 0) {
    const a = Math.min(1, state.rewindFlashTimer / 0.25);
    ctx.fillStyle = `rgba(56, 189, 248, ${0.15 * a})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = `rgba(248, 250, 252, ${0.22 * a})`;
    for (let y = 0; y < CANVAS_HEIGHT; y += 10) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1.5);
    }
  }

  drawRivalSirenVignette(ctx, rem, timeSec);

  ctx.restore();
}
