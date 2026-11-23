import { CANVAS_HEIGHT, CANVAS_WIDTH, LevelDef, Wall } from '../types';
import { createTransmission } from './scriptEngine';

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
    script: {
      intro: createTransmission(
        'ARCHITECT',
        'Breathe, Kyoto. SWAT just sealed the perimeter—ten seconds is an eternity if you spend it twice.'
      ),
      firstEcho: createTransmission(
        'CHRONO_OS',
        'ECHO #1 ONLINE: Past trajectory mirrored. Weave past the print bay divider to reach the airlock.'
      ),
      laserHitPool: [
        createTransmission(
          'ARCHITECT',
          'Static thermal beam, Kyoto. Curve around the concrete pillars—do not rush the corner.'
        ),
        createTransmission(
          'CHRONO_OS',
          'TEMPORAL SNAP: Fatal laser contact aborted. Loop reset to entry coordinates.'
        ),
      ],
      overPar: createTransmission(
        'ARCHITECT',
        'This room is a one-loop sprint, Kyoto. Clear your head and thread the S-curve.'
      ),
      urgent: createTransmission(
        'CHRONO_OS',
        'CHRONOMETER CRITICAL: Under 2.5 seconds to temporal snapback.'
      ),
    },
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
    script: {
      intro: createTransmission(
        'ARCHITECT',
        'The Mint engineered a two-person biometric lock. Let ten-seconds-ago-you hold the door.'
      ),
      firstEcho: createTransmission(
        'ARCHITECT',
        'There goes your ghost. While Echo #1 locks Plate A, sprint straight through the bullion gate.'
      ),
      plateActive: createTransmission(
        'CHRONO_OS',
        'BIOMETRIC LOCK A ENGAGED: Press [R] now to anchor this echo on the pad and rewind.'
      ),
      laserHitPool: [
        createTransmission(
          'ARCHITECT',
          'Gate A stays lethal until an echo is standing on Plate A. Record the plate run first.'
        ),
        createTransmission(
          'CHRONO_OS',
          'GATE INTERLOCK ACTIVE: Deploy an echo on Plate A before breaching the east corridor.'
        ),
      ],
      overPar: createTransmission(
        'ARCHITECT',
        'Two loops is all it takes: Loop 1 holds Plate A, Loop 2 walks through the open gate.'
      ),
      urgent: createTransmission(
        'CHRONO_OS',
        'CHRONOMETER CRITICAL: Rewind imminent—anchor on Plate A or clear the doorway.'
      ),
    },
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
    plates: [{ id: 'plate-a', label: 'A', x: 210, y: 90, w: 60, h: 60 }],
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
    script: {
      intro: createTransmission(
        'ARCHITECT',
        'Chain the locks: Plate A opens the south cage housing Plate B. Three of you in one room—now we have a crew.'
      ),
      firstEcho: createTransmission(
        'VEGA',
        'This is Inspector Vega, SWAT Tactical! Thermal sensors show multiple heat signatures inside a sealed sector—surrender now!'
      ),
      plateActive: createTransmission(
        'ARCHITECT',
        'Ignore Vega. He is chasing ghosts from ten seconds ago. Lock the pad and rewind.'
      ),
      laserHitPool: [
        createTransmission(
          'VEGA',
          'Patrol grid tripped in Sector 3! We have them pinned behind the sweeping laser!'
        ),
        createTransmission(
          'ARCHITECT',
          'Stage just west of the vertical sweep, Kyoto. Cross as the beam recedes.'
        ),
      ],
      overPar: createTransmission(
        'CHRONO_OS',
        'PAR EXCEEDED: Echo 1 holds A, Echo 2 enters the south cage for B, Loop 3 slips past the sweep.'
      ),
      urgent: createTransmission(
        'VEGA',
        'Breach charges set on the outer doors! You are out of time in there!'
      ),
    },
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
    script: {
      intro: createTransmission(
        'ARCHITECT',
        'Royal Mint bullion reserve. Station echoes on Plates A and B so both vault chambers stand wide open.'
      ),
      firstEcho: createTransmission(
        'ARCHITECT',
        'Plate A covered. Now send Echo #2 up to Plate B before you make your run for the gold.'
      ),
      plateActive: createTransmission(
        'CHRONO_OS',
        'CHAMBER SEAL DISENGAGED: Press [R] to lock this echo on the pressure plate.'
      ),
      goldPickup: createTransmission(
        'VEGA',
        'Seismic sensors just tripped on the bullion pedestal! All units—storm the lower escape shaft!'
      ),
      laserHitPool: [
        createTransmission(
          'ARCHITECT',
          'That central laser sweeps every 4.2 seconds. Wait in the upper corridor until it heads west.'
        ),
        createTransmission(
          'VEGA',
          'You cannot outrun the vault lasers forever! Drop the briefcase!'
        ),
      ],
      overPar: createTransmission(
        'ARCHITECT',
        'Do not overcomplicate it: Echo 1 on A, Echo 2 on B, Loop 3 loots the top chamber and exits bottom-right.'
      ),
      urgent: createTransmission(
        'CHRONO_OS',
        'CHRONOMETER CRITICAL: 2.5s remaining—reach the lower escape shaft now!'
      ),
    },
    spawn: { x: 80, y: 270 },
    exit: { x: 842, y: 385, w: 72, h: 80, label: 'ESCAPE SHAFT' },
    requiresGold: true,
    goldCase: { x: 825, y: 125, radius: 18, label: 'BULLION' },
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
  // CHAPTER 5: THE SIGNAL HIJACK — PLAN ECLIPSE (Par: 3 loops · Dual-Plate AND Gate)
  // =========================================================================
  {
    chapter: 5,
    title: 'The Signal Hijack',
    planName: 'PLAN ECLIPSE',
    parLoops: 3,
    radioLine:
      'Wait—someone else is on this encrypted frequency. A second chronometer just spiked!',
    secondaryRadioLine:
      'Gate AB requires BOTH Plate A and Plate B held simultaneously. Thread the twin sweeps.',
    script: {
      intro: createTransmission(
        'OSLO',
        'Surprise, Kyoto. Did The Architect forget to mention he built two chronometers? I am cleaning out the East Wing right now.'
      ),
      firstEcho: createTransmission(
        'ARCHITECT',
        'Oslo stole the prototype watch in Berlin! Focus, Kyoto—that Dual-Lock Gate needs TWO echoes holding Plates A and B at the same time.'
      ),
      plateActive: createTransmission(
        'CHRONO_OS',
        'DUAL-INTERLOCK CIRCUIT: Both Plate A and Plate B must be active simultaneously to open Gate AB.'
      ),
      laserHitPool: [
        createTransmission(
          'OSLO',
          'Ouch! Watch those counter-phase twin lasers, Kyoto—or leave the Royal Mint to the Cobalt Crew.'
        ),
        createTransmission(
          'ARCHITECT',
          'Pause at the center midpoint (x: 540) between the two vertical sweeps before dashing through Gate AB.'
        ),
      ],
      overPar: createTransmission(
        'OSLO',
        'Still stuck on the East Wing interlock? By the time you reach the Royal Vault, the Crown will be mine.'
      ),
      urgent: createTransmission(
        'CHRONO_OS',
        'TEMPORAL INTERFERENCE: Dual chronometer waves detected—2.5s remaining!'
      ),
    },
    spawn: { x: 85, y: 270 },
    exit: { x: 845, y: 230, w: 72, h: 80, label: 'EAST WING AIRLOCK' },
    walls: [
      ...OUTER_WALLS,
      // Top-left baffle right of Plate A (leaves 210px center corridor y: 165..375)
      { x: 300, y: 20, w: 28, h: 145, material: 'steel' },
      // Bottom-left baffle right of Plate B
      { x: 300, y: 375, w: 28, h: 145, material: 'steel' },
      // Right partition flanking Dual-Lock Gate AB (opening y: 210..330 = 120px)
      { x: 740, y: 20, w: 30, h: 190, material: 'steel' },
      { x: 740, y: 330, w: 30, h: 190, material: 'steel' },
    ],
    plates: [
      { id: 'plate-a', label: 'A', x: 200, y: 80, w: 60, h: 60 },
      { id: 'plate-b', label: 'B', x: 200, y: 400, w: 60, h: 60 },
    ],
    gates: [
      {
        id: 'gate-ab',
        linkedPlateIds: ['plate-a', 'plate-b'],
        x: 747,
        y: 210,
        w: 16,
        h: 120,
        wireWaypoints: [
          { x: 230, y: 110 },
          { x: 350, y: 110 },
          { x: 350, y: 430 },
          { x: 230, y: 430 },
          { x: 350, y: 430 },
          { x: 350, y: 270 },
          { x: 755, y: 270 },
        ],
      },
    ],
    sweepingLasers: [
      // West vertical sweep (x: 380..515)
      {
        id: 'ch5-sweep-west',
        startA: { x: 380, y: 70 },
        startB: { x: 515, y: 70 },
        endA: { x: 380, y: 470 },
        endB: { x: 515, y: 470 },
        periodSeconds: 4.0,
        phaseOffset: -Math.PI / 2,
      },
      // East vertical sweep in counter-phase (x: 565..705)
      {
        id: 'ch5-sweep-east',
        startA: { x: 565, y: 70 },
        startB: { x: 705, y: 70 },
        endA: { x: 565, y: 470 },
        endB: { x: 705, y: 470 },
        periodSeconds: 4.0,
        phaseOffset: Math.PI / 2,
      },
    ],
  },

  // =========================================================================
  // CHAPTER 6: THE CROSSFIRE VAULT — PLAN PARADOX (Par: 4 loops · Twin Gold Cases)
  // =========================================================================
  {
    chapter: 6,
    title: 'The Crossfire Vault',
    planName: 'PLAN PARADOX',
    parLoops: 4,
    radioLine:
      'Oslo tripped the secondary vault locks! You need both North and South bullion cases to unlock the lift.',
    secondaryRadioLine:
      'Station 3 echoes on Plates A, B, and C—then sweep both gold vaults in a single 10-second run.',
    script: {
      intro: createTransmission(
        'ARCHITECT',
        'Oslo cut the primary lift cables! You must secure BOTH the North and South bullion cases in one timeline to counter-weight the lift.'
      ),
      firstEcho: createTransmission(
        'OSLO',
        'Two vaults, three laser gates, and ten seconds on the clock. Let us see if your echoes can keep up, Kyoto!'
      ),
      plateActive: createTransmission(
        'CHRONO_OS',
        'RELAY NODE LOCKED: Deploy echoes across Plates A, B, and C so both vaults and the lift exit stand open.'
      ),
      goldPickup: createTransmission(
        'ARCHITECT',
        'Bullion case secured! Keep sprinting—the lift requires both cases before the ten-second loop snaps back!'
      ),
      laserHitPool: [
        createTransmission(
          'VEGA',
          'Crossfire grid engaged in Sector 6! Neither of those thieves walks out of this building!'
        ),
        createTransmission(
          'ARCHITECT',
          'Unlock all three gates with echoes first so your fourth loop is a clean, unobstructed figure-eight.'
        ),
      ],
      overPar: createTransmission(
        'CHRONO_OS',
        'PAR STRATEGY: Loop 1->Plate A, Loop 2->Plate B, Loop 3->Plate C, Loop 4->North Gold + South Gold + Exit.'
      ),
      urgent: createTransmission(
        'OSLO',
        'Tick-tock, Kyoto! Two seconds left before your hands are empty again!'
      ),
    },
    spawn: { x: 80, y: 270 },
    exit: { x: 845, y: 230, w: 72, h: 80, label: 'CENTRAL LIFT' },
    requiresGold: true,
    goldCases: [
      { x: 540, y: 95, radius: 18, label: 'NORTH BULLION' },
      { x: 540, y: 445, radius: 18, label: 'SOUTH BULLION' },
    ],
    walls: [
      ...OUTER_WALLS,
      // North Gold Vault enclosure (x: 440..640, y: 20..180) with 120px bottom doorway (x: 480..600)
      { x: 440, y: 20, w: 28, h: 160, material: 'steel' },
      { x: 612, y: 20, w: 28, h: 160, material: 'steel' },
      { x: 468, y: 156, w: 12, h: 24, material: 'steel' },
      { x: 600, y: 156, w: 12, h: 24, material: 'steel' },
      // South Gold Vault enclosure (x: 440..640, y: 360..520) with 120px top doorway (x: 480..600)
      { x: 440, y: 360, w: 28, h: 160, material: 'steel' },
      { x: 612, y: 360, w: 28, h: 160, material: 'steel' },
      { x: 468, y: 360, w: 12, h: 24, material: 'steel' },
      { x: 600, y: 360, w: 12, h: 24, material: 'steel' },
      // Far-right partition flanking Exit Gate C (opening y: 210..330 = 120px)
      { x: 740, y: 20, w: 30, h: 190, material: 'steel' },
      { x: 740, y: 330, w: 30, h: 190, material: 'steel' },
    ],
    plates: [
      { id: 'plate-a', label: 'A', x: 150, y: 70, w: 60, h: 60 },
      { id: 'plate-b', label: 'B', x: 150, y: 410, w: 60, h: 60 },
      { id: 'plate-c', label: 'C', x: 310, y: 240, w: 60, h: 60 },
    ],
    gates: [
      {
        id: 'gate-a',
        linkedPlateIds: ['plate-a'],
        x: 480,
        y: 160,
        w: 120,
        h: 16,
        wireWaypoints: [
          { x: 180, y: 100 },
          { x: 400, y: 100 },
          { x: 400, y: 168 },
          { x: 540, y: 168 },
        ],
      },
      {
        id: 'gate-b',
        linkedPlateIds: ['plate-b'],
        x: 480,
        y: 364,
        w: 120,
        h: 16,
        wireWaypoints: [
          { x: 180, y: 440 },
          { x: 400, y: 440 },
          { x: 400, y: 372 },
          { x: 540, y: 372 },
        ],
      },
      {
        id: 'gate-c',
        linkedPlateIds: ['plate-c'],
        x: 747,
        y: 210,
        w: 16,
        h: 120,
        wireWaypoints: [
          { x: 340, y: 270 },
          { x: 755, y: 270 },
        ],
      },
    ],
    sweepingLasers: [],
  },

  // =========================================================================
  // CHAPTER 7: THE DECOY — PLAN ZERO (Par: 2 loops)
  // =========================================================================
  {
    chapter: 7,
    title: 'The Decoy',
    planName: 'PLAN ZERO',
    parLoops: 2,
    radioLine:
      'Plan Zero, Kyoto. Leave a ghost for the police—and walk out rich.',
    secondaryRadioLine:
      'Step inside the glass Decoy Chamber to hold the blast door. Then escape.',
    script: {
      intro: createTransmission(
        'ARCHITECT',
        'Plan Zero, Kyoto. Vega is breaching this corridor. Step inside the glass Decoy Chamber to leave a ghost for SWAT—then walk out rich.'
      ),
      firstEcho: createTransmission(
        'VEGA',
        'Breach team in position! Wait—I see the suspect standing inside the glass override chamber! Hold your fire, seal the room!'
      ),
      plateActive: createTransmission(
        'ARCHITECT',
        'Blast Door unlocked. Rewind now—your echo stays behind in the glass box while the real you slips into the escape tunnel.'
      ),
      laserHitPool: [
        createTransmission(
          'ARCHITECT',
          'Do not let the final sweep clip you inches from freedom. Time the beam and sprint through the Blast Door.'
        ),
        createTransmission(
          'OSLO',
          'Hurry up and ditch Vega, Kyoto! I am waiting for you in the Royal Vault for our six-loop showdown!'
        ),
      ],
      overPar: createTransmission(
        'CHRONO_OS',
        'FINAL PROTOCOL: Loop 1 holds Override Plate 0 inside the glass chamber; Loop 2 dashes past the beam into the tunnel.'
      ),
      urgent: createTransmission(
        'VEGA',
        'Tactical units—breach the glass chamber in two seconds!'
      ),
    },
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
        id: 'ch7-security-sweep',
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
