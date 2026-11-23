import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRivalStatsSnapshot,
  chooseBotEchoDuty,
  commitEchoDutiesAndStartNextLoop,
  computeBotInput,
  createInitialRivalState,
  getActiveRivalLasers,
  stepRivalSimulation,
} from './rivalEngine';
import { RIVAL_ARENAS, RIVAL_ARENA_LIST } from './rivalMaps';
import {
  CANVAS_WIDTH,
  InputState,
  LOOP_TICKS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RIVAL_CARRY_SPEED_MULT,
  RIVAL_GUARD_STUN_SECONDS,
  RIVAL_MAX_ECHOES_PER_PLAYER,
} from '../types';

const IDLE: InputState = { up: false, down: false, left: false, right: false };

test('Rival Heist starts symmetrically with 6 Vault Gold Bars and 1 sweeping center laser', () => {
  const state = createInitialRivalState(false);
  assert.equal(state.loopNumber, 1);
  assert.equal(state.goldItems.length, 6);
  assert.equal(
    state.goldItems.every((g) => g.location === 'VAULT' && g.value === 1),
    true
  );
  assert.equal(getActiveRivalLasers(1).length, 1);
  // Symmetric horizontal placement across center x=480
  assert.equal(state.p1.x + state.p2.x, 960);
  assert.equal(state.p1.y, state.p2.y);
});

test('Carrying gold applies -15% movement speed penalty and banking increments score', () => {
  const state = createInitialRivalState(false);
  // Measure normal 1-tick horizontal speed
  const startX = state.p1.x;
  stepRivalSimulation(state, { ...IDLE, right: true }, IDLE);
  const normalStep = state.p1.x - startX;

  // Give P1 a carried gold bar and measure 1-tick step
  const bar = state.goldItems[0];
  bar.location = 'CARRIED';
  bar.carrierId = 'P1';
  state.p1.carriedGoldId = bar.id;
  const carryStartX = state.p1.x;
  stepRivalSimulation(state, { ...IDLE, right: true }, IDLE);
  const carryStep = state.p1.x - carryStartX;

  assert.ok(
    Math.abs(carryStep / normalStep - RIVAL_CARRY_SPEED_MULT) < 0.01,
    `Expected carry speed mult ~0.85, got ${carryStep / normalStep}`
  );
  assert.ok(Math.abs(normalStep - PLAYER_SPEED / 60) < 0.05);

  // Move P1 to own stash to bank
  state.p1.x = 70;
  state.p1.y = 270;
  const ev = stepRivalSimulation(state, IDLE, IDLE);
  assert.equal(ev.some((e) => e.type === 'GOLD_BANK'), true);
  assert.equal(state.p1Score, 1);
  assert.equal(state.p1.carriedGoldId, null);
});

test('Player can steal 1 gold bar directly from rival Stash when rival has banked gold', () => {
  const state = createInitialRivalState(false);
  state.p2Score = 2;
  // Place P1 directly inside P2's right stash
  state.p1.x = 890;
  state.p1.y = 270;
  const ev = stepRivalSimulation(state, IDLE, IDLE);
  assert.equal(ev.some((e) => e.type === 'GOLD_STEAL'), true);
  assert.equal(state.p2Score, 1);
  assert.equal(state.p1Stolen, 1);
  assert.ok(state.p1.carriedGoldId !== null);
});

test('HACKER echo activates biometric plate to open Gate L while GUARD stuns rival for 1.2s and drops gold', () => {
  const state = createInitialRivalState(false);

  // Record a synthetic loop where P1 sits on Plate A (234, 107) and P2 sits at (480, 270)
  for (let t = 0; t < LOOP_TICKS; t++) {
    state.p1Recording.push({ x: 234, y: 107, facing: 0, hasGold: false });
    state.p2Recording.push({ x: 300, y: 270, facing: Math.PI, hasGold: false });
  }
  state.awaitingDutyAssignment = true;
  commitEchoDutiesAndStartNextLoop(state, 'HACKER', 'GUARD');

  assert.equal(state.loopNumber, 2);
  assert.equal(state.p1Echoes[0].role, 'HACKER');
  assert.equal(state.p2Echoes[0].role, 'GUARD');

  // Give P1 a gold bar and place P1 directly onto P2's GUARD echo position (300, 270)
  const bar = state.goldItems[0];
  bar.location = 'CARRIED';
  bar.carrierId = 'P1';
  state.p1.carriedGoldId = bar.id;
  state.p1.x = 300;
  state.p1.y = 270;

  const events = stepRivalSimulation(state, IDLE, IDLE);

  // HACKER echo must activate plate-left
  assert.equal(state.activePlateIds.has('plate-left'), true);
  // GUARD echo must stun P1 for 1.2s and knock carried gold onto floor
  assert.equal(events.some((e) => e.type === 'GUARD_STUN'), true);
  assert.equal(state.p1.stunTimer, RIVAL_GUARD_STUN_SECONDS);
  assert.equal(state.p1.carriedGoldId, null);
  assert.equal(bar.location, 'FLOOR');
  assert.equal(state.p2Stuns, 1);
});

test('RUNNER echo replays at 1.2x speed, auto-grabs gold bar, and banks it at own stash', () => {
  const state = createInitialRivalState(false);

  // Synthetic path for P1: starts at gold-1 (428, 196) for 30 frames then returns to P1 stash (70, 270)
  for (let t = 0; t < 120; t++) {
    const pt = t < 60 ? { x: 428, y: 196 } : { x: 70, y: 270 };
    state.p1Recording.push({ x: pt.x, y: pt.y, facing: 0, hasGold: false });
    state.p2Recording.push({ x: 822, y: 270, facing: Math.PI, hasGold: false });
  }
  state.awaitingDutyAssignment = true;
  commitEchoDutiesAndStartNextLoop(state, 'RUNNER', 'RUNNER');

  // At tick 50, at 1.2x speed frame index = 60 -> already at stash (70, 270)!
  for (let t = 0; t < 55; t++) {
    stepRivalSimulation(state, IDLE, IDLE);
  }
  assert.equal(state.p1Score, 1, 'Runner echo must auto-grab vault bar and bank at P1 stash');
});

test('Loop 6 spawns 2 sweeping lasers + 3-point Golden Crown, and echoes cap at 4 per player', () => {
  const state = createInitialRivalState(true);

  for (let loop = 1; loop < 6; loop++) {
    for (let t = 0; t < 30; t++) {
      state.p1Recording.push({ x: 138, y: 270, facing: 0, hasGold: false });
      state.p2Recording.push({ x: 822, y: 270, facing: Math.PI, hasGold: false });
    }
    state.awaitingDutyAssignment = true;
    commitEchoDutiesAndStartNextLoop(state, 'RUNNER', 'RUNNER');
  }

  assert.equal(state.loopNumber, 6);
  assert.equal(state.p1Echoes.length, RIVAL_MAX_ECHOES_PER_PLAYER);
  assert.equal(state.p2Echoes.length, RIVAL_MAX_ECHOES_PER_PLAYER);
  assert.equal(getActiveRivalLasers(6).length, 2, 'Loop 6 must have 2 sweeping lasers');

  const crown = state.goldItems.find((g) => g.isCrown);
  assert.ok(crown, 'Loop 6 must spawn 3-point Golden Crown');
  assert.equal(crown.value, 3);

  // Test banking Crown awards 3 points and determines winner cleanly
  crown.location = 'CARRIED';
  crown.carrierId = 'P1';
  state.p1.carriedGoldId = crown.id;
  state.p1.x = 70;
  state.p1.y = 270;
  stepRivalSimulation(state, IDLE, IDLE);
  assert.equal(state.p1Score, 3);

  const stats = buildRivalStatsSnapshot(state);
  assert.equal(stats.winner, 'P1');
  assert.equal(stats.vsBot, true);
});

test('AI Bot actively steers toward Plate B on Loop 1 and chooses HACKER duty', () => {
  const state = createInitialRivalState(true);
  for (let t = 0; t < 180; t++) {
    const botInput = computeBotInput(state);
    assert.ok(
      botInput.left ||
        botInput.right ||
        botInput.up ||
        botInput.down ||
        state.activePlateIds.has('plate-right')
    );
    stepRivalSimulation(state, IDLE, IDLE);
  }
  assert.equal(state.activePlateIds.has('plate-right'), true, 'AI Bot should reach Plate B on Loop 1');
  assert.equal(chooseBotEchoDuty(state), 'HACKER');
});

test('Task 3: All 3 Rival PvP Arenas are horizontally symmetric with clean spawns, >=100px gates, and valid gold drops', () => {
  assert.equal(RIVAL_ARENA_LIST.length, 3);
  assert.ok(RIVAL_ARENAS.BULLION_HALL);
  assert.ok(RIVAL_ARENAS.LASER_ROTUNDA);
  assert.ok(RIVAL_ARENAS.TWIN_VAULTS);

  for (const arena of RIVAL_ARENA_LIST) {
    // Symmetric spawns across center x = 480
    assert.equal(
      arena.p1Spawn.x + arena.p2Spawn.x,
      CANVAS_WIDTH,
      `${arena.id}: spawns must mirror across x=480`
    );
    assert.equal(
      arena.p1Spawn.y,
      arena.p2Spawn.y,
      `${arena.id}: spawns must share y coordinate`
    );

    // Neither spawn overlaps any wall
    for (const spawn of [arena.p1Spawn, arena.p2Spawn]) {
      for (const w of arena.walls) {
        const overlaps =
          spawn.x + PLAYER_RADIUS > w.x &&
          spawn.x - PLAYER_RADIUS < w.x + w.w &&
          spawn.y + PLAYER_RADIUS > w.y &&
          spawn.y - PLAYER_RADIUS < w.y + w.h;
        assert.equal(overlaps, false, `${arena.id}: spawn overlaps wall`);
      }
    }

    // All gates have >= 100px opening
    assert.ok(arena.gates.length >= 2, `${arena.id}: must have at least 2 gates`);
    for (const g of arena.gates) {
      assert.ok(
        Math.max(g.w, g.h) >= 100,
        `${arena.id}: gate ${g.id} opening must be >= 100px`
      );
    }

    // Symmetric plate placement (sum of center X == 960)
    assert.equal(arena.plates.length, 2, `${arena.id}: must have 2 plates`);
    const p1CenterX = arena.plates[0].x + arena.plates[0].w * 0.5;
    const p2CenterX = arena.plates[1].x + arena.plates[1].w * 0.5;
    assert.equal(
      p1CenterX + p2CenterX,
      CANVAS_WIDTH,
      `${arena.id}: plates must mirror horizontally`
    );

    // 6 initial vault gold coords, 2 corridor drop coords, none overlapping walls
    assert.equal(arena.vaultGoldCoords.length, 6);
    assert.equal(arena.corridorDropCoords.length, 2);
    for (const pt of [
      ...arena.vaultGoldCoords,
      arena.diamondDropCoord,
      ...arena.corridorDropCoords,
      arena.crownSpawnCoord,
    ]) {
      for (const w of arena.walls) {
        const insideWall =
          pt.x + 10 > w.x &&
          pt.x - 10 < w.x + w.w &&
          pt.y + 10 > w.y &&
          pt.y - 10 < w.y + w.h;
        assert.equal(
          insideWall,
          false,
          `${arena.id}: gold drop (${pt.x},${pt.y}) overlaps wall`
        );
      }
    }
  }
});
