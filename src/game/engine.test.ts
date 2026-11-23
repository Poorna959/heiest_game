import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAllEchoes,
  computeHeistRank,
  createInitialGameState,
  getEchoFrameAtTick,
  getSweepingLaserSegment,
  stepSimulation,
  triggerManualRewind,
} from './engine';
import {
  SPEAKER_PROFILES,
  createTransmission,
  getStoryEndingEditorial,
  resolveRivalBanter,
  resolveStoryRadioTransmission,
} from './scriptEngine';
import { createInitialRivalState } from './rivalEngine';
import { LEVELS } from './levels';
import {
  GameState,
  InputState,
  LOOP_TICKS,
  MAX_ECHOES,
  Vec2,
} from '../types';

const IDLE: InputState = { up: false, down: false, left: false, right: false };

function steerToward(
  state: GameState,
  target: Vec2,
  maxTicks = 600,
  tolerance = 14
): { reached: boolean; hitLaser: boolean; completed: boolean } {
  for (let i = 0; i < maxTicks; i++) {
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    if (Math.hypot(dx, dy) <= tolerance) {
      return {
        reached: true,
        hitLaser: false,
        completed: state.chapterCompleted || state.freezeFrameActive,
      };
    }
    const input: InputState = {
      left: dx < -4,
      right: dx > 4,
      up: dy < -4,
      down: dy > 4,
    };
    const events = stepSimulation(state, input);
    if (events.some((e) => e.type === 'LASER_HIT')) {
      return { reached: false, hitLaser: true, completed: false };
    }
    if (state.chapterCompleted || state.freezeFrameActive) {
      return { reached: true, hitLaser: false, completed: true };
    }
  }
  return { reached: false, hitLaser: false, completed: false };
}

function waitTicks(state: GameState, ticks: number): boolean {
  for (let i = 0; i < ticks; i++) {
    const events = stepSimulation(state, IDLE);
    if (events.some((e) => e.type === 'LASER_HIT')) return false;
  }
  return true;
}

test('All 5 chapters have valid wide corridors (>= 60px) and clean spawns', () => {
  assert.equal(LEVELS.length, 5);
  for (const lvl of LEVELS) {
    // Verify spawn does not overlap any wall
    for (const w of lvl.walls) {
      const overlapsSpawn =
        lvl.spawn.x + 15 > w.x &&
        lvl.spawn.x - 15 < w.x + w.w &&
        lvl.spawn.y + 15 > w.y &&
        lvl.spawn.y - 15 < w.y + w.h;
      assert.equal(
        overlapsSpawn,
        false,
        `Chapter ${lvl.chapter} spawn overlaps wall`
      );
    }
    // Verify all gates have >= 100px passable opening width/height
    for (const g of lvl.gates) {
      const opening = Math.max(g.w, g.h);
      assert.ok(
        opening >= 100,
        `Chapter ${lvl.chapter} gate ${g.id} opening ${opening}px < 100px`
      );
    }
  }
});

test('Chapter 1 (PLAN ALPHA) is solvable in 1 loop within 10 seconds', () => {
  const state = createInitialGameState(0);
  const waypoints: Vec2[] = [
    { x: 270, y: 425 },
    { x: 400, y: 120 },
    { x: 690, y: 110 },
    { x: 875, y: 270 },
  ];
  for (const wp of waypoints) {
    const res = steerToward(state, wp);
    assert.equal(res.hitLaser, false, 'Should not hit laser in Ch1');
    if (res.completed) break;
  }
  assert.equal(state.chapterCompleted, true);
  assert.equal(state.loopNumber, 1);
  assert.ok(state.tick < LOOP_TICKS, 'Must finish under 600 ticks');
});

test('Chapter 2 (PLAN MIRROR) is solvable in 2 loops with Echo holding Plate A', () => {
  const state = createInitialGameState(1);

  // Loop 1: Go around alcove to Plate A (240, 120) and trigger manual rewind
  assert.equal(steerToward(state, { x: 90, y: 120 }).reached, true);
  assert.equal(steerToward(state, { x: 240, y: 120 }).reached, true);
  assert.equal(state.activePlateIds.has('plate-a'), true);

  const rewindEvents = triggerManualRewind(state);
  assert.equal(rewindEvents[0]?.type, 'REWIND');
  assert.equal(state.echoes.length, 1);
  assert.equal(state.loopNumber, 2);

  // Loop 2: Sprint directly through open Gate A to Exit
  // Wait briefly until Echo #1 reaches Plate A (or run straight — arrive after echo!)
  const res = steerToward(state, { x: 875, y: 270 });
  assert.equal(res.hitLaser, false, 'Gate A should be open when Kyoto arrives');
  assert.equal(state.chapterCompleted, true);
  assert.equal(state.loopNumber, 2);
});

test('Chapter 3 (PLAN DOMINO) is solvable in 3 loops with chained echoes + sweep timing', () => {
  const state = createInitialGameState(2);

  // Loop 1: Hold Plate A (180, 100)
  assert.equal(steerToward(state, { x: 180, y: 100 }).reached, true);
  assert.equal(state.activePlateIds.has('plate-a'), true);
  triggerManualRewind(state);
  assert.equal(state.echoes.length, 1);

  // Loop 2: Pass open Gate A into bottom chamber and hold Plate B (455, 455)
  assert.equal(steerToward(state, { x: 445, y: 270 }).reached, true);
  assert.equal(steerToward(state, { x: 445, y: 455 }).reached, true);
  assert.equal(state.activePlateIds.has('plate-b'), true);
  triggerManualRewind(state);
  assert.equal(state.echoes.length, 2);

  // Loop 3: Stage safely west of sweeping beam, cross when beam is away and moving away from y=270, enter Exit
  assert.equal(steerToward(state, { x: 545, y: 270 }).reached, true);
  const sweep = state.level.sweepingLasers[0];
  while (state.tick < 500) {
    const segNow = getSweepingLaserSegment(sweep, state.tick);
    const segNext = getSweepingLaserSegment(sweep, state.tick + 1);
    const movingUpAbove = segNow.ay < 210 && segNext.ay <= segNow.ay;
    const movingDownBelow = segNow.ay > 330 && segNext.ay >= segNow.ay;
    if (movingUpAbove || movingDownBelow) break;
    assert.equal(waitTicks(state, 1), true);
  }
  const res = steerToward(state, { x: 885, y: 270 });
  assert.equal(res.hitLaser, false, 'Should slip past sweeping laser cleanly');
  assert.equal(state.chapterCompleted, true);
  assert.equal(state.loopNumber, 3);
});

test('Chapter 4 (PLAN MIDAS) is solvable in 3 loops collecting Gold Case then exiting', () => {
  const state = createInitialGameState(3);

  // Loop 1: Hold Plate A (160, 445)
  assert.equal(steerToward(state, { x: 160, y: 445 }).reached, true);
  assert.equal(state.activePlateIds.has('plate-a'), true);
  triggerManualRewind(state);

  // Loop 2: Hold Plate B (450, 95)
  assert.equal(steerToward(state, { x: 200, y: 95 }).reached, true);
  assert.equal(steerToward(state, { x: 450, y: 95 }).reached, true);
  assert.equal(state.activePlateIds.has('plate-b'), true);
  triggerManualRewind(state);

  // Loop 3: Run upper route -> Gold Case -> wait for sweep moving left -> sprint down -> Exit
  assert.equal(steerToward(state, { x: 250, y: 115 }).reached, true);
  assert.equal(steerToward(state, { x: 630, y: 115 }).reached, true);
  assert.equal(steerToward(state, { x: 825, y: 125 }).reached, true);
  assert.equal(state.goldCollected, true);

  // Exit gold chamber to safe staging point (625, 130)
  assert.equal(steerToward(state, { x: 625, y: 130 }).reached, true);
  const sweep = state.level.sweepingLasers[0];
  while (state.tick < 520) {
    const segNow = getSweepingLaserSegment(sweep, state.tick);
    const segNext = getSweepingLaserSegment(sweep, state.tick + 1);
    if (segNow.ax < 540 && segNext.ax <= segNow.ax) break;
    assert.equal(waitTicks(state, 1), true);
  }
  assert.equal(steerToward(state, { x: 625, y: 425 }).reached, true);
  const res = steerToward(state, { x: 875, y: 425 });
  assert.equal(res.hitLaser, false);
  assert.equal(state.chapterCompleted, true);
  assert.equal(state.loopNumber, 3);
});

test('Chapter 5 (PLAN ZERO) is solvable in 2 loops and triggers 2-second freeze-frame', () => {
  const state = createInitialGameState(4);

  // Loop 1: Enter glass Decoy Chamber and hold Override Plate (450, 270)
  assert.equal(steerToward(state, { x: 450, y: 270 }).reached, true);
  assert.equal(state.activePlateIds.has('plate-override'), true);
  triggerManualRewind(state);
  assert.equal(state.echoes.length, 1);

  // Loop 2: Go above Decoy Chamber, pass sweeping beam cleanly, run through Blast Door to Escape Tunnel
  assert.equal(steerToward(state, { x: 250, y: 95 }).reached, true);
  assert.equal(steerToward(state, { x: 550, y: 95 }).reached, true);

  const sweep = state.level.sweepingLasers[0];
  while (state.tick < 500) {
    const seg = getSweepingLaserSegment(sweep, state.tick);
    if (seg.ay > 340) break;
    assert.equal(waitTicks(state, 1), true);
  }
  assert.equal(steerToward(state, { x: 675, y: 270 }).reached, true);
  const res = steerToward(state, { x: 882, y: 270 });
  assert.equal(res.hitLaser, false);
  assert.equal(state.freezeFrameActive, true, 'Freeze-frame must trigger on Escape Tunnel');
  assert.equal(state.chapterCompleted, false, 'Should hold during 2s freeze-frame');

  // Tick through 2.0s freeze-frame (120 ticks)
  for (let i = 0; i < 125; i++) {
    stepSimulation(state, IDLE);
  }
  assert.equal(state.freezeFrameActive, false);
  assert.equal(state.chapterCompleted, true);
});

test('Laser death preserves existing echoes without saving dead echo, R triggers 0.25s VHS flash, and C clears cleanly', () => {
  const state = createInitialGameState(1);
  // Record 1 echo via manual R rewind
  waitTicks(state, 25);
  const rewindEv = triggerManualRewind(state);
  assert.equal(rewindEv[0]?.type, 'REWIND');
  assert.equal(state.rewindFlashTimer, 0.25, 'Manual R rewind must trigger 0.25s VHS flash');
  assert.equal(state.echoes.length, 1);
  const savedEchoId = state.echoes[0].id;
  const savedFrameCount = state.echoes[0].frames.length;

  // Walk into closed Gate A in Chapter 2 to die by laser
  const res = steerToward(state, { x: 700, y: 270 });
  assert.equal(res.hitLaser, true);
  assert.equal(state.echoes.length, 1, 'Laser death must NOT save a dead echo and must preserve existing echo');
  assert.equal(state.echoes[0].id, savedEchoId);
  assert.equal(state.echoes[0].frames.length, savedFrameCount);
  assert.equal(state.tick, 0, 'Tick resets to 0 on laser death');
  assert.ok(state.hitFlashTimer > 0, 'Laser death triggers red hit flash');
  assert.ok(state.lastLaserHitPos !== null, 'Laser death records impact coordinates');

  // Pressing C clears all echoes cleanly
  clearAllEchoes(state);
  assert.equal(state.echoes.length, 0);
  assert.equal(state.tick, 0);
});

test('Echo FIFO cap at 5, early rewind anchoring, and rank thresholds', () => {
  const state = createInitialGameState(0);
  for (let i = 0; i < 6; i++) {
    waitTicks(state, 20);
    triggerManualRewind(state);
  }
  assert.equal(state.echoes.length, MAX_ECHOES);
  assert.equal(state.echoes[0].id, 2, 'Oldest echo #1 dropped when #6 added');

  // Early rewind anchoring: frame at tick 500 equals last recorded frame
  const anchored = getEchoFrameAtTick(state.echoes[0], 500);
  const lastFrame = state.echoes[0].frames[state.echoes[0].frames.length - 1];
  assert.deepEqual(anchored, lastFrame);

  assert.equal(computeHeistRank(10), 'S');
  assert.equal(computeHeistRank(11), 'A');
  assert.equal(computeHeistRank(15), 'A');
  assert.equal(computeHeistRank(16), 'B');
});

test('Task 1: Speaker profiles and event-driven Story Radio transmissions resolve by priority', () => {
  assert.equal(SPEAKER_PROFILES.ARCHITECT.tag, '[THE ARCHITECT]');
  assert.equal(SPEAKER_PROFILES.VEGA.tag, '[SWAT // VEGA]');
  assert.equal(SPEAKER_PROFILES.OSLO.tag, '[OSLO // RIVAL]');
  assert.equal(SPEAKER_PROFILES.CHRONO_OS.tag, '[CHRONO-OS]');

  const state = createInitialGameState(3); // Chapter 4 (has gold case & plates)
  state.level = {
    ...state.level,
    script: {
      intro: createTransmission('ARCHITECT', 'Intro briefing line.'),
      firstEcho: createTransmission('ARCHITECT', 'First echo deployed line.'),
      plateActive: createTransmission('VEGA', 'SWAT sees gate power routing.'),
      goldPickup: createTransmission('VEGA', 'Seismic alarm on bullion case!'),
      laserHitPool: [
        createTransmission('ARCHITECT', 'Watch the beam, Kyoto.'),
        createTransmission('OSLO', 'Sloppy footwork, old friend.'),
      ],
      overPar: createTransmission('CHRONO_OS', 'Par threshold exceeded.'),
      urgent: createTransmission('CHRONO_OS', 'Chronometer critical: 2.5s.'),
    },
  };

  // 1. Default intro on Loop 1
  const introTx = resolveStoryRadioTransmission(state, null);
  assert.equal(introTx.speaker, 'ARCHITECT');
  assert.equal(introTx.text, 'Intro briefing line.');

  // 2. First echo deployed on Loop 2
  waitTicks(state, 20);
  triggerManualRewind(state);
  const echoTx = resolveStoryRadioTransmission(state, 'REWIND');
  assert.equal(echoTx.text, 'First echo deployed line.');

  // 3. Plate activation priority
  state.activePlateIds.add('plate-a');
  const plateTx = resolveStoryRadioTransmission(state, 'PLATE_ON');
  assert.equal(plateTx.speaker, 'VEGA');
  assert.equal(plateTx.text, 'SWAT sees gate power routing.');

  // 4. Gold pickup outranks plate active
  state.goldCollected = true;
  const goldTx = resolveStoryRadioTransmission(state, 'GOLD_PICKUP');
  assert.equal(goldTx.speaker, 'VEGA');
  assert.equal(goldTx.text, 'Seismic alarm on bullion case!');

  // 5. Laser hit rotates deterministically through laserHitPool
  const hitTx1 = resolveStoryRadioTransmission(state, 'LASER_HIT');
  assert.ok(
    hitTx1.text === 'Watch the beam, Kyoto.' ||
      hitTx1.text === 'Sloppy footwork, old friend.'
  );
  state.totalLoopsUsed += 1;
  const hitTx2 = resolveStoryRadioTransmission(state, 'LASER_HIT');
  assert.notEqual(hitTx1.text, hitTx2.text);

  // 6. Over-par fallback when no higher-priority state is active
  state.goldCollected = false;
  state.activePlateIds.clear();
  state.loopNumber = state.level.parLoops + 2;
  const overParTx = resolveStoryRadioTransmission(state, null);
  assert.equal(overParTx.speaker, 'CHRONO_OS');
  assert.equal(overParTx.text, 'Par threshold exceeded.');

  // 7. Urgent timer (< 2.5s remaining -> tick >= 455)
  state.tick = 480;
  const urgentTx = resolveStoryRadioTransmission(state, 'TICK_URGENT');
  assert.equal(urgentTx.speaker, 'CHRONO_OS');
  assert.equal(urgentTx.text, 'Chronometer critical: 2.5s.');
});

test('Task 1: Rival PvP banter and Rank S/A/B newspaper editorials resolve distinctly', () => {
  const rivalState = createInitialRivalState(true);

  const stealBanter = resolveRivalBanter(rivalState, {
    type: 'GOLD_STEAL',
    team: 'P1',
  });
  assert.ok(stealBanter !== null);
  assert.ok(stealBanter.text.length > 10);

  const tackleBanter = resolveRivalBanter(rivalState, {
    type: 'DASH_TACKLE',
    team: 'P2',
  });
  assert.ok(tackleBanter !== null);
  assert.equal(tackleBanter.speaker, 'OSLO');

  const crownBanter = resolveRivalBanter(rivalState, {
    type: 'CROWN_SPAWN',
  });
  assert.ok(crownBanter !== null);
  assert.equal(crownBanter.speaker, 'ARCHITECT');

  const editS = getStoryEndingEditorial({
    totalLoopsUsed: 10,
    echoesLeftBehind: 6,
    totalHeistSeconds: 65,
    rank: 'S',
  });
  const editA = getStoryEndingEditorial({
    totalLoopsUsed: 14,
    echoesLeftBehind: 9,
    totalHeistSeconds: 95,
    rank: 'A',
  });
  const editB = getStoryEndingEditorial({
    totalLoopsUsed: 22,
    echoesLeftBehind: 17,
    totalHeistSeconds: 140,
    rank: 'B',
  });

  assert.notEqual(editS.headline, editA.headline);
  assert.notEqual(editA.headline, editB.headline);
  assert.notEqual(editS.stamp, editB.stamp);
});
