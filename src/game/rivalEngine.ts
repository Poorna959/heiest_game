import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIXED_DT,
  Gate,
  LaserSegment,
  LOOP_TICKS,
  Particle,
  Plate,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RIVAL_CARRY_SPEED_MULT,
  RIVAL_DASH_COOLDOWN_SECONDS,
  RIVAL_DASH_DURATION_SECONDS,
  RIVAL_DASH_SPEED_MULT,
  RIVAL_ECHO_GATE_STUN_SECONDS,
  RIVAL_GUARD_STUN_SECONDS,
  RIVAL_GUARD_THREAT_RADIUS,
  RIVAL_HACKER_JAM_RADIUS,
  RIVAL_HACKER_SLOW_MULT,
  RIVAL_MAX_ECHOES_PER_PLAYER,
  RIVAL_RUNNER_SPEED_MULT,
  RIVAL_TACKLE_STUN_SECONDS,
  RIVAL_TOTAL_LOOPS,
  RivalArenaId,
  RivalBotDifficulty,
  RivalEcho,
  RivalGameState,
  RivalGoldItem,
  RivalInputState,
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
import { RIVAL_ARENAS } from './rivalMaps';
import { resolveRivalBanter } from './scriptEngine';

const RIVAL_PARTICLE_POOL = 128;

export const P1_SPAWN = RIVAL_ARENAS.BULLION_HALL.p1Spawn;
export const P2_SPAWN = RIVAL_ARENAS.BULLION_HALL.p2Spawn;

export const RIVAL_STASHES: { P1: RivalStashDef; P2: RivalStashDef } = {
  P1: { team: 'P1', x: 32, y: 205, w: 74, h: 130 },
  P2: { team: 'P2', x: 854, y: 205, w: 74, h: 130 },
};

export const RIVAL_WALLS: Wall[] = RIVAL_ARENAS.BULLION_HALL.walls;
export const RIVAL_PLATES: Plate[] = RIVAL_ARENAS.BULLION_HALL.plates;
export const RIVAL_GATES: Gate[] = RIVAL_ARENAS.BULLION_HALL.gates;
export const RIVAL_LASERS_BASE: SweepingLaser[] =
  RIVAL_ARENAS.BULLION_HALL.baseLasers;
export const RIVAL_LASER_LOOP6_EXTRA: SweepingLaser =
  RIVAL_ARENAS.BULLION_HALL.loop6ExtraLaser;

export function getActiveRivalLasers(
  loopNumber: number,
  arenaId: RivalArenaId = 'BULLION_HALL'
): SweepingLaser[] {
  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;
  const raw =
    loopNumber >= RIVAL_TOTAL_LOOPS
      ? [...arena.baseLasers, arena.loop6ExtraLaser]
      : arena.baseLasers;

  // Loops 4..6: 20% laser speed overdrive
  if (loopNumber >= 4) {
    return raw.map((l) => ({
      ...l,
      periodSeconds: l.periodSeconds > 0 ? l.periodSeconds / 1.2 : 0,
    }));
  }
  return raw;
}

export function getActiveRivalLaserSegments(
  loopNumber: number,
  tick: number,
  arenaId: RivalArenaId = 'BULLION_HALL'
): LaserSegment[] {
  return getActiveRivalLasers(loopNumber, arenaId).map((l) =>
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

function createInitialGoldBars(arenaId: RivalArenaId): RivalGoldItem[] {
  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;
  return arena.vaultGoldCoords.map((pt, idx) => ({
    id: `gold-${idx + 1}`,
    x: pt.x,
    y: pt.y,
    value: 1,
    isCrown: false,
    isDiamond: false,
    location: 'VAULT',
    carrierId: null,
  }));
}

function createRivalPlayer(
  team: RivalTeam,
  arenaId: RivalArenaId = 'BULLION_HALL'
): RivalPlayerState {
  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;
  const spawn = team === 'P1' ? arena.p1Spawn : arena.p2Spawn;
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
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: team === 'P1' ? 1 : -1,
    dashDirY: 0,
    walkPhase: 0,
    squashX: 1,
    squashY: 1,
    hitFlashTimer: 0,
  };
}

export function createInitialRivalState(
  vsBot = false,
  arenaId: RivalArenaId = 'BULLION_HALL',
  botDifficulty: RivalBotDifficulty = 'TACTICIAN'
): RivalGameState {
  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;
  const gateOpenProgress: Record<string, number> = {};
  for (const g of arena.gates) {
    gateOpenProgress[g.id] = 0;
  }
  return {
    loopNumber: 1,
    tick: 0,
    vsBot,
    arenaId: arena.id,
    botDifficulty,
    p1: createRivalPlayer('P1', arena.id),
    p2: createRivalPlayer('P2', arena.id),
    p1Recording: [],
    p2Recording: [],
    p1Echoes: [],
    p2Echoes: [],
    nextEchoSeq: 1,
    walls: arena.walls,
    plates: arena.plates,
    gates: arena.gates,
    stashes: RIVAL_STASHES,
    activePlateIds: new Set<string>(),
    gateOpenProgress,
    goldItems: createInitialGoldBars(arena.id),
    p1Score: 0,
    p2Score: 0,
    p1Stolen: 0,
    p2Stolen: 0,
    p1Stuns: 0,
    p2Stuns: 0,
    p1EchoesDeployed: 0,
    p2EchoesDeployed: 0,
    p1Tackles: 0,
    p2Tackles: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    rewindFlashTimer: 0,
    bannerText: `LOOP 1 OF ${RIVAL_TOTAL_LOOPS} · ${arena.name}`,
    bannerTimer: 2.0,
    liveBanter: null,
    liveBanterTimer: 0,
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

/** Returns true if the defending team has an active HACKER echo shielding its own stash */
export function isStashShieldedByHacker(
  state: RivalGameState,
  defendingTeam: RivalTeam
): boolean {
  const stash = defendingTeam === 'P1' ? state.stashes.P1 : state.stashes.P2;
  const stashCx = stash.x + stash.w * 0.5;
  const stashCy = stash.y + stash.h * 0.5;
  const defenders = defendingTeam === 'P1' ? state.p1Echoes : state.p2Echoes;
  const shieldR2 = (RIVAL_HACKER_JAM_RADIUS + 18) ** 2;

  for (const e of defenders) {
    if (e.role !== 'HACKER' || e.stunTimer > 0) continue;
    const dx = e.x - stashCx;
    const dy = e.y - stashCy;
    if (dx * dx + dy * dy <= shieldR2) {
      return true;
    }
  }
  return false;
}

/** Returns true if a point is inside an enemy HACKER echo's 55px ECM Jamming Field */
function isJammedByEnemyHacker(
  state: RivalGameState,
  team: RivalTeam,
  x: number,
  y: number
): boolean {
  const enemyEchoes = team === 'P1' ? state.p2Echoes : state.p1Echoes;
  const jamR2 = RIVAL_HACKER_JAM_RADIUS * RIVAL_HACKER_JAM_RADIUS;
  for (const e of enemyEchoes) {
    if (e.role !== 'HACKER' || e.stunTimer > 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= jamR2) {
      return true;
    }
  }
  return false;
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
          item.isCrown ? 26 : item.isDiamond ? 22 : 16,
          item.isDiamond ? '#38BDF8' : '#FFD166',
          45,
          190,
          2.5,
          5
        );
        events.push({ type: 'GOLD_BANK', team, x, y });
        if (item.isCrown) {
          state.bannerText = `${team === 'P1' ? 'KYOTO' : 'OSLO'} BANKED THE 3-PT CROWN!`;
          state.bannerTimer = 2.0;
        } else if (item.isDiamond) {
          state.bannerText = `${team === 'P1' ? 'KYOTO' : 'OSLO'} BANKED THE 2-PT DIAMOND CASE!`;
          state.bannerTimer = 1.8;
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
        g.isCrown ? 20 : g.isDiamond ? 16 : 12,
        g.isDiamond ? '#38BDF8' : '#FFD166',
        40,
        140,
        2,
        4.5
      );
      events.push({ type: 'GOLD_PICKUP', team, x: g.x, y: g.y });
      return;
    }
  }

  // Check stealing 1 gold bar directly from rival's Stash (blocked if rival HACKER shields it!)
  const rivalScore = rivalTeam === 'P1' ? state.p1Score : state.p2Score;
  if (
    rivalScore > 0 &&
    getStealCd() <= 0 &&
    !isStashShieldedByHacker(state, rivalTeam) &&
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
      isDiamond: false,
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

/**
 * Computes deterministic frame index for Rival echoes.
 * RUNNER echoes replay at 1.2x speed and ping-pong reverse back along their path
 * once they reach the end of their recorded frames.
 */
export function getRivalEchoFrameIndex(echo: RivalEcho, tick: number): number {
  const len = echo.frames.length;
  if (len <= 1) return 0;
  if (echo.role === 'RUNNER') {
    const rawIdx = Math.floor(tick * RIVAL_RUNNER_SPEED_MULT);
    const maxIdx = len - 1;
    const cycle = maxIdx * 2;
    const pos = rawIdx % cycle;
    return pos <= maxIdx ? pos : cycle - pos;
  }
  return Math.min(tick, len - 1);
}

function updateEchoPose(echo: RivalEcho, tick: number): void {
  if (echo.frames.length === 0) return;
  if (echo.stunTimer > 0) return; // Stunned echoes freeze in place
  const idx = getRivalEchoFrameIndex(echo, tick);
  const f = echo.frames[idx];
  echo.x = f.x;
  echo.y = f.y;
  echo.facing = f.facing;
}

function isGateOpen(state: RivalGameState, gate: Gate): boolean {
  return gate.linkedPlateIds.every((id) => state.activePlateIds.has(id));
}

function checkLaserHitAtPoint(
  state: RivalGameState,
  x: number,
  y: number,
  laserSegments: LaserSegment[]
): boolean {
  for (const gate of state.gates) {
    if ((state.gateOpenProgress[gate.id] ?? 0) < 0.4) {
      if (
        circleIntersectsRect(
          x,
          y,
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
      distancePointToSegmentSq(x, y, seg.ax, seg.ay, seg.bx, seg.by) <= hitR2
    ) {
      return true;
    }
  }
  return false;
}

function moveRivalPlayer(
  state: RivalGameState,
  player: RivalPlayerState,
  input: RivalInputState
): void {
  if ((player.dashCooldown ?? 0) > 0) {
    player.dashCooldown = Math.max(0, (player.dashCooldown ?? 0) - FIXED_DT);
  }

  if (player.stunTimer > 0) {
    player.stunTimer = Math.max(0, player.stunTimer - FIXED_DT);
    player.dashTimer = 0;
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

  // Trigger Chrono-Dash burst if requested and off cooldown
  if (
    input.dash &&
    (player.dashTimer ?? 0) <= 0 &&
    (player.dashCooldown ?? 0) <= 0
  ) {
    player.dashTimer = RIVAL_DASH_DURATION_SECONDS;
    player.dashCooldown = RIVAL_DASH_COOLDOWN_SECONDS;
    if (dx !== 0 || dy !== 0) {
      player.dashDirX = dx;
      player.dashDirY = dy;
    } else {
      player.dashDirX = Math.cos(player.facing);
      player.dashDirY = Math.sin(player.facing);
    }
    spawnRivalParticles(
      state,
      player.x,
      player.y,
      10,
      player.team === 'P1' ? '#E63946' : '#38BDF8',
      50,
      150,
      2,
      4
    );
  }

  const isDashing = (player.dashTimer ?? 0) > 0;
  if (isDashing) {
    player.dashTimer = Math.max(0, (player.dashTimer ?? 0) - FIXED_DT);
    dx = player.dashDirX ?? Math.cos(player.facing);
    dy = player.dashDirY ?? Math.sin(player.facing);
  }

  let speedMult = player.carriedGoldId ? RIVAL_CARRY_SPEED_MULT : 1.0;
  if (isDashing) {
    speedMult *= RIVAL_DASH_SPEED_MULT;
  } else if (isJammedByEnemyHacker(state, player.team, player.x, player.y)) {
    speedMult *= RIVAL_HACKER_SLOW_MULT;
  }

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
 * Deterministic tactical AI controller for Player 2 (Oslo) across 3 difficulty tiers:
 * OPERATIVE (casual), TACTICIAN (standard), MASTERMIND (hard).
 */
export function computeBotInput(state: RivalGameState): RivalInputState {
  const bot = state.p2;
  if (bot.stunTimer > 0) {
    return { up: false, down: false, left: false, right: false, dash: false };
  }

  const difficulty: RivalBotDifficulty = state.botDifficulty ?? 'TACTICIAN';
  const arenaId: RivalArenaId = state.arenaId ?? 'BULLION_HALL';
  const plateB = state.plates[1] ?? state.plates[0];
  const plateBCx = plateB.x + plateB.w * 0.5;
  const plateBCy = plateB.y + plateB.h * 0.5;

  const gateROpen = (state.gateOpenProgress['gate-right'] ?? 0) >= 0.45;
  const hasHackerEcho = state.p2Echoes.some((e) => e.role === 'HACKER');

  let targetX = plateBCx;
  let targetY = plateBCy;
  let wantsDash = false;

  // MASTERMIND: Actively hunt & dash-tackle P1 if P1 is carrying gold/Crown nearby!
  const p1Dist = Math.hypot(state.p1.x - bot.x, state.p1.y - bot.y);
  if (
    difficulty === 'MASTERMIND' &&
    !bot.carriedGoldId &&
    state.p1.carriedGoldId &&
    state.p1.stunTimer <= 0 &&
    p1Dist < 170
  ) {
    targetX = state.p1.x;
    targetY = state.p1.y;
    if (p1Dist < 95 && (bot.dashCooldown ?? 0) <= 0) {
      wantsDash = true;
    }
  } else if (bot.carriedGoldId) {
    // 1. Carrying gold -> sprint home to P2 Stash to bank
    const carried = findGoldById(state, bot.carriedGoldId);
    if (
      difficulty !== 'OPERATIVE' &&
      (carried?.isCrown || carried?.isDiamond) &&
      (bot.dashCooldown ?? 0) <= 0 &&
      bot.x > 580
    ) {
      wantsDash = true;
    }

    if (arenaId !== 'TWIN_VAULTS' && bot.x < 576 && bot.y > 144 && bot.y < 396) {
      targetX = 635;
      targetY = 270;
    } else if (bot.x < 360) {
      targetX = 640;
      targetY = bot.y < 270 ? 70 : 470;
    } else {
      targetX = 885;
      targetY = 270;
    }
  } else if (state.loopNumber === 1 && !hasHackerEcho && state.tick < 290) {
    // Loop 1 opening: stand on Plate B to record a dedicated HACKER echo
    targetX = plateBCx;
    targetY = plateBCy;
  } else {
    // Check high-value Crown, Diamond, Floor loot, or Vault gold
    const crownOrDiamond = state.goldItems.find(
      (g) =>
        (g.isCrown || g.isDiamond) &&
        (g.location === 'VAULT' || g.location === 'FLOOR')
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
    } else if (gateROpen && (crownOrDiamond || vaultGold)) {
      const targetGold = crownOrDiamond ?? vaultGold;
      if (
        arenaId !== 'TWIN_VAULTS' &&
        bot.x > 605 &&
        Math.abs(bot.y - 270) > 42
      ) {
        targetX = 635;
        targetY = 270;
      } else {
        targetX = targetGold.x;
        targetY = targetGold.y;
        if (
          difficulty !== 'OPERATIVE' &&
          (targetGold.isCrown || targetGold.isDiamond) &&
          Math.hypot(targetX - bot.x, targetY - bot.y) < 110 &&
          (bot.dashCooldown ?? 0) <= 0
        ) {
          wantsDash = true;
        }
      }
    } else if (
      state.p1Score > 0 &&
      state.loopNumber >= 2 &&
      !isStashShieldedByHacker(state, 'P1')
    ) {
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
      targetX = plateBCx;
      targetY = plateBCy;
    } else {
      targetX = arenaId === 'TWIN_VAULTS' ? 480 : 635;
      targetY = 270;
    }
  }

  // Steer cleanly around horizontal cover baffles
  const baffles = state.walls.slice(4, 8);
  for (let i = 0; i < baffles.length; i++) {
    const b = baffles[i];
    if (b.w < 40) continue;
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
        const distLeft =
          Math.abs(bot.x - leftDetour) + Math.abs(targetX - leftDetour);
        const distRight =
          Math.abs(bot.x - rightDetour) + Math.abs(targetX - rightDetour);
        targetX = distLeft <= distRight ? leftDetour : rightDetour;
        if (botInX) {
          targetY = crossingDown ? b.y - padY - 4 : b.y + b.h + padY + 4;
        }
        break;
      }
    }
  }

  // TACTICIAN & MASTERMIND: Dodge enemy P1 GUARD echoes
  if (difficulty !== 'OPERATIVE') {
    for (const guard of state.p1Echoes) {
      if (guard.role !== 'GUARD') continue;
      const gx = bot.x - guard.x;
      const gy = bot.y - guard.y;
      const d2 = gx * gx + gy * gy;
      if (d2 < 56 * 56 && d2 > 1) {
        const d = Math.sqrt(d2);
        targetX = bot.x + (gx / d) * 70;
        targetY = bot.y + (gy / d) * 70;
      }
    }
  }

  // Avoid active sweeping lasers
  const laserSegments = getActiveRivalLaserSegments(
    state.loopNumber,
    state.tick,
    arenaId
  );
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
    dash: wantsDash,
  };
}

/** Intelligent role selection for AI Bot during the 3s Assign Echo Duty intermission */
export function chooseBotEchoDuty(state: RivalGameState): RivalRole {
  const frames = state.p2Recording;
  if (frames.length === 0) return 'RUNNER';

  const plateB = state.plates[1] ?? state.plates[0];
  let plateTicks = 0;
  let carriedTicks = 0;
  let leftHalfTicks = 0;
  let nearOwnStashTicks = 0;
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
    if (f.x > 800 && Math.abs(f.y - 270) < 85) nearOwnStashTicks++;
  }

  const hasHacker = state.p2Echoes.some((e) => e.role === 'HACKER');
  if (!hasHacker && plateTicks >= 35) return 'HACKER';
  if (
    state.botDifficulty === 'MASTERMIND' &&
    state.p2Score >= state.p1Score + 2 &&
    nearOwnStashTicks >= 45 &&
    !isStashShieldedByHacker(state, 'P2')
  ) {
    return 'HACKER';
  }
  if (carriedTicks >= 20) return 'RUNNER';
  if (leftHalfTicks >= 60 && !state.p2Echoes.some((e) => e.role === 'GUARD')) {
    return 'GUARD';
  }
  return 'RUNNER';
}

function applyBanterFromEvents(
  state: RivalGameState,
  events: RivalSimEvent[]
): void {
  for (let i = events.length - 1; i >= 0; i--) {
    const banter = resolveRivalBanter(state, events[i]);
    if (banter) {
      state.liveBanter = banter;
      state.liveBanterTimer = 3.2;
      break;
    }
  }
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
  const arenaId: RivalArenaId = state.arenaId ?? 'BULLION_HALL';
  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;

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
      x: arena.p1Spawn.x,
      y: arena.p1Spawn.y,
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
      x: arena.p2Spawn.x,
      y: arena.p2Spawn.y,
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
  state.p1 = createRivalPlayer('P1', arenaId);
  state.p2 = createRivalPlayer('P2', arenaId);
  state.activePlateIds.clear();
  for (const g of state.gates) {
    state.gateOpenProgress[g.id] = 0;
  }
  state.rewindFlashTimer = 0.25;

  // Dynamic Mid-Match Escalation Events
  if (state.loopNumber === 3) {
    // Loop 3: Spawn 2-Point Diamond Briefcase + replenish 2 vault gold bars if vault is low
    const hasDiamond = state.goldItems.some((g) => g.isDiamond);
    if (!hasDiamond) {
      state.goldItems.push({
        id: 'diamond-case',
        x: arena.diamondDropCoord.x,
        y: arena.diamondDropCoord.y,
        value: 2,
        isCrown: false,
        isDiamond: true,
        location: 'VAULT',
        carrierId: null,
      });
    }
    const vaultRemaining = state.goldItems.filter(
      (g) => g.location === 'VAULT' && !g.isDiamond && !g.isCrown
    ).length;
    if (vaultRemaining < 3) {
      for (let i = 0; i < 2; i++) {
        const pt = arena.vaultGoldCoords[i % arena.vaultGoldCoords.length];
        state.goldItems.push({
          id: `replenish-l3-${i}-${state.nextEchoSeq++}`,
          x: pt.x,
          y: pt.y,
          value: 1,
          isCrown: false,
          isDiamond: false,
          location: 'VAULT',
          carrierId: null,
        });
      }
    }
    spawnRivalParticles(
      state,
      arena.diamondDropCoord.x,
      arena.diamondDropCoord.y,
      24,
      '#38BDF8',
      50,
      200,
      2.5,
      5
    );
    state.bannerText = 'LOOP 3/6 · 2-PT DIAMOND BRIEFCASE DROPPED!';
    state.bannerTimer = 2.4;
    events.push({
      type: 'DIAMOND_SPAWN',
      x: arena.diamondDropCoord.x,
      y: arena.diamondDropCoord.y,
    });
  } else if (state.loopNumber === 4 || state.loopNumber === 5) {
    // Loops 4 & 5: Spawn 2 lateral corridor gold bars + 20% Laser Overdrive
    arena.corridorDropCoords.forEach((pt, idx) => {
      state.goldItems.push({
        id: `corridor-l${state.loopNumber}-${idx}-${state.nextEchoSeq++}`,
        x: pt.x,
        y: pt.y,
        value: 1,
        isCrown: false,
        isDiamond: false,
        location: 'FLOOR',
        carrierId: null,
      });
      spawnRivalParticles(state, pt.x, pt.y, 14, '#FFD166', 40, 140, 2, 4);
    });
    state.bannerText = `LOOP ${state.loopNumber}/6 · CORRIDOR BULLION + LASER OVERDRIVE!`;
    state.bannerTimer = 2.2;
    events.push({ type: 'CORRIDOR_DROP' });
  } else if (state.loopNumber === RIVAL_TOTAL_LOOPS) {
    // Loop 6 Finale: Spawn the 3-point Golden Crown + 2nd sweeping laser!
    const hasCrown = state.goldItems.some((g) => g.isCrown);
    if (!hasCrown) {
      state.goldItems.push({
        id: 'golden-crown',
        x: arena.crownSpawnCoord.x,
        y: arena.crownSpawnCoord.y,
        value: 3,
        isCrown: true,
        isDiamond: false,
        location: 'VAULT',
        carrierId: null,
      });
      spawnRivalParticles(
        state,
        arena.crownSpawnCoord.x,
        arena.crownSpawnCoord.y,
        28,
        '#FFD166',
        55,
        220,
        3,
        5.5
      );
      state.bannerText = 'FINAL LOOP 6/6 · 3-PT GOLDEN CROWN + DUAL LASERS!';
      state.bannerTimer = 2.6;
      events.push({
        type: 'CROWN_SPAWN',
        x: arena.crownSpawnCoord.x,
        y: arena.crownSpawnCoord.y,
      });
    }
  } else {
    state.bannerText = `LOOP ${state.loopNumber} OF ${RIVAL_TOTAL_LOOPS} · ECHOES DEPLOYED`;
    state.bannerTimer = 1.6;
  }

  applyBanterFromEvents(state, events);
  return events;
}

/** Advance Rival Heist simulation by exactly 1 fixed tick (1/60s) */
export function stepRivalSimulation(
  state: RivalGameState,
  p1Input: RivalInputState,
  p2Input: RivalInputState
): RivalSimEvent[] {
  const events: RivalSimEvent[] = [];
  const arenaId: RivalArenaId = state.arenaId ?? 'BULLION_HALL';
  const arena = RIVAL_ARENAS[arenaId] ?? RIVAL_ARENAS.BULLION_HALL;

  // Tick visual effects
  if (state.shakeTimer > 0)
    state.shakeTimer = Math.max(0, state.shakeTimer - FIXED_DT);
  if (state.rewindFlashTimer > 0)
    state.rewindFlashTimer = Math.max(0, state.rewindFlashTimer - FIXED_DT);
  if (state.bannerTimer > 0) {
    state.bannerTimer = Math.max(0, state.bannerTimer - FIXED_DT);
    if (state.bannerTimer === 0) state.bannerText = null;
  }
  if ((state.liveBanterTimer ?? 0) > 0) {
    state.liveBanterTimer = Math.max(0, (state.liveBanterTimer ?? 0) - FIXED_DT);
    if (state.liveBanterTimer === 0) state.liveBanter = null;
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
        if (echo.role !== 'HACKER' || echo.stunTimer > 0) continue;
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

  // 4. Move P1 and P2 (or AI Bot for P2) including Chrono-Dash burst
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

  // 4b. Chrono-Dash Shoulder Tackle checks (live player dashing into rival player or rival RUNNER echo)
  const tackleDistSq = (PLAYER_RADIUS * 2.15) ** 2;
  const checkDashTackle = (
    attacker: RivalPlayerState,
    defender: RivalPlayerState,
    defenderEchoes: RivalEcho[]
  ) => {
    if ((attacker.dashTimer ?? 0) <= 0) return;

    // Vs rival live player
    if (defender.stunTimer <= 0 && defender.stunImmunityTimer <= 0) {
      const dx = attacker.x - defender.x;
      const dy = attacker.y - defender.y;
      if (dx * dx + dy * dy <= tackleDistSq) {
        defender.stunTimer = RIVAL_TACKLE_STUN_SECONDS;
        defender.hitFlashTimer = 0.25;
        if (defender.carriedGoldId) {
          dropCarriedGold(state, defender.carriedGoldId, defender.x, defender.y);
          defender.carriedGoldId = null;
        }
        if (attacker.team === 'P1') state.p1Tackles = (state.p1Tackles ?? 0) + 1;
        else state.p2Tackles = (state.p2Tackles ?? 0) + 1;
        state.shakeTimer = 0.22;
        state.shakeIntensity = 7;
        spawnRivalParticles(
          state,
          defender.x,
          defender.y,
          18,
          attacker.team === 'P1' ? '#E63946' : '#38BDF8',
          60,
          200
        );
        events.push({
          type: 'DASH_TACKLE',
          team: attacker.team,
          x: defender.x,
          y: defender.y,
        });
      }
    }

    // Vs rival RUNNER echoes
    for (const targetEcho of defenderEchoes) {
      if (targetEcho.role !== 'RUNNER') continue;
      if (targetEcho.stunTimer > 0 || targetEcho.stunImmunityTimer > 0) continue;
      const dx = attacker.x - targetEcho.x;
      const dy = attacker.y - targetEcho.y;
      if (dx * dx + dy * dy <= tackleDistSq) {
        targetEcho.stunTimer = RIVAL_TACKLE_STUN_SECONDS;
        if (targetEcho.carriedGoldId) {
          dropCarriedGold(
            state,
            targetEcho.carriedGoldId,
            targetEcho.x,
            targetEcho.y
          );
          targetEcho.carriedGoldId = null;
        }
        if (attacker.team === 'P1') state.p1Tackles = (state.p1Tackles ?? 0) + 1;
        else state.p2Tackles = (state.p2Tackles ?? 0) + 1;
        spawnRivalParticles(
          state,
          targetEcho.x,
          targetEcho.y,
          14,
          '#F8FAFC',
          50,
          170
        );
        events.push({
          type: 'DASH_TACKLE',
          team: attacker.team,
          x: targetEcho.x,
          y: targetEcho.y,
        });
      }
    }
  };

  checkDashTackle(state.p1, state.p2, state.p2Echoes);
  checkDashTackle(state.p2, state.p1, state.p1Echoes);

  // 5. GUARD Echo Stun Checks (34px threat radius -> 1.2s stun + knock carried gold onto floor)
  const stunDistSq = RIVAL_GUARD_THREAT_RADIUS * RIVAL_GUARD_THREAT_RADIUS;
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

  // 6. Enforce Laser Gate & Sweeping Laser Security on RUNNER Echoes
  const laserSegments = getActiveRivalLaserSegments(
    state.loopNumber,
    state.tick,
    arenaId
  );
  for (const echo of allEchoes) {
    if (echo.role !== 'RUNNER' || echo.stunTimer > 0) continue;
    if (checkLaserHitAtPoint(state, echo.x, echo.y, laserSegments)) {
      if (echo.carriedGoldId) {
        dropCarriedGold(state, echo.carriedGoldId, echo.x, echo.y);
        echo.carriedGoldId = null;
      }
      echo.stunTimer = RIVAL_ECHO_GATE_STUN_SECONDS;
      spawnRivalParticles(state, echo.x, echo.y, 14, '#EF4444', 50, 170);
      events.push({
        type: 'ECHO_ZAPPED',
        team: echo.team,
        x: echo.x,
        y: echo.y,
      });
    }
  }

  // 7. Gold pickup, rival stash stealing, and banking for players & RUNNER echoes
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

  // 8. Laser hazards for live players (zap drops carried gold & resets that player to spawn)
  for (const player of [state.p1, state.p2]) {
    if (player.stunTimer > 0) continue;
    if (checkLaserHitAtPoint(state, player.x, player.y, laserSegments)) {
      const hitX = player.x;
      const hitY = player.y;
      if (player.carriedGoldId) {
        dropCarriedGold(state, player.carriedGoldId, hitX, hitY);
        player.carriedGoldId = null;
      }
      const spawn = player.team === 'P1' ? arena.p1Spawn : arena.p2Spawn;
      player.x = spawn.x;
      player.y = spawn.y;
      player.stunTimer = 0.55;
      player.dashTimer = 0;
      player.hitFlashTimer = 0.28;
      state.shakeTimer = 0.28;
      state.shakeIntensity = 7;
      spawnRivalParticles(state, hitX, hitY, 20, '#EF4444', 60, 210);
      events.push({ type: 'LASER_HIT', team: player.team, x: hitX, y: hitY });
    }
  }

  // 9. Advance loop clock (600 ticks = 10.00s)
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

  applyBanterFromEvents(state, events);
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
    p1Tackles: state.p1Tackles ?? 0,
    p2Tackles: state.p2Tackles ?? 0,
    winner,
    vsBot: state.vsBot,
    arenaId: state.arenaId ?? 'BULLION_HALL',
    botDifficulty: state.botDifficulty ?? 'TACTICIAN',
  };
}
