import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  EchoRecording,
  FIXED_DT,
  FREEZE_FRAME_DURATION,
  GameState,
  Gate,
  GoldCaseDef,
  InputState,
  LaserSegment,
  LevelDef,
  LOOP_TICKS,
  MAX_ECHOES,
  MIN_MANUAL_REWIND_TICKS,
  Particle,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RecordedFrame,
  RunStatsSnapshot,
  SimEvent,
  SweepingLaser,
  Wall,
} from '../types';
import { LEVELS } from './levels';

const PARTICLE_POOL_SIZE = 96;

function createParticlePool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
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

export function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  count: number,
  color: string,
  speedMin = 40,
  speedMax = 160,
  sizeMin = 2,
  sizeMax = 4.5,
  lifeMin = 0.22,
  lifeMax = 0.48
): void {
  for (let i = 0; i < count; i++) {
    const p = state.particles[state.particleCursor];
    state.particleCursor = (state.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.maxLife = lifeMin + Math.random() * (lifeMax - lifeMin);
    p.life = p.maxLife;
    p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
    p.color = color;
  }
}

export function getLevelGoldCases(level: LevelDef): GoldCaseDef[] {
  if (level.goldCases && level.goldCases.length > 0) {
    return level.goldCases;
  }
  if (level.goldCase) {
    return [level.goldCase];
  }
  return [];
}

export function createInitialGameState(
  levelIndex = 0,
  cumulative?: {
    totalLoopsUsed: number;
    totalEchoesCreated: number;
    totalElapsedSeconds: number;
  }
): GameState {
  const safeIndex = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
  const level = LEVELS[safeIndex];
  const gateOpenProgress: Record<string, number> = {};
  for (const gate of level.gates) {
    gateOpenProgress[gate.id] = 0;
  }

  return {
    levelIndex: safeIndex,
    level,
    tick: 0,
    loopNumber: 1,
    player: {
      x: level.spawn.x,
      y: level.spawn.y,
      facing: 0,
      hasGold: false,
      walkPhase: 0,
      squashX: 1,
      squashY: 1,
    },
    currentRecording: [],
    echoes: [],
    nextEchoId: 1,
    activePlateIds: new Set<string>(),
    gateOpenProgress,
    goldCollected: false,
    collectedGoldIds: new Set<number>(),
    lastRadioEvent: null,
    shakeTimer: 0,
    shakeIntensity: 0,
    hitFlashTimer: 0,
    hitstopTimer: 0,
    rewindFlashTimer: 0,
    lastLaserHitPos: null,
    freezeFrameActive: false,
    freezeFrameTimer: 0,
    totalLoopsUsed: cumulative ? cumulative.totalLoopsUsed + 1 : 1,
    totalEchoesCreated: cumulative ? cumulative.totalEchoesCreated : 0,
    totalElapsedSeconds: cumulative ? cumulative.totalElapsedSeconds : 0,
    chapterCompleted: false,
    particles: createParticlePool(),
    particleCursor: 0,
  };
}

/** Deterministic echo pose lookup; anchors at last recorded frame if ended early */
export function getEchoFrameAtTick(
  echo: EchoRecording,
  tick: number
): RecordedFrame {
  if (echo.frames.length === 0) {
    return { x: 0, y: 0, facing: 0, hasGold: false };
  }
  const idx = Math.max(0, Math.min(tick, echo.frames.length - 1));
  return echo.frames[idx];
}

/** Deterministic sweeping laser segment computed strictly from loop tick */
export function getSweepingLaserSegment(
  laser: SweepingLaser,
  tick: number
): LaserSegment {
  if (laser.periodSeconds <= 0) {
    return {
      id: laser.id,
      ax: laser.startA.x,
      ay: laser.startA.y,
      bx: laser.startB.x,
      by: laser.startB.y,
    };
  }
  const tSec = tick * FIXED_DT;
  const phase = (tSec / laser.periodSeconds) * Math.PI * 2 + (laser.phaseOffset ?? 0);
  const alpha = (Math.sin(phase) + 1) * 0.5; // 0..1 smooth sine oscillation
  return {
    id: laser.id,
    ax: laser.startA.x + (laser.endA.x - laser.startA.x) * alpha,
    ay: laser.startA.y + (laser.endA.y - laser.startA.y) * alpha,
    bx: laser.startB.x + (laser.endB.x - laser.startB.x) * alpha,
    by: laser.startB.y + (laser.endB.y - laser.startB.y) * alpha,
  };
}

export function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export function distancePointToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const projX = ax + t * abx;
  const projY = ay + t * aby;
  const dx = px - projX;
  const dy = py - projY;
  return dx * dx + dy * dy;
}

function resolveCircleAgainstRects(
  x: number,
  y: number,
  radius: number,
  rects: { x: number; y: number; w: number; h: number }[]
): { x: number; y: number } {
  let nx = x;
  let ny = y;

  // Iterative projection guarantees smooth sliding along corners and seams
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const closestX = Math.max(rect.x, Math.min(nx, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(ny, rect.y + rect.h));
      const dx = nx - closestX;
      const dy = ny - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radius * radius) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          nx += (dx / dist) * overlap;
          ny += (dy / dist) * overlap;
        } else {
          // Circle center is inside the rectangle — push out along shallowest axis
          const penLeft = nx - rect.x;
          const penRight = rect.x + rect.w - nx;
          const penTop = ny - rect.y;
          const penBottom = rect.y + rect.h - ny;
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) nx = rect.x - radius;
          else if (minPen === penRight) nx = rect.x + rect.w + radius;
          else if (minPen === penTop) ny = rect.y - radius;
          else ny = rect.y + rect.h + radius;
        }
      }
    }
  }

  nx = Math.max(radius, Math.min(CANVAS_WIDTH - radius, nx));
  ny = Math.max(radius, Math.min(CANVAS_HEIGHT - radius, ny));
  return { x: nx, y: ny };
}

function isGateOpen(state: GameState, gate: Gate): boolean {
  return gate.linkedPlateIds.every((id) => state.activePlateIds.has(id));
}

function resetLoopToStart(state: GameState): void {
  state.tick = 0;
  state.currentRecording = [];
  state.player.x = state.level.spawn.x;
  state.player.y = state.level.spawn.y;
  state.player.facing = 0;
  state.player.hasGold = false;
  state.player.walkPhase = 0;
  state.player.squashX = 1.15;
  state.player.squashY = 0.85;
  state.goldCollected = false;
  if (!state.collectedGoldIds) {
    state.collectedGoldIds = new Set<number>();
  } else {
    state.collectedGoldIds.clear();
  }
  state.activePlateIds.clear();
  for (const gate of state.level.gates) {
    state.gateOpenProgress[gate.id] = 0;
  }
}

function saveCurrentEchoAndRestart(state: GameState): void {
  if (state.currentRecording.length > 0) {
    const newEcho: EchoRecording = {
      id: state.nextEchoId++,
      frames: state.currentRecording,
    };
    state.echoes.push(newEcho);
    if (state.echoes.length > MAX_ECHOES) {
      state.echoes.shift();
    }
    state.totalEchoesCreated += 1;
  }
  state.loopNumber += 1;
  state.totalLoopsUsed += 1;
  state.rewindFlashTimer = 0.25;
  state.hitstopTimer = 0;
  state.lastLaserHitPos = null;
  spawnParticles(
    state,
    state.player.x,
    state.player.y,
    16,
    '#38BDF8',
    45,
    165,
    2,
    4.5
  );
  resetLoopToStart(state);
}

/** Manual Rewind triggered by pressing R (saves echo only if tick >= 15) */
export function triggerManualRewind(state: GameState): SimEvent[] {
  if (state.freezeFrameActive || state.chapterCompleted) return [];
  if (state.tick < MIN_MANUAL_REWIND_TICKS) return [];
  saveCurrentEchoAndRestart(state);
  return [{ type: 'REWIND', x: state.player.x, y: state.player.y }];
}

/** Clear all recorded echoes cleanly via C key */
export function clearAllEchoes(state: GameState): SimEvent[] {
  if (state.freezeFrameActive || state.chapterCompleted) return [];
  state.echoes = [];
  state.nextEchoId = 1;
  state.rewindFlashTimer = 0.16;
  state.hitstopTimer = 0;
  state.lastLaserHitPos = null;
  resetLoopToStart(state);
  return [{ type: 'CLEAR_ECHOES' }];
}

/** Update non-physics visual effects (particles, screen shake, flash timers) in real dt */
export function tickVisualEffects(state: GameState, dt: number): void {
  if (state.shakeTimer > 0) {
    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  }
  if (state.hitFlashTimer > 0) {
    state.hitFlashTimer = Math.max(0, state.hitFlashTimer - dt);
  }
  if (state.rewindFlashTimer > 0) {
    state.rewindFlashTimer = Math.max(0, state.rewindFlashTimer - dt);
  }
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
  }

  // Smooth exponential spring back for player squash-and-stretch
  const decay = Math.min(1, dt * 14);
  state.player.squashX += (1 - state.player.squashX) * decay;
  state.player.squashY += (1 - state.player.squashY) * decay;

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  }
}

/**
 * Advance simulation by exactly one fixed tick (1/60s).
 * Returns discrete simulation events for audio/UI hooks.
 */
export function stepSimulation(
  state: GameState,
  input: InputState
): SimEvent[] {
  const events: SimEvent[] = [];

  tickVisualEffects(state, FIXED_DT);

  if (state.chapterCompleted) {
    return events;
  }

  // Handle Chapter 5 2-second cinematic blast-door freeze-frame
  if (state.freezeFrameActive) {
    state.freezeFrameTimer -= FIXED_DT;
    // Rapidly slam blast door shut visually during first 0.2s
    for (const gate of state.level.gates) {
      if (gate.isBlastDoor) {
        state.gateOpenProgress[gate.id] = Math.max(
          0,
          (state.gateOpenProgress[gate.id] ?? 0) - FIXED_DT * 8
        );
      }
    }
    if (state.freezeFrameTimer <= 0) {
      state.freezeFrameActive = false;
      state.chapterCompleted = true;
    }
    return events;
  }

  // Sim-level hitstop freeze on laser contact (renders & shakes while physics briefly hold)
  if (state.hitstopTimer > 0) {
    return events;
  }

  state.totalElapsedSeconds += FIXED_DT;

  // 1. Evaluate plate activations from current player & echo poses at current tick
  const prevPlates = new Set(state.activePlateIds);
  state.activePlateIds.clear();

  for (const plate of state.level.plates) {
    let pressed = circleIntersectsRect(
      state.player.x,
      state.player.y,
      PLAYER_RADIUS,
      plate.x,
      plate.y,
      plate.w,
      plate.h
    );

    if (!pressed) {
      for (let i = 0; i < state.echoes.length; i++) {
        const frame = getEchoFrameAtTick(state.echoes[i], state.tick);
        if (
          circleIntersectsRect(
            frame.x,
            frame.y,
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

    if (pressed) {
      state.activePlateIds.add(plate.id);
    }
  }

  for (const plate of state.level.plates) {
    const wasOn = prevPlates.has(plate.id);
    const isOn = state.activePlateIds.has(plate.id);
    if (!wasOn && isOn) {
      events.push({
        type: 'PLATE_ON',
        x: plate.x + plate.w * 0.5,
        y: plate.y + plate.h * 0.5,
      });
      spawnParticles(
        state,
        plate.x + plate.w * 0.5,
        plate.y + plate.h * 0.5,
        10,
        '#22C55E',
        35,
        115,
        2,
        4
      );
    } else if (wasOn && !isOn) {
      events.push({
        type: 'PLATE_OFF',
        x: plate.x + plate.w * 0.5,
        y: plate.y + plate.h * 0.5,
      });
    }
  }

  // 2. Smoothly animate gate open progress (snappy 0.1s opening so tight sprints feel responsive)
  for (const gate of state.level.gates) {
    const target = isGateOpen(state, gate) ? 1 : 0;
    const current = state.gateOpenProgress[gate.id] ?? 0;
    const rate = FIXED_DT * 10;
    if (current < target) {
      state.gateOpenProgress[gate.id] = Math.min(1, current + rate);
    } else if (current > target) {
      state.gateOpenProgress[gate.id] = Math.max(0, current - rate);
    }
  }

  // 3. Player movement (8-directional normalized) with forgiving collision radius & smooth axis-separated wall sliding
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
    state.player.facing = Math.atan2(dy, dx);
  }

  const moveDist = PLAYER_SPEED * FIXED_DT;
  const wallCollisionRadius = PLAYER_RADIUS - 1;

  // Solid colliders include vault walls plus closed mechanical Blast Doors
  const solidColliders: { x: number; y: number; w: number; h: number }[] = [
    ...state.level.walls,
  ];
  for (const gate of state.level.gates) {
    if (gate.isBlastDoor && (state.gateOpenProgress[gate.id] ?? 0) < 0.55) {
      solidColliders.push(gate);
    }
  }

  // Axis-separated sliding: X first, then Y
  const stepX = resolveCircleAgainstRects(
    state.player.x + dx * moveDist,
    state.player.y,
    wallCollisionRadius,
    solidColliders
  );
  const stepY = resolveCircleAgainstRects(
    stepX.x,
    stepX.y + dy * moveDist,
    wallCollisionRadius,
    solidColliders
  );

  const actualMoved = Math.hypot(
    stepY.x - state.player.x,
    stepY.y - state.player.y
  );
  state.player.x = stepY.x;
  state.player.y = stepY.y;
  if (actualMoved > 0.05) {
    state.player.walkPhase += actualMoved * 0.12;
    if (state.tick % 9 === 0) {
      spawnParticles(
        state,
        state.player.x - dx * 8,
        state.player.y - dy * 8,
        1,
        '#475569',
        8,
        24,
        1.8,
        2.8,
        0.16,
        0.28
      );
    }
  }

  // 4. Record player frame at current tick
  state.currentRecording.push({
    x: state.player.x,
    y: state.player.y,
    facing: state.player.facing,
    hasGold: state.player.hasGold,
  });

  // 5. Check Gold Case pickup(s) (single or multi-gold chapters)
  const goldCases = getLevelGoldCases(state.level);
  if (goldCases.length > 0 && !state.goldCollected) {
    if (!state.collectedGoldIds) {
      state.collectedGoldIds = new Set<number>();
    }
    for (let idx = 0; idx < goldCases.length; idx++) {
      if (state.collectedGoldIds.has(idx)) continue;
      const gc = goldCases[idx];
      const distSq =
        (state.player.x - gc.x) ** 2 + (state.player.y - gc.y) ** 2;
      const hitR = PLAYER_RADIUS + gc.radius;
      if (distSq <= hitR * hitR) {
        state.collectedGoldIds.add(idx);
        state.player.hasGold = true;
        state.goldCollected = state.collectedGoldIds.size >= goldCases.length;
        state.player.squashX = 1.2;
        state.player.squashY = 0.82;
        state.lastRadioEvent = 'GOLD_PICKUP';
        spawnParticles(state, gc.x, gc.y, 18, '#FFD166', 50, 175, 2.5, 5);
        events.push({ type: 'GOLD_PICKUP', x: gc.x, y: gc.y });
      }
    }
  }

  // 6. Check lethal hazards (active Laser Gates & Sweeping Lasers)
  let killedByLaser = false;

  for (const gate of state.level.gates) {
    if (gate.isBlastDoor) continue;
    // Gate is lethal when closed; forgiving open threshold (0.40) prevents unfair edges
    if ((state.gateOpenProgress[gate.id] ?? 0) < 0.4) {
      if (
        circleIntersectsRect(
          state.player.x,
          state.player.y,
          PLAYER_RADIUS - 2.5,
          gate.x,
          gate.y,
          gate.w,
          gate.h
        )
      ) {
        killedByLaser = true;
        break;
      }
    }
  }

  if (!killedByLaser) {
    const laserHitRadius = PLAYER_RADIUS - 2;
    const hitR2 = laserHitRadius * laserHitRadius;
    for (const laser of state.level.sweepingLasers) {
      const seg = getSweepingLaserSegment(laser, state.tick);
      if (
        distancePointToSegmentSq(
          state.player.x,
          state.player.y,
          seg.ax,
          seg.ay,
          seg.bx,
          seg.by
        ) <= hitR2
      ) {
        killedByLaser = true;
        break;
      }
    }
  }

  if (killedByLaser) {
    // Laser hit resets ONLY current run; previously saved echoes remain intact
    const hitX = state.player.x;
    const hitY = state.player.y;
    state.lastLaserHitPos = { x: hitX, y: hitY };
    spawnParticles(state, hitX, hitY, 24, '#EF4444', 65, 230, 2.5, 5.5);
    spawnParticles(state, hitX, hitY, 10, '#F8FAFC', 40, 150, 2, 3.5);
    state.shakeTimer = 0.35;
    state.shakeIntensity = 9;
    state.hitFlashTimer = 0.3;
    state.hitstopTimer = 0.05;
    state.loopNumber += 1;
    state.totalLoopsUsed += 1;
    state.lastRadioEvent = 'LASER_HIT';
    resetLoopToStart(state);
    events.push({ type: 'LASER_HIT', x: hitX, y: hitY });
    return events;
  }

  // 7. Check Exit Door / Tunnel completion
  const exit = state.level.exit;
  const meetsGoldReq = !state.level.requiresGold || state.goldCollected;
  if (
    meetsGoldReq &&
    circleIntersectsRect(
      state.player.x,
      state.player.y,
      PLAYER_RADIUS * 0.65,
      exit.x,
      exit.y,
      exit.w,
      exit.h
    )
  ) {
    if (state.level.isFinalDecoyChapter) {
      // Trigger 2-second cinematic freeze-frame as Blast Door slams shut
      state.freezeFrameActive = true;
      state.freezeFrameTimer = FREEZE_FRAME_DURATION;
      state.shakeTimer = 0.4;
      state.shakeIntensity = 11;
      for (const gate of state.level.gates) {
        if (gate.isBlastDoor) {
          spawnParticles(
            state,
            gate.x + gate.w * 0.5,
            gate.y + gate.h * 0.5,
            24,
            '#FFD166',
            50,
            210,
            2,
            5
          );
        }
      }
      events.push({ type: 'BLAST_DOOR_SLAM', x: state.player.x, y: state.player.y });
    } else {
      state.chapterCompleted = true;
      spawnParticles(
        state,
        exit.x + exit.w * 0.5,
        exit.y + exit.h * 0.5,
        20,
        '#FFD166',
        50,
        180,
        2.5,
        5
      );
      events.push({ type: 'CHAPTER_CLEAR', x: state.player.x, y: state.player.y });
    }
    return events;
  }

  // 8. Advance fixed tick and emit chronometer ticks / loop expiration rewind
  state.tick += 1;

  if (state.tick >= LOOP_TICKS) {
    saveCurrentEchoAndRestart(state);
    events.push({ type: 'REWIND', x: state.player.x, y: state.player.y });
  } else if (state.tick >= 420 && state.tick % 30 === 0) {
    // Under 3.00s: doubled tempo urgent tick
    events.push({ type: 'TICK_URGENT' });
  } else if (state.tick < 420 && state.tick % 60 === 0) {
    events.push({ type: 'TICK_SECOND' });
  }

  return events;
}

export function getRemainingSeconds(tick: number): number {
  return Math.max(0, (LOOP_TICKS - tick) * FIXED_DT);
}

export function computeHeistRank(totalLoopsUsed: number): 'S' | 'A' | 'B' {
  if (totalLoopsUsed <= 18) return 'S';
  if (totalLoopsUsed <= 24) return 'A';
  return 'B';
}

export function buildRunStatsSnapshot(state: GameState): RunStatsSnapshot {
  return {
    totalLoopsUsed: state.totalLoopsUsed,
    echoesLeftBehind: Math.max(state.totalEchoesCreated, state.echoes.length),
    totalHeistSeconds: state.totalElapsedSeconds,
    rank: computeHeistRank(state.totalLoopsUsed),
  };
}

/** Geometry utility exported for corridor clearance unit verification */
export function getAllWalls(levelIndex: number): Wall[] {
  return LEVELS[levelIndex]?.walls ?? [];
}
