import {
  FIXED_DT,
  GameState,
  LevelScriptDef,
  LOOP_TICKS,
  RadioSpeaker,
  RadioSpeakerProfile,
  RadioTransmission,
  RivalGameState,
  RivalSimEvent,
  RunStatsSnapshot,
  SimEventType,
  StoryEndingEditorial,
} from '../types';

export const SPEAKER_PROFILES: Record<RadioSpeaker, RadioSpeakerProfile> = {
  ARCHITECT: {
    speaker: 'ARCHITECT',
    tag: '[THE ARCHITECT]',
    color: '#E63946',
    blipFreq: 1020,
  },
  VEGA: {
    speaker: 'VEGA',
    tag: '[SWAT // VEGA]',
    color: '#3B82F6',
    blipFreq: 680,
  },
  OSLO: {
    speaker: 'OSLO',
    tag: '[OSLO // RIVAL]',
    color: '#38BDF8',
    blipFreq: 1340,
  },
  CHRONO_OS: {
    speaker: 'CHRONO_OS',
    tag: '[CHRONO-OS]',
    color: '#FFD166',
    blipFreq: 880,
  },
};

export function createTransmission(
  speaker: RadioSpeaker,
  text: string
): RadioTransmission {
  const profile = SPEAKER_PROFILES[speaker];
  return {
    speaker: profile.speaker,
    tag: profile.tag,
    color: profile.color,
    text,
  };
}

const DEFAULT_LASER_HIT_POOL: RadioTransmission[] = [
  createTransmission(
    'ARCHITECT',
    'Thermal beam clipped you. Your echoes survived—adjust your timing.'
  ),
  createTransmission(
    'CHRONO_OS',
    'TEMPORAL SNAP: Fatal laser contact aborted. Returning to loop origin.'
  ),
  createTransmission(
    'VEGA',
    'We saw that grid spike inside the vault! Keep tightening the perimeter!'
  ),
];

function buildFallbackScript(state: GameState): LevelScriptDef {
  return {
    intro: createTransmission('ARCHITECT', state.level.radioLine),
    firstEcho: state.level.secondaryRadioLine
      ? createTransmission('ARCHITECT', state.level.secondaryRadioLine)
      : undefined,
    plateActive: createTransmission(
      'ARCHITECT',
      'Biometric circuit locked. Move before the chronometer expires.'
    ),
    goldPickup: createTransmission(
      'VEGA',
      'Vault sensors show the bullion was just lifted! Breach the inner doors!'
    ),
    laserHitPool: DEFAULT_LASER_HIT_POOL,
    overPar: createTransmission(
      'CHRONO_OS',
      'Loop count exceeds Mastermind Par. Press C if you need a clean slate.'
    ),
    urgent: createTransmission(
      'CHRONO_OS',
      'WARNING: Chronometer below 2.5s. Prepare for temporal snapback.'
    ),
  };
}

/**
 * Resolves the highest-priority Story Mode radio transmission based on
 * discrete simulation events and current room state.
 */
export function resolveStoryRadioTransmission(
  state: GameState,
  lastEvent: SimEventType | null = null
): RadioTransmission {
  const script: LevelScriptDef = state.level.script ?? buildFallbackScript(state);
  const remainingSec = Math.max(0, (LOOP_TICKS - state.tick) * FIXED_DT);

  // 1. Immediate laser death reaction (rotates deterministically across loops)
  if (lastEvent === 'LASER_HIT') {
    const pool =
      script.laserHitPool && script.laserHitPool.length > 0
        ? script.laserHitPool
        : DEFAULT_LASER_HIT_POOL;
    const idx = Math.abs(state.totalLoopsUsed + state.loopNumber) % pool.length;
    return pool[idx];
  }

  // 2. Urgent countdown warning (< 2.5s remaining)
  if (
    !state.freezeFrameActive &&
    (lastEvent === 'TICK_URGENT' || remainingSec < 2.5) &&
    remainingSec < 2.5 &&
    script.urgent
  ) {
    return script.urgent;
  }

  // 3. Bullion secured milestone
  if ((lastEvent === 'GOLD_PICKUP' || state.goldCollected) && script.goldPickup) {
    return script.goldPickup;
  }

  // 4. Biometric plate unlocked milestone
  if (
    (lastEvent === 'PLATE_ON' || state.activePlateIds.size > 0) &&
    script.plateActive
  ) {
    return script.plateActive;
  }

  // 5. Over-par pressure commentary
  if (state.loopNumber > state.level.parLoops && script.overPar) {
    return script.overPar;
  }

  // 6. First echo deployed (Loop 2+)
  if (
    (lastEvent === 'REWIND' || state.loopNumber >= 2) &&
    state.echoes.length >= 1 &&
    script.firstEcho
  ) {
    return script.firstEcho;
  }

  // 7. Default chapter briefing
  return script.intro;
}

/**
 * Generates live multi-speaker commentary for Rival Heist (Kyoto vs. Oslo) PvP events.
 */
export function resolveRivalBanter(
  state: RivalGameState,
  event: RivalSimEvent
): RadioTransmission | null {
  switch (event.type) {
    case 'CROWN_SPAWN':
      return createTransmission(
        'ARCHITECT',
        'Final ten seconds. The 3-point Royal Crown is unlocked—take everything.'
      );
    case 'DIAMOND_SPAWN':
      return createTransmission(
        'CHRONO_OS',
        'VAULT DROP: 2-Point Diamond Briefcase deployed in the central chamber.'
      );
    case 'CORRIDOR_DROP':
      return createTransmission(
        'VEGA',
        'Armored transport spilled bullion in the outer corridors! Seal the flanks!'
      );
    case 'GOLD_STEAL':
      return event.team === 'P1'
        ? createTransmission(
            'ARCHITECT',
            'Clean raid, Kyoto. Oslo left the cobalt stash unguarded.'
          )
        : createTransmission(
            'OSLO',
            'Thanks for the bullion, Kyoto. Try stationing a Hacker on your stash.'
          );
    case 'DASH_TACKLE':
      return event.team === 'P1'
        ? createTransmission(
            'ARCHITECT',
            'Direct chrono-tackle! Oslo dropped the loot—grab it and run.'
          )
        : createTransmission(
            'OSLO',
            'Too slow, Kyoto! That bullion belongs to the Cobalt Crew.'
          );
    case 'GUARD_STUN':
      return event.team === 'P1'
        ? createTransmission(
            'ARCHITECT',
            'Oslo walked straight into your Guard echo. Five-second-old trap.'
          )
        : createTransmission(
            'OSLO',
            'My Guard echo says hello, Kyoto. Enjoy the stun.'
          );
    case 'ECHO_ZAPPED':
      return createTransmission(
        'CHRONO_OS',
        'ECHO DISRUPTED: Runner clipped an active laser gate and dropped its load.'
      );
    case 'LASER_HIT':
      return event.team === 'P1'
        ? createTransmission(
            'OSLO',
            'Careful with the security beams, Kyoto! Leave the vault to a professional.'
          )
        : createTransmission(
            'ARCHITECT',
            'Oslo just got vaporized by the security grid. Capitalize now!'
          );
    case 'GOLD_BANK':
      if (state.p1Score > state.p2Score && event.team === 'P1') {
        return createTransmission(
          'ARCHITECT',
          `Crimson Crew takes the lead (${state.p1Score}–${state.p2Score}). Hold the line.`
        );
      }
      if (state.p2Score > state.p1Score && event.team === 'P2') {
        return createTransmission(
          'OSLO',
          `Cobalt Crew out front (${state.p2Score}–${state.p1Score}). Catch me if you can.`
        );
      }
      return null;
    case 'MATCH_END':
      return createTransmission(
        'ARCHITECT',
        'Chronometers locked. Sixty seconds elapsed—time to count the bullion.'
      );
    default:
      return null;
  }
}

/**
 * Generates rank-branched front-page editorial copy for THE ROYAL CHRONICLE.
 */
export function getStoryEndingEditorial(
  stats: RunStatsSnapshot
): StoryEndingEditorial {
  if (stats.rank === 'S') {
    return {
      stamp: 'GHOST PROTOCOL',
      headline: 'PHANTOM OF MADRID — ROYAL MINT EMPTIED WITHOUT A SINGLE TRACE',
      subhead:
        'ZERO FOOTPRINTS · ZERO FORENSIC LEADS · SWAT SEALED INSIDE WITH HOLOGRAPHIC DECOY',
      leadParagraph:
        'MADRID — Inspector Vega admitted at dawn that tactical units breaching the Royal Mint were outmaneuvered at every security checkpoint. Executing the heist in a surgical minimum of ten-second chronometer loops, the lone crimson operative vanished through the escape tunnel while forty officers surrounded a flickering projection—leaving behind only a cobalt calling card from a rival thief named Oslo.',
      architectQuote:
        '“Not a wasted second, Kyoto. Now get to the Royal Vault—Oslo is challenging you for the rest of the bullion.” — The Architect',
    };
  }

  if (stats.rank === 'A') {
    return {
      stamp: 'CASE UNSOLVED',
      headline: 'ROYAL MINT ROBBED — POLICE SEALED IN WITH A GHOST',
      subhead:
        'BULLION VAULT EMPTIED IN TEN-SECOND BURSTS · SOLE SUSPECT VANISHES BEHIND BLAST DOORS',
      leadParagraph:
        "MADRID — Tactical units breaching the Royal Mint's inner bullion hall found the blast doors locked from within and a lone figure in a crimson jumpsuit standing calmly inside the glass override chamber. Seconds after officers forced the seal, the figure flickered out of existence—leaving an empty vault and a second chronometer signal echoing from Oslo's rival crew.",
      architectQuote:
        '“They brought forty officers to catch one ghost. Enjoy the gold, Kyoto—and watch your back for Oslo.” — The Architect',
    };
  }

  return {
    stamp: 'TEMPORAL ANOMALY',
    headline: 'CHRONO-CHAOS AT THE MINT — DOZENS OF GHOSTS BAFFLE SWAT BREACH',
    subhead:
      'SECURITY GRID OVERLOADED BY REPEATED TEN-SECOND LOOPS · SUSPECT ESCAPES IN THE CONFUSION',
    leadParagraph:
      'MADRID — Forensics teams are struggling to explain thermal recordings showing dozens of identical crimson silhouettes sprinting through the Royal Mint over an extended standoff. Despite tripping multiple laser grids and burning through extra chronometer loops, the suspect still managed to seal Inspector Vega inside the decoy vault before escaping into the Madrid night.',
    architectQuote:
      '“Messy, loud, and dangerously over Par—but the gold is in the van. Tighten up before you face Oslo.” — The Architect',
  };
}
