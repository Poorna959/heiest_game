import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIXED_DT,
  Gate,
  InputState,
  LaserSegment,
  LOOP_TICKS,
  Particle,
  Plate,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RecordedFrame,
  RIVAL_CARRY_SPEED_MULT,
  RIVAL_GUARD_STUN_SECONDS,
  RIVAL_MAX_ECHOES_PER_PLAYER,
  RIVAL_RUNNER_SPEED_MULT,
  RIVAL_TOTAL_LOOPS,
  RivalEcho,
  RivalGameState,
  RivalGoldItem,
  RivalPlayerState,
  RivalRole,
  RivalSimEvent,
  RivalStashDef,
  RivalStatsSnapshot,
  RivalTeam,
  SweepingLaser,
  Wall,
} from '../types';
import {
  circleIntersectsRect,
  distancePointToSegmentSq,
  getSweepingLaserSegment,
} from './engine';

const RIVAL_PARTICLE_POOL = 110;
const BORDER = 20;

export const P1_SPAWN = { x: 138, y: 270 };
export const P2_SPAWN = { x: 822, y: 270 };

export const RIVAL_STASHES: { P1: RivalStashDef; P2: RivalStashDef } = {
  P1: { team: 'P1', x: 32, y: 205, w: 74, h: 130 },
  P2: { team: 'P2', x: 854, y: 205, w: 74, h: 130 },
};

export const RIVAL_WALLS: Wall[] = [
  // Outer vault perimeter
  { x: 0, y: 0, w: CANVAS_WIDTH, h: BORDER, material: 'steel' },
  { x: 0, y: CANVAS_HEIGHT - BORDER, w: CANVAS_WIDTH, h: BORDER, material: 'steel' },
  { x: 0, y: BORDER, w: BORDER, h: CANVAS_HEIGHT - BORDER * 2, material: 'steel' },
  {
    x: CANVAS_WIDTH - BORDER,
    y: BORDER,
    w: BORDER,
    h: CANVAS_HEIGHT - BORDER * 2,
    material: 'steel',
  },

  // Symmetric tactical cover baffles (leaving wide >= 100px lanes everywhere)
  { x: 192, y: 175, w: 84, h: 24, material: 'steel' },
  { x: 192, y: 341, w: 84, h: 24, material: 'steel' },
  { x: 684, y: 175, w: 84, h: 24, material: 'steel' },
  { x: 684, y: 341, w: 84, h: 24, material: 'steel' },

  // Center Royal Vault walls (x: 360..600, y: 120..420)
  // Top & bottom bypass corridors: y=20..120 (100px) and y=420..520 (100px)
  { x: 360, y: 120, w: 240, h: 24, material: 'steel' },
  { x: 360, y: 396, w: 240, h: 24, material: 'steel' },
  // Left vault doorway flanking Gate L (opening y: 215..325 = 110px)
  { x: 360, y: 144, w: 24, h: 71, material: 'steel' },
  { x: 360, y: 325, w: 24, h: 71, material: 'steel' },
  // Right vault doorway flanking Gate R (opening y: 215..325 = 110px)
  { x: 576, y: 144, w: 24, h: 71, material: 'steel' },
  { x: 576, y: 325, w: 24, h: 71, material: 'steel' },
];

export const RIVAL_PLATES: Plate[] = [
  // Symmetric diagonal pressure plates (equal ~187px from respective spawn)
  { id: 'plate-left', label: 'A', x: 205, y: 78, w: 58, h: 58 },
  { id: 'plate-right', label: 'B', x: 697, y: 404, w: 58, h: 58 },
];

export const RIVAL_GATES: Gate[] = [
  {
    id: 'gate-left',
    linkedPlateIds: ['plate-left'],
    x: 364,
    y: 215,
    w: 16,
    h: 110,
    wireWaypoints: [
      { x: 234, y: 107 },
      { x: 322, y: 107 },
      { x: 322, y: 270 },
      { x: 372, y: 270 },
    ],
  },
  {
    id: 'gate-right',
    linkedPlateIds: ['plate-right'],
    x: 580,
    y: 215,
    w: 16,
    h: 110,
    wireWaypoints: [
      { x: 726, y: 433 },
      { x: 638, y: 433 },
      { x: 638, y: 270 },
      { x: 588, y: 270 },
    ],
  },
];

// 1 sweeping center laser on Loops 1..5; 2 sweeping lasers on Loop 6
export const RIVAL_LASERS_BASE: SweepingLaser[] = [
  {
    id: 'rival-sweep-h',
    startA: { x: 404, y: 152 },
    startB: { x: 404, y: 388 },
    endA: { x: 556, y: 152 },
    endB: { x: 556, y: 388 },
    periodSeconds: 4.4,
    phaseOffset: 0,
  },
];

export const RIVAL_LASER_LOOP6_EXTRA: SweepingLaser = {
  id: 'rival-sweep-v',
  startA: { x: 392, y: 160 },
  startB: { x: 568, y: 160 },
  endA: { x: 392, y: 380 },
  endB: { x: 568, y: 380 },
  periodSeconds: 3.8,
  phaseOffset: Math.PI / 2,
};

export function getActiveRivalLasers(loopNumber: number): SweepingLaser[] {
  return loopNumber >= RIVAL_TOTAL_LOOPS
    ? [...RIVAL_LASERS_BASE, RIVAL_LASER_LOOP6_EXTRA]
    : RIVAL_LASERS_BASE;
}

export function getActiveRivalLaserSegments(
  loopNumber: number,
  tick: number
): LaserSegment[] {
  return getActiveRivalLasers(loopNumber).map((l) =>
    getSweepingLaserSegment(l, tick)
  );
}

function createRivalParticlePool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < RIVAL_PARTICLE_POOL; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.4,
      size: 3,
      color: '#F8FAFC',
    });
  }
  return pool;
}

function spawnRivalParticles(
  state: RivalGameState,
  x: number,
  y: number,
  count: number,
  color: string,
  speedMin = 40,
  speedMax = 165,
  sizeMin = 2,
  sizeMax = 4.5
): void {
  for (let i = 0; i < count; i++) {
    const p = state.particles[state.particleCursor];
    state.particleCursor = (state.particleCursor + 1) % RIVAL_PARTICLE_POOL;
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.maxLife = 0.24 + Math.random() * 0.24;
    p.life = p.maxLife;
    p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
    p.color = color;
  }
}

function createInitialGoldBars(): RivalGoldItem[] {
  const coords = [
    { x: 428, y: 196 },
    { x: 480, y: 196 },
    { x: 532, y: 196 },
    { x: 428, y: 344 },
    { x: 480, y: 344 },
    { x: 532, y: 344 },
  ];
  return coords.map((pt, idx) => ({
    id: `gold-${idx + 1}`,
    x: pt.x,
    y: pt.y,
    value: 1,
    isCrown: false,
    location: 'VAULT',
    carrierId: null,
  }));
}

function createRivalPlayer(team: RivalTeam): RivalPlayerState {
  const spawn = team === 'P1' ? P1_SPAWN : P2_SPAWN;
  return {
    team,
    name: team === 'P1' ? 'KYOTO' : 'OSLO',
    x: spawn.x,
    y: spawn.y,
    facing: team === 'P1' ? 0 : Math.PI,
    carriedGoldId: null,
    stunTimer: 0,
    stunImmunityTimer: 0,
    stealCooldown: 0,
    walkPhase: 0,
    squashX: 1,
    squashY: 1,
    hitFlashTimer: 0,
  };
}

export function createInitialRivalState(vsBot = false): RivalGameState {
  const gateOpenProgress: Record<string, number> = {};
  for (const g of RIVAL_GATES) {
    gateOpenProgress[g.id] = 0;
  }
  return {
    loopNumber: 1,
    tick: 0,
    vsBot,
    p1: createRivalPlayer('P1'),
    p2: createRivalPlayer('P2'),
    p1Recording: [],
    p2Recording: [],
    p1Echoes: [],
    p2Echoes: [],
    nextEchoSeq: 1,
    walls: RIVAL_WALLS,
    plates: RIVAL_PLATES,
    gates: RIVAL_GATES,
    stashes: RIVAL_STASHES,
    activePlateIds: new Set<string>(),
    gateOpenProgress,
    goldItems: createInitialGoldBars(),
    p1Score: 0,
    p2Score: 0,
    p1Stolen: 0,
    p2Stolen: 0,
    p1Stuns: 0,
    p2Stuns: 0,
    p1EchoesDeployed: 0,
    p2EchoesDeployed: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    rewindFlashTimer: 0,
    bannerText: 'LOOP 1 OF 6 · RAID THE ROYAL VAULT',
    bannerTimer: 2.0,
    matchEnded: false,
    awaitingDutyAssignment: false,
    particles: createRivalParticlePool(),
    particleCursor: 0,
  };
}

function resolveCircleWalls(
  x: number,
  y: number,
  radius: number,
  walls: Wall[]
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const cx = Math.max(w.x, Math.min(nx, w.x + w.w));
      const cy = Math.max(w.y, Math.min(ny, w.y + w.h));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const overlap = radius - d;
          nx += (dx / d) * overlap;
          ny += (dy / d) * overlap;
        } else {
          const penL = nx - w.x;
          const penR = w.x + w.w - nx;
          const penT = ny - w.y;
          const penB = w.y + w.h - ny;
          const m = Math.min(penL, penR, penT, penB);
          if (m === penL) nx = w.x - radius;
          else if (m === penR) nx = w.x + w.w + radius;
          else if (m === penT) ny = w.y - radius;
          else ny = w.y + w.h + radius;
        }
      }
    }
  }
  nx = Math.max(radius, Math.min(CANVAS_WIDTH - radius, nx));
  ny = Math.max(radius, Math.min(CANVAS_HEIGHT - radius, ny));
  return { x: nx, y: ny };
}

function findGoldById(
  state: RivalGameState,
  id: string | null
): RivalGoldItem | undefined {
  if (!id) return undefined;
  return state.goldItems.find((g) => g.id === id);
}

function dropCarriedGold(
  state: RivalGameState,
  goldId: string | null,
  dropX: number,
  dropY: number
): void {
  const item = findGoldById(state, goldId);
  if (!item) return;
  const safe = resolveCircleWalls(dropX, dropY, 12, state.walls);
  item.location = 'FLOOR';
  item.carrierId = null;
  item.x = safe.x;
  item.y = safe.y;
}

function tryGrabOrBankGold(
  state: RivalGameState,
  actorId: string,
  team: RivalTeam,
  x: number,
  y: number,
  getCarriedId: () => string | null,
  setCarriedId: (id: string | null) => void,
  getStealCd: () => number,
  setStealCd: (v: number) => void,
  events: RivalSimEvent[]
): void {
  const ownStash = team === 'P1' ? state.stashes.P1 : state.stashes.P2;
  const rivalTeam: RivalTeam = team === 'P1' ? 'P2' : 'P1';
  const rivalStash = rivalTeam === 'P1' ? state.stashes.P1 : state.stashes.P2;

  const carriedId = getCarriedId();
  if (carriedId) {
    // Sync carried item coordinates with carrier
    const item = findGoldById(state, carriedId);
    if (item) {
      item.x = x;
      item.y = y;
      // Bank if touching own stash
      if (
        circleIntersectsRect(
          x,
          y,
          PLAYER_RADIUS,
          ownStash.x,
          ownStash.y,
          ownStash.w,
          ownStash.h
        )
      ) {
        item.location = 'BANKED';
        item.carrierId = null;
        setCarriedId(null);
        if (team === 'P1') state.p1Score += item.value;
        else state.p2Score += item.value;

        spawnRivalParticles(
          state,
          ownStash.x + ownStash.w * 0.5,
          ownStash.y + ownStash.h * 0.5,
          item.isCrown ? 26 : 16,
          '#FFD166',
          45,
          190,
          2.5,
          5
        );
        events.push({ type: 'GOLD_BANK', team, x, y });
        if (item.isCrown) {
          state.bannerText = `${team === 'P1' ? 'KYOTO' : 'OSLO'} BANKED THE 3-PT CROWN!`;
          state.bannerTimer = 2.0;
        }
      }
    } else {
      setCarriedId(null);
    }
    return;
  }

  // Not carrying gold: check loose Vault or Floor gold items first
  const pickupRadius = PLAYER_RADIUS + 14;
  const pickupR2 = pickupRadius * pickupRadius;
  for (let i = 0; i < state.goldItems.length; i++) {
    const g = state.goldItems[i];
    if (g.location !== 'VAULT' && g.location !== 'FLOOR') continue;
    const dx = x - g.x;
    const dy = y - g.y;
    if (dx * dx + dy * dy <= pickupR2) {
      g.location = 'CARRIED';
      g.carrierId = actorId;
      g.x = x;
      g.y = y;
      setCarriedId(g.id);
      spawnRivalParticles(
        state,
        g.x,
        g.y,
        g.isCrown ? 20 : 12,
        '#FFD166',
        40,
        140,
        2,
        4.5
      );
      events.push({ type: 'GOLD_PICKUP', team, x: g.x, y: g.y });
      return;
    }
  }

  // Check stealing 1 gold bar directly from rival's Stash if it has gold
  const rivalScore = rivalTeam === 'P1' ? state.p1Score : state.p2Score;
  if (
    rivalScore > 0 &&
    getStealCd() <= 0 &&
    circleIntersectsRect(
      x,
      y,
      PLAYER_RADIUS,
      rivalStash.x,
      rivalStash.y,
      rivalStash.w,
      rivalStash.h
    )
  ) {
    if (rivalTeam === 'P1') state.p1Score = Math.max(0, state.p1Score - 1);
    else state.p2Score = Math.max(0, state.p2Score - 1);

    if (team === 'P1') state.p1Stolen += 1;
    else state.p2Stolen += 1;

    const stolenBar: RivalGoldItem = {
      id: `stolen-${state.loopNumber}-${state.tick}-${state.nextEchoSeq++}`,
      x,
      y,
      value: 1,
      isCrown: false,
      location: 'CARRIED',
      carrierId: actorId,
    };
    state.goldItems.push(stolenBar);
    setCarriedId(stolenBar.id);
    setStealCd(0.8);

    spawnRivalParticles(
      state,
      rivalStash.x + rivalStash.w * 0.5,
      rivalStash.y + rivalStash.h * 0.5,
      18,
      team === 'P1' ? '#E63946' : '#38BDF8',
      50,
      175,
      2.5,
      5
    );
    state.bannerText = `${team === 'P1' ? 'KYOTO' : 'OSLO'} RAIDED RIVAL STASH!`;
    state.bannerTimer = 1.5;
    events.push({ type: 'GOLD_STEAL', team, x, y });
  }
}

function updateEchoPose(echo: RivalEcho, tick: number): void {
  if (echo.frames.length === 0) return;
  if (echo.stunTimer > 0) return; // Stunned runners freeze in place
  const speedMult = echo.role === 'RUNNER' ? RIVAL_RUNNER_SPEED_MULT : 1.0;
  const idx = Math.min(
    Math.floor(tick * speedMult),
    echo.frames.length - 1
  );
  const f = echo.frames[idx];
  echo.x = f.x;
  echo.y = f.y;
  echo.facing = f.facing;
}

function isGateOpen(state: RivalGameState, gate: Gate): boolean {
  return gate.linkedPlateIds.every((id) => state.activePlateIds.has(id));
}

function checkLaserHitForPlayer(
  state: RivalGameState,
  player: RivalPlayerState,
  laserSegments: LaserSegment[]
): boolean {
  for (const gate of state.gates) {
    if ((state.gateOpenProgress[gate.id] ?? 0) < 0.4) {
      if (
        circleIntersectsRect(
          player.x,
          player.y,
          PLAYER_RADIUS - 2.5,
          gate.x,
          gate.y,
          gate.w,
          gate.h
        )
      ) {
        return true;
      }
    }
  }
  const hitR2 = (PLAYER_RADIUS - 2) ** 2;
  for (const seg of laserSegments) {
    if (
      distancePointToSegmentSq(player.x, player.y, seg.ax, seg.ay, seg.bx, seg.by) <=
      hitR2
    ) {
      return true;
    }
  }
  return false;
}

function moveRivalPlayer(
  state: RivalGameState,
  player: RivalPlayerState,
  input: InputState
): void {
  if (player.stunTimer > 0) {
    player.stunTimer = Math.max(0, player.stunTimer - FIXED_DT);
    if (player.stunTimer === 0) {
      player.stunImmunityTimer = 0.85;
    }
    return;
  }

  if (player.stunImmunityTimer > 0) {
    player.stunImmunityTimer = Math.max(0, player.stunImmunityTimer - FIXED_DT);
  }
  if (player.stealCooldown > 0) {
    player.stealCooldown = Math.max(0, player.stealCooldown - FIXED_DT);
  }

  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.facing = Math.atan2(dy, dx);
  }

  const speedMult = player.carriedGoldId ? RIVAL_CARRY_SPEED_MULT : 1.0;
  const stepDist = PLAYER_SPEED * speedMult * FIXED_DT;
  const colR = PLAYER_RADIUS - 1;

  const stepX = resolveCircleWalls(
    player.x + dx * stepDist,
    player.y,
    colR,
    state.walls
  );
  const stepY = resolveCircleWalls(
    stepX.x,
    stepX.y + dy * stepDist,
    colR,
    state.walls
  );

  const moved = Math.hypot(stepY.x - player.x, stepY.y - player.y);
  player.x = stepY.x;
  player.y = stepY.y;
  if (moved > 0.05) {
    player.walkPhase += moved * 0.12;
  }
}

/**
 * Deterministic tactical AI controller for Player 2 (Oslo) when VS AI BOT is enabled.
 */
export function computeBotInput(state: RivalGameState): InputState {
  const bot = state.p2;
  if (bot.stunTimer > 0) {
    return { up: false, down: false, left: false, right: false };
  }

  const gateROpen = (state.gateOpenProgress['gate-right'] ?? 0) >= 0.45;
  const hasHackerEcho = state.p2Echoes.some((e) => e.role === 'HACKER');

  let targetX = 726;
  let targetY = 433;

  // 1. Carrying gold -> sprint home to P2 Stash to bank
  if (bot.carriedGoldId) {
    if (bot.x < 576 && bot.y > 144 && bot.y < 396) {
      // Inside vault: exit through right doorway
      targetX = 635;
      targetY = 270;
    } else if (bot.x < 360) {
      // Returning from P1 raid: route via top or bottom highway
      targetX = 640;
      targetY = bot.y < 270 ? 70 : 470;
    } else {
      targetX = 885;
      targetY = 270;
    }
  } else if (state.loopNumber === 1 && !hasHackerEcho && state.tick < 290) {
    // Loop 1 opening: stand on Plate B to record a dedicated HACKER echo
    targetX = 726;
    targetY = 433;
  } else {
    // Check if there is a Crown or Gold item reachable
    const crown = state.goldItems.find(
      (g) => g.isCrown && (g.location === 'VAULT' || g.location === 'FLOOR')
    );
    const floorGoldOutside = state.goldItems.find(
      (g) =>
        g.location === 'FLOOR' &&
        (g.x > 600 || g.x < 360 || g.y < 120 || g.y > 420)
    );
    const vaultGold = state.goldItems
      .filter((g) => g.location === 'VAULT' || g.location === 'FLOOR')
      .sort(
        (a, b) =>
          Math.hypot(a.x - bot.x, a.y - bot.y) -
          Math.hypot(b.x - bot.x, b.y - bot.y)
      )[0];

    if (floorGoldOutside) {
      targetX = floorGoldOutside.x;
      targetY = floorGoldOutside.y;
    } else if (gateROpen && (crown || vaultGold)) {
      const targetGold = crown ?? vaultGold;
      // Enter cleanly via right doorway before turning inside vault
      if (bot.x > 605 && Math.abs(bot.y - 270) > 42) {
        targetX = 635;
        targetY = 270;
      } else {
        targetX = targetGold.x;
        targetY = targetGold.y;
      }
    } else if (state.p1Score > 0 && state.loopNumber >= 2) {
      // Flank via bottom or top corridor to raid P1's Stash!
      if (bot.x > 330 && bot.y > 110 && bot.y < 430) {
        targetX = bot.x > 610 ? 640 : 320;
        targetY = bot.y < 270 ? 68 : 472;
      } else if (bot.x > 160) {
        targetX = 135;
        targetY = bot.y < 270 ? 68 : 472;
      } else {
        targetX = 70;
        targetY = 270;
      }
    } else if (!hasHackerEcho) {
      targetX = 726;
      targetY = 433;
    } else {
      // Wait just outside Gate R ready for Hacker echo to unlock it
      targetX = 635;
      targetY = 270;
    }
  }

  // Steer cleanly around the 4 horizontal tactical cover baffles so the bot never snags
  const baffles = state.walls.slice(4, 8);
  for (let i = 0; i < baffles.length; i++) {
    const b = baffles[i];
    const padX = PLAYER_RADIUS + 8;
    const padY = PLAYER_RADIUS + 6;
    const crossingDown = bot.y < b.y + b.h * 0.5 && targetY > b.y + b.h;
    const crossingUp = bot.y > b.y + b.h * 0.5 && targetY < b.y;
    if (crossingDown || crossingUp) {
      const botInX = bot.x > b.x - padX && bot.x < b.x + b.w + padX;
      const targetInX = targetX > b.x - padX && targetX < b.x + b.w + padX;
      if (botInX || targetInX) {
        const leftDetour = b.x - padX - 8;
        const rightDetour = b.x + b.w + padX + 8;
        const distLeft = Math.abs(bot.x - leftDetour) + Math.abs(targetX - leftDetour);
        const distRight = Math.abs(bot.x - rightDetour) + Math.abs(targetX - rightDetour);
        const detourX = distLeft <= distRight ? leftDetour : rightDetour;
        targetX = detourX;
        if (botInX) {
          targetY = crossingDown ? b.y - padY - 4 : b.y + b.h + padY + 4;
        }
        break;
      }
    }
  }

  // Avoid running into closed Gate R or sweeping center laser
  const laserSegments = getActiveRivalLaserSegments(state.loopNumber, state.tick);
  for (const seg of laserSegments) {
    const distSq = distancePointToSegmentSq(
      bot.x,
      bot.y,
      seg.ax,
      seg.ay,
      seg.bx,
      seg.by
    );
    if (distSq < 42 * 42) {
      // Step perpendicular away from laser
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      targetX = bot.x + (bot.x >= mx ? 60 : -60);
      targetY = bot.y + (bot.y >= my ? 60 : -60);
    }
  }

  const dx = targetX - bot.x;
  const dy = targetY - bot.y;
  return {
    left: dx < -8,
    right: dx > 8,
    up: dy < -8,
    down: dy > 8,
  };
}

/** Intelligent role selection for AI Bot during the 3s Assign Echo Duty intermission */
export function chooseBotEchoDuty(state: RivalGameState): RivalRole {
  const frames = state.p2Recording;
  if (frames.length === 0) return 'RUNNER';

  // If bot spent >= 40 ticks on Plate B and has no active Hacker echo yet -> HACKER
  const plateB = state.plates[1];
  let plateTicks = 0;
  let carriedTicks = 0;
  let leftHalfTicks = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (
      f.x >= plateB.x - 12 &&
      f.x <= plateB.x + plateB.w + 12 &&
      f.y >= plateB.y - 12 &&
      f.y <= plateB.y + plateB.h + 12
    ) {
      plateTicks++;
    }
    if (f.hasGold) carriedTicks++;
    if (f.x < 460) leftHalfTicks++;
  }

  const hasHacker = state.p2Echoes.some((e) => e.role === 'HACKER');
  if (!hasHacker && plateTicks >= 35) return 'HACKER';
  if (carriedTicks >= 20) return 'RUNNER';
  if (leftHalfTicks >= 60 && !state.p2Echoes.some((e) => e.role === 'GUARD')) {
    return 'GUARD';
  }
  return 'RUNNER';
}

/**
 * Commit both players' chosen echo duties at the end of the 3-second intermission
 * and advance to the next 10-second loop cleanly.
 */
export function commitEchoDutiesAndStartNextLoop(
  state: RivalGameState,
  p1Role: RivalRole,
  p2Role: RivalRole
): RivalSimEvent[] {
  if (!state.awaitingDutyAssignment || state.matchEnded) return [];

  const events: RivalSimEvent[] = [];

  // Drop any still-carried gold from players/echoes cleanly back to floor before next loop
  if (state.p1.carriedGoldId) {
    dropCarriedGold(state, state.p1.carriedGoldId, state.p1.x, state.p1.y);
    state.p1.carriedGoldId = null;
  }
  if (state.p2.carriedGoldId) {
    dropCarriedGold(state, state.p2.carriedGoldId, state.p2.x, state.p2.y);
    state.p2.carriedGoldId = null;
  }
  for (const e of [...state.p1Echoes, ...state.p2Echoes]) {
    if (e.carriedGoldId) {
      dropCarriedGold(state, e.carriedGoldId, e.x, e.y);
      e.carriedGoldId = null;
    }
    e.stunTimer = 0;
    e.stunImmunityTimer = 0;
    e.stealCooldown = 0;
  }

  // Save P1 recorded run with assigned role (max 4 echoes per player)
  if (state.p1Recording.length > 0) {
    state.p1Echoes.push({
      id: `p1-echo-${state.nextEchoSeq++}`,
      team: 'P1',
      role: p1Role,
      frames: state.p1Recording,
      x: P1_SPAWN.x,
      y: P1_SPAWN.y,
      facing: 0,
      carriedGoldId: null,
      stunTimer: 0,
      stunImmunityTimer: 0,
      stealCooldown: 0,
    });
    if (state.p1Echoes.length > RIVAL_MAX_ECHOES_PER_PLAYER) {
      state.p1Echoes.shift();
    }
    state.p1EchoesDeployed += 1;
  }

  // Save P2 recorded run with assigned role (max 4 echoes per player)
  if (state.p2Recording.length > 0) {
    state.p2Echoes.push({
      id: `p2-echo-${state.nextEchoSeq++}`,
      team: 'P2',
      role: p2Role,
      frames: state.p2Recording,
      x: P2_SPAWN.x,
      y: P2_SPAWN.y,
      facing: Math.PI,
      carriedGoldId: null,
      stunTimer: 0,
      stunImmunityTimer: 0,
      stealCooldown: 0,
    });
    if (state.p2Echoes.length > RIVAL_MAX_ECHOES_PER_PLAYER) {
      state.p2Echoes.shift();
    }
    state.p2EchoesDeployed += 1;
  }

  // Advance to next loop
  state.loopNumber += 1;
  state.tick = 0;
  state.awaitingDutyAssignment = false;
  state.p1Recording = [];
  state.p2Recording = [];
  state.p1 = createRivalPlayer('P1');
  state.p2 = createRivalPlayer('P2');
  state.activePlateIds.clear();
  for (const g of state.gates) {
    state.gateOpenProgress[g.id] = 0;
  }
  state.rewindFlashTimer = 0.25;

  // Loop 6 Finale: Spawn the 3-point Golden Crown in the center of the Vault + 2nd sweeping laser!
  if (state.loopNumber === RIVAL_TOTAL_LOOPS) {
    const hasCrown = state.goldItems.some((g) => g.isCrown);
    if (!hasCrown) {
      state.goldItems.push({
        id: 'golden-crown',
        x: 480,
        y: 270,
        value: 3,
        isCrown: true,
        location: 'VAULT',
        carrierId: null,
      });
      spawnRivalParticles(state, 480, 270, 28, '#FFD166', 55, 220, 3, 5.5);
      state.bannerText = 'FINAL LOOP 6/6 · 3-PT GOLDEN CROWN + DUAL LASERS!';
      state.bannerTimer = 2.6;
      events.push({ type: 'CROWN_SPAWN', x: 480, y: 270 });
    }
  } else {
    state.bannerText = `LOOP ${state.loopNumber} OF ${RIVAL_TOTAL_LOOPS} · ECHOES DEPLOYED`;
    state.bannerTimer = 1.6;
  }

  return events;
}

/** Advance Rival Heist simulation by exactly 1 fixed tick (1/60s) */
export function stepRivalSimulation(
  state: RivalGameState,
  p1Input: InputState,
  p2Input: InputState
): RivalSimEvent[] {
  const events: RivalSimEvent[] = [];

  // Tick visual effects
  if (state.shakeTimer > 0) state.shakeTimer = Math.max(0, state.shakeTimer - FIXED_DT);
  if (state.rewindFlashTimer > 0)
    state.rewindFlashTimer = Math.max(0, state.rewindFlashTimer - FIXED_DT);
  if (state.bannerTimer > 0) {
    state.bannerTimer = Math.max(0, state.bannerTimer - FIXED_DT);
    if (state.bannerTimer === 0) state.bannerText = null;
  }
  if (state.p1.hitFlashTimer > 0)
    state.p1.hitFlashTimer = Math.max(0, state.p1.hitFlashTimer - FIXED_DT);
  if (state.p2.hitFlashTimer > 0)
    state.p2.hitFlashTimer = Math.max(0, state.p2.hitFlashTimer - FIXED_DT);

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (!p.active) continue;
    p.life -= FIXED_DT;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.x += p.vx * FIXED_DT;
    p.y += p.vy * FIXED_DT;
    p.vx *= 0.93;
    p.vy *= 0.93;
  }

  if (state.matchEnded || state.awaitingDutyAssignment) {
    return events;
  }

  // 1. Update echo poses & stun timers
  const allEchoes = [...state.p1Echoes, ...state.p2Echoes];
  for (const echo of allEchoes) {
    if (echo.stunTimer > 0) {
      echo.stunTimer = Math.max(0, echo.stunTimer - FIXED_DT);
      if (echo.stunTimer === 0) echo.stunImmunityTimer = 0.8;
    } else {
      if (echo.stunImmunityTimer > 0) {
        echo.stunImmunityTimer = Math.max(0, echo.stunImmunityTimer - FIXED_DT);
      }
      if (echo.stealCooldown > 0) {
        echo.stealCooldown = Math.max(0, echo.stealCooldown - FIXED_DT);
      }
      updateEchoPose(echo, state.tick);
    }
  }

  // 2. Evaluate Biometric Plates (activated by live players OR HACKER echoes)
  const prevPlates = new Set(state.activePlateIds);
  state.activePlateIds.clear();

  for (const plate of state.plates) {
    let pressed =
      circleIntersectsRect(
        state.p1.x,
        state.p1.y,
        PLAYER_RADIUS,
        plate.x,
        plate.y,
        plate.w,
        plate.h
      ) ||
      circleIntersectsRect(
        state.p2.x,
        state.p2.y,
        PLAYER_RADIUS,
        plate.x,
        plate.y,
        plate.w,
        plate.h
      );

    if (!pressed) {
      for (const echo of allEchoes) {
        if (echo.role !== 'HACKER') continue;
        if (
          circleIntersectsRect(
            echo.x,
            echo.y,
            PLAYER_RADIUS,
            plate.x,
            plate.y,
            plate.w,
            plate.h
          )
        ) {
          pressed = true;
          break;
        }
      }
    }

    if (pressed) state.activePlateIds.add(plate.id);
  }

  for (const plate of state.plates) {
    const was = prevPlates.has(plate.id);
    const now = state.activePlateIds.has(plate.id);
    if (!was && now) {
      events.push({
        type: 'PLATE_ON',
        x: plate.x + plate.w * 0.5,
        y: plate.y + plate.h * 0.5,
      });
      spawnRivalParticles(
        state,
        plate.x + plate.w * 0.5,
        plate.y + plate.h * 0.5,
        8,
        '#22C55E',
        30,
        110
      );
    } else if (was && !now) {
      events.push({
        type: 'PLATE_OFF',
        x: plate.x + plate.w * 0.5,
        y: plate.y + plate.h * 0.5,
      });
    }
  }

  // 3. Smoothly open/close Laser Gates
  for (const gate of state.gates) {
    const target = isGateOpen(state, gate) ? 1 : 0;
    const cur = state.gateOpenProgress[gate.id] ?? 0;
    const rate = FIXED_DT * 10;
    state.gateOpenProgress[gate.id] =
      cur < target ? Math.min(1, cur + rate) : Math.max(0, cur - rate);
  }

  // 4. Move P1 and P2 (or AI Bot for P2)
  const resolvedP2Input = state.vsBot ? computeBotInput(state) : p2Input;
  moveRivalPlayer(state, state.p1, p1Input);
  moveRivalPlayer(state, state.p2, resolvedP2Input);

  // Record frames for both players
  state.p1Recording.push({
    x: state.p1.x,
    y: state.p1.y,
    facing: state.p1.facing,
    hasGold: Boolean(state.p1.carriedGoldId),
  });
  state.p2Recording.push({
    x: state.p2.x,
    y: state.p2.y,
    facing: state.p2.facing,
    hasGold: Boolean(state.p2.carriedGoldId),
  });

  // 5. GUARD Echo Stun Checks (1.2s stun + knock carried gold onto floor)
  const stunDistSq = (PLAYER_RADIUS * 2.05) ** 2;
  const checkGuardStuns = (
    guards: RivalEcho[],
    rivalPlayer: RivalPlayerState,
    rivalEchoes: RivalEcho[],
    guardTeam: RivalTeam
  ) => {
    for (const g of guards) {
      if (g.role !== 'GUARD') continue;

      // Vs rival live player
      if (rivalPlayer.stunTimer <= 0 && rivalPlayer.stunImmunityTimer <= 0) {
        const dx = g.x - rivalPlayer.x;
        const dy = g.y - rivalPlayer.y;
        if (dx * dx + dy * dy <= stunDistSq) {
          rivalPlayer.stunTimer = RIVAL_GUARD_STUN_SECONDS;
          rivalPlayer.hitFlashTimer = 0.25;
          if (rivalPlayer.carriedGoldId) {
            dropCarriedGold(
              state,
              rivalPlayer.carriedGoldId,
              rivalPlayer.x,
              rivalPlayer.y
            );
            rivalPlayer.carriedGoldId = null;
          }
          if (guardTeam === 'P1') state.p1Stuns += 1;
          else state.p2Stuns += 1;
          state.shakeTimer = 0.25;
          state.shakeIntensity = 7;
          spawnRivalParticles(
            state,
            rivalPlayer.x,
            rivalPlayer.y,
            18,
            guardTeam === 'P1' ? '#E63946' : '#38BDF8',
            55,
            195
          );
          events.push({
            type: 'GUARD_STUN',
            team: guardTeam,
            x: rivalPlayer.x,
            y: rivalPlayer.y,
          });
        }
      }

      // Vs rival RUNNER echoes
      for (const targetEcho of rivalEchoes) {
        if (targetEcho.role !== 'RUNNER') continue;
        if (targetEcho.stunTimer > 0 || targetEcho.stunImmunityTimer > 0) continue;
        const dx = g.x - targetEcho.x;
        const dy = g.y - targetEcho.y;
        if (dx * dx + dy * dy <= stunDistSq) {
          targetEcho.stunTimer = RIVAL_GUARD_STUN_SECONDS;
          if (targetEcho.carriedGoldId) {
            dropCarriedGold(
              state,
              targetEcho.carriedGoldId,
              targetEcho.x,
              targetEcho.y
            );
            targetEcho.carriedGoldId = null;
          }
          if (guardTeam === 'P1') state.p1Stuns += 1;
          else state.p2Stuns += 1;
          spawnRivalParticles(
            state,
            targetEcho.x,
            targetEcho.y,
            14,
            '#F8FAFC',
            45,
            165
          );
          events.push({
            type: 'GUARD_STUN',
            team: guardTeam,
            x: targetEcho.x,
            y: targetEcho.y,
          });
        }
      }
    }
  };

  checkGuardStuns(state.p1Echoes, state.p2, state.p2Echoes, 'P1');
  checkGuardStuns(state.p2Echoes, state.p1, state.p1Echoes, 'P2');

  // 6. Gold pickup, rival stash stealing, and banking for players & RUNNER echoes
  if (state.p1.stunTimer <= 0) {
    tryGrabOrBankGold(
      state,
      'P1',
      'P1',
      state.p1.x,
      state.p1.y,
      () => state.p1.carriedGoldId,
      (id) => {
        state.p1.carriedGoldId = id;
      },
      () => state.p1.stealCooldown,
      (v) => {
        state.p1.stealCooldown = v;
      },
      events
    );
  }
  if (state.p2.stunTimer <= 0) {
    tryGrabOrBankGold(
      state,
      'P2',
      'P2',
      state.p2.x,
      state.p2.y,
      () => state.p2.carriedGoldId,
      (id) => {
        state.p2.carriedGoldId = id;
      },
      () => state.p2.stealCooldown,
      (v) => {
        state.p2.stealCooldown = v;
      },
      events
    );
  }

  for (const echo of allEchoes) {
    if (echo.role !== 'RUNNER' || echo.stunTimer > 0) continue;
    tryGrabOrBankGold(
      state,
      echo.id,
      echo.team,
      echo.x,
      echo.y,
      () => echo.carriedGoldId,
      (id) => {
        echo.carriedGoldId = id;
      },
      () => echo.stealCooldown,
      (v) => {
        echo.stealCooldown = v;
      },
      events
    );
  }

  // 7. Laser hazards for live players (zap drops carried gold & resets that player to spawn)
  const laserSegments = getActiveRivalLaserSegments(state.loopNumber, state.tick);
  for (const player of [state.p1, state.p2]) {
    if (player.stunTimer > 0) continue;
    if (checkLaserHitForPlayer(state, player, laserSegments)) {
      const hitX = player.x;
      const hitY = player.y;
      if (player.carriedGoldId) {
        dropCarriedGold(state, player.carriedGoldId, hitX, hitY);
        player.carriedGoldId = null;
      }
      const spawn = player.team === 'P1' ? P1_SPAWN : P2_SPAWN;
      player.x = spawn.x;
      player.y = spawn.y;
      player.stunTimer = 0.55;
      player.hitFlashTimer = 0.28;
      state.shakeTimer = 0.28;
      state.shakeIntensity = 7;
      spawnRivalParticles(state, hitX, hitY, 20, '#EF4444', 60, 210);
      events.push({ type: 'LASER_HIT', team: player.team, x: hitX, y: hitY });
    }
  }

  // 8. Advance loop clock (600 ticks = 10.00s)
  state.tick += 1;

  if (state.tick >= LOOP_TICKS) {
    if (state.loopNumber >= RIVAL_TOTAL_LOOPS) {
      state.matchEnded = true;
      events.push({ type: 'MATCH_END' });
    } else {
      state.awaitingDutyAssignment = true;
      events.push({ type: 'LOOP_END' });
    }
  } else if (state.tick >= 420 && state.tick % 30 === 0) {
    events.push({ type: 'TICK_URGENT' });
  } else if (state.tick < 420 && state.tick % 60 === 0) {
    events.push({ type: 'TICK_SECOND' });
  }

  return events;
}

export function buildRivalStatsSnapshot(
  state: RivalGameState
): RivalStatsSnapshot {
  const winner: 'P1' | 'P2' | 'DRAW' =
    state.p1Score > state.p2Score
      ? 'P1'
      : state.p2Score > state.p1Score
      ? 'P2'
      : 'DRAW';
  return {
    p1Score: state.p1Score,
    p2Score: state.p2Score,
    p1Stolen: state.p1Stolen,
    p2Stolen: state.p2Stolen,
    p1Stuns: state.p1Stuns,
    p2Stuns: state.p2Stuns,
    p1EchoesDeployed: state.p1EchoesDeployed,
    p2EchoesDeployed: state.p2EchoesDeployed,
    winner,
    vsBot: state.vsBot,
  };
}
