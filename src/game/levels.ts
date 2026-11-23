import { CANVAS_HEIGHT, CANVAS_WIDTH, LevelDef, Wall } from '../types';

const BORDER_THICKNESS = 20;

const OUTER_WALLS: Wall[] = [
  { x: 0, y: 0, w: CANVAS_WIDTH, h: BORDER_THICKNESS, material: 'steel' },
  {
    x: 0,
    y: CANVAS_HEIGHT - BORDER_THICKNESS,
    w: CANVAS_WIDTH,
    h: BORDER_THICKNESS,
    material: 'steel',
  },
  {
    x: 0,
    y: BORDER_THICKNESS,
    w: BORDER_THICKNESS,
    h: CANVAS_HEIGHT - BORDER_THICKNESS * 2,
    material: 'steel',
  },
  {
    x: CANVAS_WIDTH - BORDER_THICKNESS,
    y: BORDER_THICKNESS,
    w: BORDER_THICKNESS,
    h: CANVAS_HEIGHT - BORDER_THICKNESS * 2,
    material: 'steel',
  },
];

export const LEVELS: LevelDef[] = [
  // =========================================================================
  // CHAPTER 1: THE PRINT ROOM — PLAN ALPHA (Par: 1 loop, ~5s S-curve)
  // =========================================================================
  {
    chapter: 1,
    title: 'The Print Room',
    planName: 'PLAN ALPHA',
    parLoops: 1,
    radioLine:
      'Breathe, Kyoto. Ten seconds is an eternity if you spend it twice.',
    secondaryRadioLine:
      'Weave past the print bay divider before the chronometer snaps back.',
    spawn: { x: 90, y: 270 },
    exit: { x: 840, y: 230, w: 72, h: 80, label: 'VAULT AIRLOCK' },
    walls: [
      ...OUTER_WALLS,
      // Upper-left offset pillar: leaves 190px corridor below (y: 330..520)
      { x: 240, y: 20, w: 60, h: 310, material: 'steel' },
      // Emitter anchor post for static divider laser: leaves 180px corridor above (y: 20..200)
      { x: 465, y: 200, w: 30, h: 30, material: 'steel' },
      // Lower-right offset pillar: leaves 180px corridor above (y: 20..200)
      { x: 660, y: 200, w: 60, h: 320, material: 'steel' },
    ],
    plates: [],
    gates: [],
    sweepingLasers: [
      // Static crimson laser divider dropping from anchor post to bottom wall
      {
        id: 'ch1-static-divider',
        startA: { x: 480, y: 230 },
        startB: { x: 480, y: 520 },
        endA: { x: 480, y: 230 },
        endB: { x: 480, y: 520 },
        periodSeconds: 0,
      },
    ],
  },

  // =========================================================================
  // CHAPTER 2: BIOMETRIC GATE — PLAN MIRROR (Par: 2 loops)
  // =========================================================================
  {
    chapter: 2,
    title: 'Biometric Gate',
    planName: 'PLAN MIRROR',
    parLoops: 2,
    radioLine:
      'The Mint expects a crew. Let ten-seconds-ago-you hold the door.',
    secondaryRadioLine:
      'Stand on Plate A, press R to rewind, then sprint past your echo.',
    spawn: { x: 90, y: 270 },
    exit: { x: 840, y: 230, w: 72, h: 80, label: 'BULLION HALL' },
    walls: [
      ...OUTER_WALLS,
      // Alcove divider below Plate A: left gap x=20..160 (140px), right gap x=420..670 (250px)
      { x: 160, y: 190, w: 260, h: 30, material: 'steel' },
      // Lower security pillar: leaves 120px middle lane (y: 220..340) & 100px lower lane (y: 420..520)
      { x: 420, y: 340, w: 80, h: 80, material: 'steel' },
      // Right corridor partition flanking Gate A (opening y: 210..330 = 120px)
      { x: 670, y: 20, w: 30, h: 190, material: 'steel' },
      { x: 670, y: 330, w: 30, h: 190, material: 'steel' },
    ],
    plates: [
      { id: 'plate-a', label: 'A', x: 210, y: 90, w: 60, h: 60 },
    ],
    gates: [
      {
        id: 'gate-a',
        linkedPlateIds: ['plate-a'],
        x: 677,
        y: 210,
        w: 16,
        h: 120,
        wireWaypoints: [
          { x: 240, y: 120 },
          { x: 580, y: 120 },
          { x: 580, y: 270 },
          { x: 685, y: 270 },
        ],
      },
    ],
    sweepingLasers: [],
  },

  // =========================================================================
  // CHAPTER 3: THE LASER CAGE — PLAN DOMINO (Par: 3 loops)
  // =========================================================================
  {
    chapter: 3,
    title: 'The Laser Cage',
    planName: 'PLAN DOMINO',
    parLoops: 3,
    radioLine: 'Three of you in the same room. Now we have a real heist.',
    secondaryRadioLine:
      'Echo 1 holds Plate A. Echo 2 claims Plate B. You slip past the sweep.',
    spawn: { x: 80, y: 270 },
    exit: { x: 850, y: 230, w: 72, h: 80, label: 'INNER VAULT' },
    walls: [
      ...OUTER_WALLS,
      // Guide partition right of Plate A (opening y: 170..350 = 180px)
      { x: 260, y: 20, w: 30, h: 150, material: 'steel' },
      // Bottom-center chamber housing Plate B (entry Gate A: x=390..500 = 110px wide)
      { x: 320, y: 350, w: 30, h: 170, material: 'steel' },
      { x: 560, y: 350, w: 30, h: 170, material: 'steel' },
      { x: 350, y: 350, w: 40, h: 28, material: 'steel' },
      { x: 500, y: 350, w: 60, h: 28, material: 'steel' },
      // Far-right partition flanking Gate B (opening y: 210..330 = 120px)
      { x: 740, y: 20, w: 30, h: 190, material: 'steel' },
      { x: 740, y: 330, w: 30, h: 190, material: 'steel' },
    ],
    plates: [
      { id: 'plate-a', label: 'A', x: 150, y: 70, w: 60, h: 60 },
      { id: 'plate-b', label: 'B', x: 425, y: 425, w: 60, h: 60 },
    ],
    gates: [
      {
        id: 'gate-a',
        linkedPlateIds: ['plate-a'],
        x: 390,
        y: 356,
        w: 110,
        h: 16,
        wireWaypoints: [
          { x: 180, y: 100 },
          { x: 180, y: 240 },
          { x: 445, y: 240 },
          { x: 445, y: 364 },
        ],
      },
      {
        id: 'gate-b',
        linkedPlateIds: ['plate-b'],
        x: 747,
        y: 210,
        w: 16,
        h: 120,
        wireWaypoints: [
          { x: 455, y: 455 },
          { x: 665, y: 455 },
          { x: 665, y: 270 },
          { x: 755, y: 270 },
        ],
      },
    ],
    sweepingLasers: [
      // Horizontal laser bar sweeping vertically along the east-central security lane (x: 598..732)
      {
        id: 'ch3-vertical-sweep',
        startA: { x: 598, y: 80 },
        startB: { x: 732, y: 80 },
        endA: { x: 598, y: 420 },
        endB: { x: 732, y: 420 },
        periodSeconds: 4.2,
        phaseOffset: -Math.PI / 2,
      },
    ],
  },

  // =========================================================================
  // CHAPTER 4: THE GOLD VAULT — PLAN MIDAS (Par: 3 loops)
  // =========================================================================
  {
    chapter: 4,
    title: 'The Gold Vault',
    planName: 'PLAN MIDAS',
    parLoops: 3,
    radioLine:
      "You have the gold. Don't celebrate—SWAT just breached the lobby.",
    secondaryRadioLine:
      'Hold Plates A and B with echoes, grab the bullion, and clear the vault.',
    spawn: { x: 80, y: 270 },
    exit: { x: 842, y: 385, w: 72, h: 80, label: 'ESCAPE SHAFT' },
    requiresGold: true,
    goldCase: { x: 825, y: 125, radius: 18 },
    walls: [
      ...OUTER_WALLS,
      // Bottom-left nook wall beside Plate A (upper open y: 20..350)
      { x: 250, y: 350, w: 30, h: 170, material: 'steel' },
      // Top-center canopy wall below Plate B (left gap x=20..340, right gap x=560..670 = 110px)
      { x: 340, y: 170, w: 220, h: 28, material: 'steel' },
      // Horizontal floor divider between top-right Gold Chamber & bottom-right Exit Chamber
      { x: 670, y: 255, w: 270, h: 30, material: 'steel' },
      // Vertical chamber front walls flanking Gate A (y: 75..185 = 110px) and Gate B (y: 370..480 = 110px)
      { x: 670, y: 20, w: 30, h: 55, material: 'steel' },
      { x: 670, y: 185, w: 30, h: 70, material: 'steel' },
      { x: 670, y: 285, w: 30, h: 85, material: 'steel' },
      { x: 670, y: 480, w: 30, h: 40, material: 'steel' },
    ],
    plates: [
      { id: 'plate-a', label: 'A', x: 130, y: 415, w: 60, h: 60 },
      { id: 'plate-b', label: 'B', x: 420, y: 65, w: 60, h: 60 },
    ],
    gates: [
      {
        id: 'gate-a',
        linkedPlateIds: ['plate-a'],
        x: 677,
        y: 75,
        w: 16,
        h: 110,
        wireWaypoints: [
          { x: 160, y: 445 },
          { x: 160, y: 270 },
          { x: 610, y: 270 },
          { x: 610, y: 130 },
          { x: 685, y: 130 },
        ],
      },
      {
        id: 'gate-b',
        linkedPlateIds: ['plate-b'],
        x: 677,
        y: 370,
        w: 16,
        h: 110,
        wireWaypoints: [
          { x: 450, y: 95 },
          { x: 635, y: 95 },
          { x: 635, y: 425 },
          { x: 685, y: 425 },
        ],
      },
    ],
    sweepingLasers: [
      // Vertical laser beam sweeping horizontally across the central hall (x: 340..645)
      {
        id: 'ch4-central-sweep',
        startA: { x: 340, y: 206 },
        startB: { x: 340, y: 342 },
        endA: { x: 645, y: 206 },
        endB: { x: 645, y: 342 },
        periodSeconds: 4.2,
        phaseOffset: -Math.PI / 2,
      },
    ],
  },

  // =========================================================================
  // CHAPTER 5: THE DECOY — PLAN ZERO (Par: 2 loops)
  // =========================================================================
  {
    chapter: 5,
    title: 'The Decoy',
    planName: 'PLAN ZERO',
    parLoops: 2,
    radioLine:
      'Plan Zero, Kyoto. Leave a ghost for the police—and walk out rich.',
    secondaryRadioLine:
      'Step inside the glass Decoy Chamber to hold the blast door. Then escape.',
    spawn: { x: 80, y: 270 },
    exit: { x: 845, y: 230, w: 74, h: 80, label: 'ESCAPE TUNNEL' },
    isFinalDecoyChapter: true,
    walls: [
      ...OUTER_WALLS,
      // Central glass-walled Decoy Chamber (x: 340..560, y: 170..370)
      // Leaves 150px corridors above (y: 20..170) and below (y: 370..520)
      { x: 340, y: 170, w: 220, h: 20, material: 'glass' },
      { x: 340, y: 350, w: 220, h: 20, material: 'glass' },
      { x: 540, y: 170, w: 20, h: 200, material: 'glass' },
      // Left doorway into Decoy Chamber (opening y: 220..320 = 100px)
      { x: 340, y: 170, w: 20, h: 50, material: 'glass' },
      { x: 340, y: 320, w: 20, h: 50, material: 'glass' },
      // Final Blast Door partition at x: 770 (opening y: 210..330 = 120px)
      { x: 770, y: 20, w: 30, h: 190, material: 'steel' },
      { x: 770, y: 330, w: 30, h: 190, material: 'steel' },
    ],
    plates: [
      { id: 'plate-override', label: '0', x: 420, y: 240, w: 60, h: 60 },
    ],
    gates: [
      {
        id: 'blast-door',
        linkedPlateIds: ['plate-override'],
        x: 774,
        y: 210,
        w: 22,
        h: 120,
        isBlastDoor: true,
        wireWaypoints: [
          { x: 450, y: 270 },
          { x: 785, y: 270 },
        ],
      },
    ],
    sweepingLasers: [
      // Sweeping security beam patrolling east of the Decoy Chamber
      {
        id: 'ch5-security-sweep',
        startA: { x: 590, y: 75 },
        startB: { x: 745, y: 75 },
        endA: { x: 590, y: 465 },
        endB: { x: 745, y: 465 },
        periodSeconds: 3.4,
        phaseOffset: Math.PI / 2,
      },
    ],
  },
];
