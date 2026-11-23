import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  Gate,
  Plate,
  RivalArenaId,
  SweepingLaser,
  Vec2,
  Wall,
} from '../types';

export interface RivalArenaDef {
  id: RivalArenaId;
  name: string;
  subtitle: string;
  p1Spawn: Vec2;
  p2Spawn: Vec2;
  walls: Wall[];
  plates: Plate[];
  gates: Gate[];
  baseLasers: SweepingLaser[];
  loop6ExtraLaser: SweepingLaser;
  vaultGoldCoords: Vec2[];
  diamondDropCoord: Vec2;
  corridorDropCoords: Vec2[];
  crownSpawnCoord: Vec2;
}

const BORDER = 20;

const OUTER_PERIMETER: Wall[] = [
  { x: 0, y: 0, w: CANVAS_WIDTH, h: BORDER, material: 'steel' },
  {
    x: 0,
    y: CANVAS_HEIGHT - BORDER,
    w: CANVAS_WIDTH,
    h: BORDER,
    material: 'steel',
  },
  {
    x: 0,
    y: BORDER,
    w: BORDER,
    h: CANVAS_HEIGHT - BORDER * 2,
    material: 'steel',
  },
  {
    x: CANVAS_WIDTH - BORDER,
    y: BORDER,
    w: BORDER,
    h: CANVAS_HEIGHT - BORDER * 2,
    material: 'steel',
  },
];

// ============================================================================
// SECTOR I: ROYAL BULLION HALL (Balanced Classic)
// ============================================================================
const BULLION_HALL: RivalArenaDef = {
  id: 'BULLION_HALL',
  name: 'ROYAL BULLION HALL',
  subtitle: 'Classic symmetric vault with flanking highways',
  p1Spawn: { x: 138, y: 270 },
  p2Spawn: { x: 822, y: 270 },
  walls: [
    ...OUTER_PERIMETER,
    // Symmetric tactical cover baffles
    { x: 192, y: 175, w: 84, h: 24, material: 'steel' },
    { x: 192, y: 341, w: 84, h: 24, material: 'steel' },
    { x: 684, y: 175, w: 84, h: 24, material: 'steel' },
    { x: 684, y: 341, w: 84, h: 24, material: 'steel' },
    // Center Royal Vault walls (x: 360..600, y: 120..420)
    { x: 360, y: 120, w: 240, h: 24, material: 'steel' },
    { x: 360, y: 396, w: 240, h: 24, material: 'steel' },
    // Left vault doorway flanking Gate L (opening y: 215..325 = 110px)
    { x: 360, y: 144, w: 24, h: 71, material: 'steel' },
    { x: 360, y: 325, w: 24, h: 71, material: 'steel' },
    // Right vault doorway flanking Gate R (opening y: 215..325 = 110px)
    { x: 576, y: 144, w: 24, h: 71, material: 'steel' },
    { x: 576, y: 325, w: 24, h: 71, material: 'steel' },
  ],
  plates: [
    { id: 'plate-left', label: 'A', x: 205, y: 78, w: 58, h: 58 },
    { id: 'plate-right', label: 'B', x: 697, y: 404, w: 58, h: 58 },
  ],
  gates: [
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
  ],
  baseLasers: [
    {
      id: 'rival-sweep-h',
      startA: { x: 404, y: 152 },
      startB: { x: 404, y: 388 },
      endA: { x: 556, y: 152 },
      endB: { x: 556, y: 388 },
      periodSeconds: 4.4,
      phaseOffset: 0,
    },
  ],
  loop6ExtraLaser: {
    id: 'rival-sweep-v',
    startA: { x: 392, y: 160 },
    startB: { x: 568, y: 160 },
    endA: { x: 392, y: 380 },
    endB: { x: 568, y: 380 },
    periodSeconds: 3.8,
    phaseOffset: Math.PI / 2,
  },
  vaultGoldCoords: [
    { x: 428, y: 196 },
    { x: 480, y: 196 },
    { x: 532, y: 196 },
    { x: 428, y: 344 },
    { x: 480, y: 344 },
    { x: 532, y: 344 },
  ],
  diamondDropCoord: { x: 480, y: 270 },
  corridorDropCoords: [
    { x: 480, y: 70 },
    { x: 480, y: 470 },
  ],
  crownSpawnCoord: { x: 480, y: 270 },
};

// ============================================================================
// SECTOR II: THE LASER ROTUNDA (High-Hazard Crossfire)
// ============================================================================
const LASER_ROTUNDA: RivalArenaDef = {
  id: 'LASER_ROTUNDA',
  name: 'THE LASER ROTUNDA',
  subtitle: 'Wide central ring with faster crisscrossing beams',
  p1Spawn: { x: 138, y: 270 },
  p2Spawn: { x: 822, y: 270 },
  walls: [
    ...OUTER_PERIMETER,
    // Symmetric wing cover pillars
    { x: 210, y: 120, w: 36, h: 72, material: 'steel' },
    { x: 714, y: 348, w: 36, h: 72, material: 'steel' },
    // Wide Rotunda Vault enclosure (x: 340..620, y: 110..430)
    { x: 340, y: 110, w: 280, h: 24, material: 'steel' },
    { x: 340, y: 406, w: 280, h: 24, material: 'steel' },
    { x: 340, y: 134, w: 24, h: 81, material: 'steel' },
    { x: 340, y: 325, w: 24, h: 81, material: 'steel' },
    { x: 596, y: 134, w: 24, h: 81, material: 'steel' },
    { x: 596, y: 325, w: 24, h: 81, material: 'steel' },
    // Corner chamfer pillars inside rotunda
    { x: 364, y: 134, w: 26, h: 26, material: 'steel' },
    { x: 570, y: 134, w: 26, h: 26, material: 'steel' },
    { x: 364, y: 380, w: 26, h: 26, material: 'steel' },
    { x: 570, y: 380, w: 26, h: 26, material: 'steel' },
  ],
  plates: [
    { id: 'plate-left', label: 'A', x: 205, y: 404, w: 58, h: 58 },
    { id: 'plate-right', label: 'B', x: 697, y: 78, w: 58, h: 58 },
  ],
  gates: [
    {
      id: 'gate-left',
      linkedPlateIds: ['plate-left'],
      x: 344,
      y: 215,
      w: 16,
      h: 110,
      wireWaypoints: [
        { x: 234, y: 433 },
        { x: 306, y: 433 },
        { x: 306, y: 270 },
        { x: 352, y: 270 },
      ],
    },
    {
      id: 'gate-right',
      linkedPlateIds: ['plate-right'],
      x: 600,
      y: 215,
      w: 16,
      h: 110,
      wireWaypoints: [
        { x: 726, y: 107 },
        { x: 654, y: 107 },
        { x: 654, y: 270 },
        { x: 608, y: 270 },
      ],
    },
  ],
  baseLasers: [
    {
      id: 'rotunda-sweep-h',
      startA: { x: 396, y: 146 },
      startB: { x: 396, y: 394 },
      endA: { x: 564, y: 146 },
      endB: { x: 564, y: 394 },
      periodSeconds: 3.8,
      phaseOffset: 0,
    },
  ],
  loop6ExtraLaser: {
    id: 'rotunda-sweep-v',
    startA: { x: 376, y: 168 },
    startB: { x: 584, y: 168 },
    endA: { x: 376, y: 372 },
    endB: { x: 584, y: 372 },
    periodSeconds: 3.4,
    phaseOffset: Math.PI / 2,
  },
  vaultGoldCoords: [
    { x: 424, y: 190 },
    { x: 480, y: 168 },
    { x: 536, y: 190 },
    { x: 424, y: 350 },
    { x: 480, y: 372 },
    { x: 536, y: 350 },
  ],
  diamondDropCoord: { x: 480, y: 270 },
  corridorDropCoords: [
    { x: 480, y: 65 },
    { x: 480, y: 475 },
  ],
  crownSpawnCoord: { x: 480, y: 270 },
};

// ============================================================================
// SECTOR III: TWIN LOCKDOWN VAULTS (Split Objective + Central Bridge)
// ============================================================================
const TWIN_VAULTS: RivalArenaDef = {
  id: 'TWIN_VAULTS',
  name: 'TWIN LOCKDOWN VAULTS',
  subtitle: 'North & South vaults across a contested central bridge',
  p1Spawn: { x: 138, y: 270 },
  p2Spawn: { x: 822, y: 270 },
  walls: [
    ...OUTER_PERIMETER,
    // Symmetric flank cover baffles
    { x: 200, y: 185, w: 68, h: 22, material: 'steel' },
    { x: 692, y: 333, w: 68, h: 22, material: 'steel' },
    // North Vault (x: 370..590, y: 20..195) with 110px south gate opening (x: 425..535)
    { x: 370, y: 20, w: 24, h: 175, material: 'steel' },
    { x: 566, y: 20, w: 24, h: 175, material: 'steel' },
    { x: 394, y: 171, w: 31, h: 24, material: 'steel' },
    { x: 535, y: 171, w: 31, h: 24, material: 'steel' },
    // South Vault (x: 370..590, y: 345..520) with 110px north gate opening (x: 425..535)
    { x: 370, y: 345, w: 24, h: 175, material: 'steel' },
    { x: 566, y: 345, w: 24, h: 175, material: 'steel' },
    { x: 394, y: 345, w: 31, h: 24, material: 'steel' },
    { x: 535, y: 345, w: 31, h: 24, material: 'steel' },
  ],
  plates: [
    { id: 'plate-left', label: 'A', x: 205, y: 404, w: 58, h: 58 },
    { id: 'plate-right', label: 'B', x: 697, y: 78, w: 58, h: 58 },
  ],
  gates: [
    {
      id: 'gate-left',
      linkedPlateIds: ['plate-left'],
      x: 425,
      y: 175,
      w: 110,
      h: 16,
      wireWaypoints: [
        { x: 234, y: 433 },
        { x: 325, y: 433 },
        { x: 325, y: 183 },
        { x: 480, y: 183 },
      ],
    },
    {
      id: 'gate-right',
      linkedPlateIds: ['plate-right'],
      x: 425,
      y: 349,
      w: 110,
      h: 16,
      wireWaypoints: [
        { x: 726, y: 107 },
        { x: 635, y: 107 },
        { x: 635, y: 357 },
        { x: 480, y: 357 },
      ],
    },
  ],
  baseLasers: [
    {
      id: 'twin-bridge-sweep-h',
      startA: { x: 382, y: 206 },
      startB: { x: 382, y: 334 },
      endA: { x: 578, y: 206 },
      endB: { x: 578, y: 334 },
      periodSeconds: 4.0,
      phaseOffset: 0,
    },
  ],
  loop6ExtraLaser: {
    id: 'twin-bridge-sweep-v',
    startA: { x: 385, y: 214 },
    startB: { x: 575, y: 214 },
    endA: { x: 385, y: 326 },
    endB: { x: 575, y: 326 },
    periodSeconds: 3.6,
    phaseOffset: Math.PI / 2,
  },
  vaultGoldCoords: [
    { x: 430, y: 95 },
    { x: 480, y: 95 },
    { x: 530, y: 95 },
    { x: 430, y: 445 },
    { x: 480, y: 445 },
    { x: 530, y: 445 },
  ],
  diamondDropCoord: { x: 480, y: 270 },
  corridorDropCoords: [
    { x: 270, y: 270 },
    { x: 690, y: 270 },
  ],
  crownSpawnCoord: { x: 480, y: 270 },
};

export const RIVAL_ARENAS: Record<RivalArenaId, RivalArenaDef> = {
  BULLION_HALL,
  LASER_ROTUNDA,
  TWIN_VAULTS,
};

export const RIVAL_ARENA_LIST: RivalArenaDef[] = [
  BULLION_HALL,
  LASER_ROTUNDA,
  TWIN_VAULTS,
];
