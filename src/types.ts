export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
export const TILE_SIZE = 60;
export const FIXED_FPS = 60;
export const FIXED_DT = 1 / FIXED_FPS;
export const LOOP_DURATION_SECONDS = 10;
export const LOOP_TICKS = FIXED_FPS * LOOP_DURATION_SECONDS; // 600 ticks
export const PLAYER_SPEED = 220; // px/s
export const PLAYER_RADIUS = 15;
export const MAX_ECHOES = 5;
export const MIN_MANUAL_REWIND_TICKS = 15;
export const FREEZE_FRAME_DURATION = 2.0; // seconds for Chapter 5 climax

export type ScreenPhase =
  | 'TITLE'
  | 'CHAPTER_CARD'
  | 'PLAYING'
  | 'PAUSED'
  | 'FREEZE_FRAME'
  | 'ENDING';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  material?: 'steel' | 'glass';
}

export interface Plate {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Gate {
  id: string;
  linkedPlateIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  isBlastDoor?: boolean;
  /** Optional wire routing waypoints from plate center to gate center */
  wireWaypoints?: Vec2[];
}

export interface SweepingLaser {
  id: string;
  /** Start endpoints of the beam when phase = -1 (or static if endA === startA and endB === startB) */
  startA: Vec2;
  startB: Vec2;
  /** End endpoints of the beam when phase = +1 */
  endA: Vec2;
  endB: Vec2;
  /** Full oscillation cycle in seconds (0 = static laser) */
  periodSeconds: number;
  /** Initial phase offset in radians */
  phaseOffset?: number;
}

export interface GoldCaseDef {
  x: number;
  y: number;
  radius: number;
}

export interface ExitDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface LevelDef {
  chapter: number;
  title: string;
  planName: string;
  parLoops: number;
  radioLine: string;
  secondaryRadioLine?: string;
  spawn: Vec2;
  exit: ExitDef;
  requiresGold?: boolean;
  goldCase?: GoldCaseDef;
  isFinalDecoyChapter?: boolean;
  walls: Wall[];
  plates: Plate[];
  gates: Gate[];
  sweepingLasers: SweepingLaser[];
}

export interface RecordedFrame {
  x: number;
  y: number;
  facing: number;
  hasGold: boolean;
}

export interface EchoRecording {
  id: number;
  frames: RecordedFrame[];
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface LaserSegment {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export type SimEventType =
  | 'TICK_SECOND'
  | 'TICK_URGENT'
  | 'PLATE_ON'
  | 'PLATE_OFF'
  | 'REWIND'
  | 'LASER_HIT'
  | 'GOLD_PICKUP'
  | 'CHAPTER_CLEAR'
  | 'BLAST_DOOR_SLAM'
  | 'CLEAR_ECHOES';

export interface SimEvent {
  type: SimEventType;
  x?: number;
  y?: number;
}

export interface PlayerState {
  x: number;
  y: number;
  facing: number;
  hasGold: boolean;
  walkPhase: number;
  squashX: number;
  squashY: number;
}

export interface GameState {
  levelIndex: number;
  level: LevelDef;
  tick: number; // 0..599
  loopNumber: number; // 1-based within current room
  player: PlayerState;
  currentRecording: RecordedFrame[];
  echoes: EchoRecording[];
  nextEchoId: number;
  activePlateIds: Set<string>;
  gateOpenProgress: Record<string, number>; // 0 (closed) to 1 (open)
  goldCollected: boolean;
  /** Visual feedback timers in seconds */
  shakeTimer: number;
  shakeIntensity: number;
  hitFlashTimer: number;
  hitstopTimer: number;
  rewindFlashTimer: number;
  lastLaserHitPos: Vec2 | null;
  /** Freeze frame state for Chapter 5 climax */
  freezeFrameActive: boolean;
  freezeFrameTimer: number;
  /** Cumulative run stats across all chapters */
  totalLoopsUsed: number;
  totalEchoesCreated: number;
  totalElapsedSeconds: number;
  /** Room completion flag consumed by shell */
  chapterCompleted: boolean;
  /** Fixed pooled particles */
  particles: Particle[];
  particleCursor: number;
}

export interface RunStatsSnapshot {
  totalLoopsUsed: number;
  echoesLeftBehind: number;
  totalHeistSeconds: number;
  rank: 'S' | 'A' | 'B';
}

// ============================================================================
// RIVAL HEIST (2P / VS AI BOT) TYPES & CONSTANTS
// ============================================================================

export type GameMode = 'STORY' | 'RIVAL';
export type RivalTeam = 'P1' | 'P2';
export type RivalRole = 'GUARD' | 'HACKER' | 'RUNNER';
export type RivalPhase = 'PLAYING' | 'ASSIGN_DUTY' | 'PAUSED' | 'ENDING';

export const RIVAL_TOTAL_LOOPS = 6;
export const RIVAL_MAX_ECHOES_PER_PLAYER = 4;
export const RIVAL_CARRY_SPEED_MULT = 0.85; // -15% speed while carrying gold
export const RIVAL_GUARD_STUN_SECONDS = 1.2;
export const RIVAL_RUNNER_SPEED_MULT = 1.2;
export const RIVAL_ASSIGN_DURATION_SECONDS = 3.0;

export interface RivalStashDef {
  team: RivalTeam;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RivalGoldItem {
  id: string;
  x: number;
  y: number;
  value: 1 | 3;
  isCrown: boolean;
  location: 'VAULT' | 'FLOOR' | 'CARRIED' | 'BANKED';
  carrierId: string | null; // 'P1', 'P2', or echo string id
}

export interface RivalPlayerState {
  team: RivalTeam;
  name: string;
  x: number;
  y: number;
  facing: number;
  carriedGoldId: string | null;
  stunTimer: number;
  stunImmunityTimer: number;
  stealCooldown: number;
  walkPhase: number;
  squashX: number;
  squashY: number;
  hitFlashTimer: number;
}

export interface RivalEcho {
  id: string;
  team: RivalTeam;
  role: RivalRole;
  frames: RecordedFrame[];
  x: number;
  y: number;
  facing: number;
  carriedGoldId: string | null;
  stunTimer: number;
  stunImmunityTimer: number;
  stealCooldown: number;
}

export interface RivalStatsSnapshot {
  p1Score: number;
  p2Score: number;
  p1Stolen: number;
  p2Stolen: number;
  p1Stuns: number;
  p2Stuns: number;
  p1EchoesDeployed: number;
  p2EchoesDeployed: number;
  winner: 'P1' | 'P2' | 'DRAW';
  vsBot: boolean;
}

export interface RivalSimEvent {
  type:
    | 'TICK_SECOND'
    | 'TICK_URGENT'
    | 'PLATE_ON'
    | 'PLATE_OFF'
    | 'GOLD_PICKUP'
    | 'GOLD_BANK'
    | 'GOLD_STEAL'
    | 'GUARD_STUN'
    | 'LASER_HIT'
    | 'LOOP_END'
    | 'CROWN_SPAWN'
    | 'MATCH_END';
  team?: RivalTeam;
  x?: number;
  y?: number;
}

export interface RivalGameState {
  loopNumber: number; // 1..6
  tick: number; // 0..599
  vsBot: boolean;
  p1: RivalPlayerState;
  p2: RivalPlayerState;
  p1Recording: RecordedFrame[];
  p2Recording: RecordedFrame[];
  p1Echoes: RivalEcho[];
  p2Echoes: RivalEcho[];
  nextEchoSeq: number;
  walls: Wall[];
  plates: Plate[];
  gates: Gate[];
  stashes: { P1: RivalStashDef; P2: RivalStashDef };
  activePlateIds: Set<string>;
  gateOpenProgress: Record<string, number>;
  goldItems: RivalGoldItem[];
  p1Score: number;
  p2Score: number;
  p1Stolen: number;
  p2Stolen: number;
  p1Stuns: number;
  p2Stuns: number;
  p1EchoesDeployed: number;
  p2EchoesDeployed: number;
  shakeTimer: number;
  shakeIntensity: number;
  rewindFlashTimer: number;
  bannerText: string | null;
  bannerTimer: number;
  matchEnded: boolean;
  awaitingDutyAssignment: boolean;
  particles: Particle[];
  particleCursor: number;
}

