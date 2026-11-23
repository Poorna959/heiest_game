import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Shield,
  Terminal,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { getRemainingSeconds } from '../game/engine';
import {
  buildRivalStatsSnapshot,
  chooseBotEchoDuty,
  commitEchoDutiesAndStartNextLoop,
  createInitialRivalState,
  stepRivalSimulation,
} from '../game/rivalEngine';
import { RIVAL_ARENA_LIST } from '../game/rivalMaps';
import { renderRivalGame } from '../game/rivalRenderer';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIXED_DT,
  RadioTransmission,
  RIVAL_ASSIGN_DURATION_SECONDS,
  RIVAL_MAX_ECHOES_PER_PLAYER,
  RIVAL_TOTAL_LOOPS,
  RivalArenaId,
  RivalBotDifficulty,
  RivalGameState,
  RivalInputState,
  RivalPhase,
  RivalRole,
  RivalSimEvent,
  RivalStatsSnapshot,
} from '../types';
import { AssignDutyOverlay } from './AssignDutyOverlay';
import { RivalNewspaperEnding } from './RivalNewspaperEnding';

interface RivalHeistArenaProps {
  initialVsBot: boolean;
  initialArenaId: RivalArenaId;
  initialBotDifficulty: RivalBotDifficulty;
  muted: boolean;
  onToggleMute: () => void;
  onReturnTitle: () => void;
}

interface RivalHudSnapshot {
  loopNumber: number;
  p1Score: number;
  p2Score: number;
  p1Roles: RivalRole[];
  p2Roles: RivalRole[];
  urgent: boolean;
  vsBot: boolean;
  arenaId: RivalArenaId;
  botDifficulty: RivalBotDifficulty;
  banter: RadioTransmission | null;
}

function extractRivalHud(state: RivalGameState): RivalHudSnapshot {
  const rem = getRemainingSeconds(state.tick);
  return {
    loopNumber: state.loopNumber,
    p1Score: state.p1Score,
    p2Score: state.p2Score,
    p1Roles: state.p1Echoes.map((e) => e.role),
    p2Roles: state.p2Echoes.map((e) => e.role),
    urgent: rem < 3.0 && !state.awaitingDutyAssignment && !state.matchEnded,
    vsBot: state.vsBot,
    arenaId: state.arenaId ?? 'BULLION_HALL',
    botDifficulty: state.botDifficulty ?? 'TACTICIAN',
    banter: state.liveBanter ?? null,
  };
}

const EchoSlotIcon: React.FC<{ role: RivalRole; colorClass: string }> = ({
  role,
  colorClass,
}) => {
  if (role === 'GUARD') return <Shield className={`h-3 w-3 ${colorClass}`} />;
  if (role === 'HACKER') return <Terminal className={`h-3 w-3 ${colorClass}`} />;
  return <Zap className={`h-3 w-3 ${colorClass}`} />;
};

export const RivalHeistArena: React.FC<RivalHeistArenaProps> = ({
  initialVsBot,
  initialArenaId,
  initialBotDifficulty,
  muted,
  onToggleMute,
  onReturnTitle,
}) => {
  const stateRef = useRef<RivalGameState>(
    createInitialRivalState(initialVsBot, initialArenaId, initialBotDifficulty)
  );
  const [phase, setPhase] = useState<RivalPhase>('PLAYING');
  const phaseRef = useRef<RivalPhase>('PLAYING');
  phaseRef.current = phase;

  const [hud, setHud] = useState<RivalHudSnapshot>(() =>
    extractRivalHud(stateRef.current)
  );
  const [endingStats, setEndingStats] = useState<RivalStatsSnapshot | null>(
    null
  );

  // 3-second Assign Echo Duty overlay state
  const [assignRemaining, setAssignRemaining] = useState(
    RIVAL_ASSIGN_DURATION_SECONDS
  );
  const [p1Choice, setP1Choice] = useState<RivalRole | null>(null);
  const [p2Choice, setP2Choice] = useState<RivalRole | null>(null);
  const p1ChoiceRef = useRef<RivalRole | null>(null);
  const p2ChoiceRef = useRef<RivalRole | null>(null);
  p1ChoiceRef.current = p1Choice;
  p2ChoiceRef.current = p2Choice;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerDisplayRef = useRef<HTMLSpanElement | null>(null);
  const lastTimerTextRef = useRef<string>('10.00s');
  const lastUrgentRef = useRef<boolean>(false);
  const keysHeldRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const bodyState =
      phase === 'PAUSED'
        ? 'paused'
        : phase === 'ENDING'
        ? 'gameover'
        : 'playing';
    document.body.dataset.state = bodyState;
    document.body.dataset.mode = 'rival';
    document.body.dataset.phase = phase.toLowerCase();
    document.body.dataset.loop = String(hud.loopNumber);
    document.body.dataset.p1Score = String(hud.p1Score);
    document.body.dataset.p2Score = String(hud.p2Score);
  }, [phase, hud.loopNumber, hud.p1Score, hud.p2Score]);

  const syncHud = useCallback(() => {
    const next = extractRivalHud(stateRef.current);
    setHud((prev) => {
      if (
        prev.loopNumber === next.loopNumber &&
        prev.p1Score === next.p1Score &&
        prev.p2Score === next.p2Score &&
        prev.urgent === next.urgent &&
        prev.vsBot === next.vsBot &&
        prev.arenaId === next.arenaId &&
        prev.botDifficulty === next.botDifficulty &&
        prev.banter?.text === next.banter?.text &&
        prev.p1Roles.join(',') === next.p1Roles.join(',') &&
        prev.p2Roles.join(',') === next.p2Roles.join(',')
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const playEventsAudio = useCallback((events: RivalSimEvent[]) => {
    for (const ev of events) {
      switch (ev.type) {
        case 'TICK_SECOND':
          soundEngine.playChronometerTick(false);
          break;
        case 'TICK_URGENT':
          soundEngine.playChronometerTick(true);
          break;
        case 'PLATE_ON':
          soundEngine.playSwitchClick(true);
          break;
        case 'PLATE_OFF':
          soundEngine.playSwitchClick(false);
          break;
        case 'GOLD_PICKUP':
          soundEngine.playSwitchClick(true);
          break;
        case 'GOLD_BANK':
          soundEngine.playGoldPickup();
          break;
        case 'GOLD_STEAL':
          soundEngine.playChapterClear();
          break;
        case 'GUARD_STUN':
          soundEngine.playChapterSlam();
          break;
        case 'DASH_TACKLE':
          soundEngine.playTackleHit();
          break;
        case 'ECHO_ZAPPED':
        case 'LASER_HIT':
          soundEngine.playLaserZap();
          break;
        case 'DIAMOND_SPAWN':
        case 'CORRIDOR_DROP':
          soundEngine.playGoldPickup();
          break;
        case 'LOOP_END':
          soundEngine.playLoopRewind();
          break;
        case 'CROWN_SPAWN':
          soundEngine.playChapterSlam();
          break;
        case 'MATCH_END':
          soundEngine.playChapterSlam();
          break;
      }
    }
  }, []);

  const finalizeDutyAssignment = useCallback(() => {
    if (phaseRef.current !== 'ASSIGN_DUTY') return;
    const role1: RivalRole = p1ChoiceRef.current ?? 'RUNNER';
    const role2: RivalRole =
      p2ChoiceRef.current ??
      (stateRef.current.vsBot ? chooseBotEchoDuty(stateRef.current) : 'RUNNER');

    const events = commitEchoDutiesAndStartNextLoop(
      stateRef.current,
      role1,
      role2
    );
    playEventsAudio(events);

    p1ChoiceRef.current = null;
    p2ChoiceRef.current = null;
    setP1Choice(null);
    setP2Choice(null);
    lastUrgentRef.current = false;
    lastTimerTextRef.current = '10.00s';
    if (timerDisplayRef.current) {
      timerDisplayRef.current.textContent = '10.00s';
    }
    syncHud();
    phaseRef.current = 'PLAYING';
    setPhase('PLAYING');
  }, [playEventsAudio, syncHud]);

  const startNewMatch = useCallback(
    (
      vsBot: boolean,
      arenaId: RivalArenaId = stateRef.current.arenaId ?? 'BULLION_HALL',
      botDifficulty: RivalBotDifficulty = stateRef.current.botDifficulty ?? 'TACTICIAN'
    ) => {
      soundEngine.ensureUnlocked();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      keysHeldRef.current.clear();
      stateRef.current = createInitialRivalState(vsBot, arenaId, botDifficulty);
      p1ChoiceRef.current = null;
      p2ChoiceRef.current = null;
      setP1Choice(null);
      setP2Choice(null);
      setEndingStats(null);
      lastUrgentRef.current = false;
      lastTimerTextRef.current = '10.00s';
      if (timerDisplayRef.current) {
        timerDisplayRef.current.textContent = '10.00s';
      }
      setHud(extractRivalHud(stateRef.current));
      phaseRef.current = 'PLAYING';
      setPhase('PLAYING');
    },
    []
  );

  // 3-second Assign Echo Duty countdown + AI Bot auto-pick + fast-commit when both locked
  useEffect(() => {
    if (phase !== 'ASSIGN_DUTY') return;

    const startMs = performance.now();
    setAssignRemaining(RIVAL_ASSIGN_DURATION_SECONDS);

    let botTimer: number | null = null;
    if (stateRef.current.vsBot) {
      botTimer = window.setTimeout(() => {
        if (phaseRef.current === 'ASSIGN_DUTY' && !p2ChoiceRef.current) {
          const botRole = chooseBotEchoDuty(stateRef.current);
          p2ChoiceRef.current = botRole;
          setP2Choice(botRole);
        }
      }, 480);
    }

    const interval = window.setInterval(() => {
      const elapsed = (performance.now() - startMs) * 0.001;
      const rem = Math.max(0, RIVAL_ASSIGN_DURATION_SECONDS - elapsed);
      setAssignRemaining(rem);
      if (rem <= 0) {
        window.clearInterval(interval);
        finalizeDutyAssignment();
      }
    }, 60);

    return () => {
      window.clearInterval(interval);
      if (botTimer !== null) window.clearTimeout(botTimer);
    };
  }, [phase, finalizeDutyAssignment]);

  // Fast-forward once both sides have selected their duty
  useEffect(() => {
    if (phase !== 'ASSIGN_DUTY') return;
    if (p1Choice && p2Choice) {
      const t = window.setTimeout(() => {
        finalizeDutyAssignment();
      }, 320);
      return () => window.clearTimeout(t);
    }
  }, [phase, p1Choice, p2Choice, finalizeDutyAssignment]);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'PLAYING') {
      keysHeldRef.current.clear();
      setPhase('PAUSED');
    } else if (phaseRef.current === 'PAUSED') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      keysHeldRef.current.clear();
      setPhase('PLAYING');
    }
  }, []);

  // Global window keyboard input for P1 (WASD + 1/2/3), P2 (Arrows + J/K/L), M, Esc/P
  useEffect(() => {
    const MOVE_KEYS = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'Space',
      'ShiftLeft',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Enter',
      'ShiftRight',
    ]);

    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.ensureUnlocked();

      if (MOVE_KEYS.has(e.code)) {
        if (phaseRef.current === 'PLAYING') {
          e.preventDefault();
          if (
            !e.repeat &&
            (e.code === 'Space' ||
              e.code === 'ShiftLeft' ||
              e.code === 'Enter' ||
              e.code === 'ShiftRight')
          ) {
            soundEngine.playChronoDash();
          }
          keysHeldRef.current.add(e.code);
        }
        return;
      }

      if (e.repeat) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        onToggleMute();
        return;
      }

      if (phaseRef.current === 'ASSIGN_DUTY') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          setP1Choice('GUARD');
          soundEngine.playSwitchClick(true);
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          setP1Choice('HACKER');
          soundEngine.playSwitchClick(true);
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          setP1Choice('RUNNER');
          soundEngine.playSwitchClick(true);
        } else if (!stateRef.current.vsBot) {
          if (e.code === 'KeyJ') {
            e.preventDefault();
            setP2Choice('GUARD');
            soundEngine.playSwitchClick(true);
          } else if (e.code === 'KeyK') {
            e.preventDefault();
            setP2Choice('HACKER');
            soundEngine.playSwitchClick(true);
          } else if (e.code === 'KeyL') {
            e.preventDefault();
            setP2Choice('RUNNER');
            soundEngine.playSwitchClick(true);
          }
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (phaseRef.current === 'PLAYING' || phaseRef.current === 'PAUSED') {
          e.preventDefault();
          handleTogglePause();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearKeys = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
    };
  }, [handleTogglePause, onToggleMute]);

  // Fixed 60 FPS Rival Heist loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) * 0.001;
      lastTime = now;
      const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);

      const curPhase = phaseRef.current;
      const state = stateRef.current;

      if (curPhase === 'PLAYING') {
        accumulator += clampedDt;
        const keys = keysHeldRef.current;
        const p1Input: RivalInputState = {
          up: keys.has('KeyW'),
          down: keys.has('KeyS'),
          left: keys.has('KeyA'),
          right: keys.has('KeyD'),
          dash: keys.has('Space') || keys.has('ShiftLeft'),
        };
        const p2Input: RivalInputState = {
          up: keys.has('ArrowUp'),
          down: keys.has('ArrowDown'),
          left: keys.has('ArrowLeft'),
          right: keys.has('ArrowRight'),
          dash: keys.has('Enter') || keys.has('ShiftRight'),
        };

        let needsSync = false;

        while (accumulator >= FIXED_DT) {
          accumulator -= FIXED_DT;
          const events = stepRivalSimulation(state, p1Input, p2Input);
          if (events.length > 0) {
            playEventsAudio(events);
            needsSync = true;
          }

          if (state.awaitingDutyAssignment) {
            accumulator = 0;
            keysHeldRef.current.clear();
            phaseRef.current = 'ASSIGN_DUTY';
            setPhase('ASSIGN_DUTY');
            needsSync = true;
            break;
          }

          if (state.matchEnded) {
            accumulator = 0;
            keysHeldRef.current.clear();
            setEndingStats(buildRivalStatsSnapshot(state));
            phaseRef.current = 'ENDING';
            setPhase('ENDING');
            needsSync = true;
            break;
          }
        }

        const rem = getRemainingSeconds(state.tick);
        if (timerDisplayRef.current && (state.tick % 3 === 0 || state.tick === 0)) {
          const nextText = `${rem.toFixed(2)}s`;
          if (nextText !== lastTimerTextRef.current) {
            lastTimerTextRef.current = nextText;
            timerDisplayRef.current.textContent = nextText;
          }
        }

        const urgentNow = rem < 3.0;
        if (needsSync || urgentNow !== lastUrgentRef.current) {
          lastUrgentRef.current = urgentNow;
          syncHud();
        }
      } else {
        accumulator = 0;
      }

      const canvas = canvasRef.current;
      if (canvas && curPhase !== 'ENDING') {
        if (curPhase === 'PLAYING' || !renderedStaticRef.current) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderRivalGame(ctx, stateRef.current, now * 0.001);
          }
          renderedStaticRef.current = curPhase !== 'PLAYING';
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    const renderedStaticRef = { current: false };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playEventsAudio, syncHud]);

  if (phase === 'ENDING' && endingStats) {
    return (
      <RivalNewspaperEnding
        stats={endingStats}
        onRematch={() => startNewMatch(endingStats.vsBot)}
        onToggleBotRematch={() => startNewMatch(!endingStats.vsBot)}
        onReturnTitle={onReturnTitle}
      />
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#07090D] text-[#F8FAFC] select-none">
      {/* Top Symmetric Rival Heist HUD */}
      <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#1E293B] bg-[#0C1018] px-4 md:px-6">
        {/* Left: P1 Kyoto Score & Role Echo Slots */}
        <div className="flex items-center gap-3.5">
          <div className="border border-[#E63946]/70 bg-[#1F0F14] px-3 py-1">
            <div className="font-mono-timer text-[9px] font-bold tracking-[0.18em] text-[#FCA5A5]">
              P1 · KYOTO
            </div>
            <div
              data-testid="p1-score"
              className="font-mono-timer text-2xl leading-none font-black text-[#E63946]"
            >
              {hud.p1Score}
            </div>
          </div>

          <div className="hidden flex-col gap-1 sm:flex">
            <span className="font-mono-timer text-[9px] tracking-[0.16em] text-[#94A3B8]">
              ECHO CREW ({hud.p1Roles.length}/{RIVAL_MAX_ECHOES_PER_PLAYER})
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: RIVAL_MAX_ECHOES_PER_PLAYER }).map((_, i) => {
                const role = hud.p1Roles[i];
                return (
                  <div
                    key={i}
                    title={role ?? 'Empty Echo Slot'}
                    className={`flex h-6 w-6 items-center justify-center border ${
                      role
                        ? 'border-[#E63946] bg-[#E63946]/20'
                        : 'border-[#334155] bg-[#141923]'
                    }`}
                  >
                    {role && (
                      <EchoSlotIcon role={role} colorClass="text-[#FCA5A5]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Loop Counter + 10.00s Chronometer */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono-timer text-[10px] font-bold tracking-[0.2em] text-[#94A3B8]">
              RIVAL HEIST
            </div>
            <div
              data-testid="rival-loop-counter"
              className={`font-mono-timer text-sm font-black tracking-[0.12em] ${
                hud.loopNumber === RIVAL_TOTAL_LOOPS
                  ? 'text-[#FFD166]'
                  : 'text-white'
              }`}
            >
              LOOP {hud.loopNumber} / {RIVAL_TOTAL_LOOPS}
              {hud.loopNumber === RIVAL_TOTAL_LOOPS ? ' · CROWN' : ''}
            </div>
          </div>

          <div
            className={`flex w-[120px] flex-col items-end border px-3 py-1 [contain:layout_paint] ${
              hud.urgent
                ? 'border-[#EF4444] bg-[#2A0E14]'
                : hud.loopNumber === RIVAL_TOTAL_LOOPS
                ? 'border-[#FFD166] bg-[#211A0B]'
                : 'border-[#334155] bg-[#141923]'
            }`}
          >
            <span className="font-mono-timer text-[9px] font-bold tracking-[0.2em] text-[#94A3B8]">
              CHRONOMETER
            </span>
            <span
              ref={timerDisplayRef}
              data-testid="rival-chronometer"
              className={`block h-[24px] w-full text-right font-mono-timer text-2xl leading-none font-black ${
                hud.urgent ? 'text-[#EF4444]' : 'text-[#F8FAFC]'
              }`}
            >
              10.00s
            </span>
          </div>
        </div>

        {/* Right: P2 Oslo Role Echo Slots, Score & Utility Controls */}
        <div className="flex items-center gap-3.5">
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <span className="font-mono-timer text-[9px] tracking-[0.16em] text-[#94A3B8]">
              ECHO CREW ({hud.p2Roles.length}/{RIVAL_MAX_ECHOES_PER_PLAYER})
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: RIVAL_MAX_ECHOES_PER_PLAYER }).map((_, i) => {
                const role = hud.p2Roles[i];
                return (
                  <div
                    key={i}
                    title={role ?? 'Empty Echo Slot'}
                    className={`flex h-6 w-6 items-center justify-center border ${
                      role
                        ? 'border-[#38BDF8] bg-[#38BDF8]/20'
                        : 'border-[#334155] bg-[#141923]'
                    }`}
                  >
                    {role && (
                      <EchoSlotIcon role={role} colorClass="text-[#BAE6FD]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-[#38BDF8]/70 bg-[#0D1A26] px-3 py-1 text-right">
            <div className="font-mono-timer text-[9px] font-bold tracking-[0.18em] text-[#BAE6FD]">
              {hud.vsBot ? 'BOT · OSLO' : 'P2 · OSLO'}
            </div>
            <div
              data-testid="p2-score"
              className="font-mono-timer text-2xl leading-none font-black text-[#38BDF8]"
            >
              {hud.p2Score}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[#334155] bg-[#141923] text-[#CBD5E1] transition-colors hover:border-[#FFD166] hover:text-[#FFD166]"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleTogglePause();
              }}
              aria-label={phase === 'PAUSED' ? 'Resume match' : 'Pause match (Esc)'}
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[#334155] bg-[#141923] text-[#CBD5E1] transition-colors hover:border-white hover:text-white"
            >
              {phase === 'PAUSED' ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Live PvP Radio Banter Strip */}
      {hud.banter && (
        <div className="z-20 flex shrink-0 items-center justify-center gap-2.5 border-b border-[#1E293B] bg-[#0B0E16] px-4 py-1 text-xs">
          <span
            className="font-mono-timer text-[11px] font-black tracking-[0.14em]"
            style={{ color: hud.banter.color }}
          >
            {hud.banter.tag}
          </span>
          <span className="truncate font-medium text-[#E2E8F0]">
            &ldquo;{hud.banter.text}&rdquo;
          </span>
        </div>
      )}

      {/* Center Unobstructed Rival Canvas Viewport */}
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <div className="relative flex h-full w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            data-testid="rival-canvas"
            className="aspect-video max-h-full max-w-full border border-[#334155] bg-[#0B0D12] [contain:layout_paint]"
          />
        </div>
      </main>

      {/* Bottom Control Strip */}
      <footer className="z-20 flex h-[34px] shrink-0 items-center justify-between border-t border-[#1E293B] bg-[#0C1018] px-4 font-mono-timer text-xs text-[#94A3B8] md:px-6">
        <div className="truncate">
          P1 Kyoto: WASD + Space Dash (1/2/3) <span aria-hidden="true"> · </span>
          {hud.vsBot
            ? `P2 Oslo: AI (${hud.botDifficulty})`
            : 'P2 Oslo: Arrows + Enter Dash (J/K/L)'}
          <span aria-hidden="true"> · </span> M: Audio{' '}
          <span aria-hidden="true"> · </span> Esc: Pause
        </div>
        <div className="hidden shrink-0 text-[#64748B] sm:block">
          L3 DIAMOND (2 PT) · L6 CROWN (3 PT) · HACKER SHIELDS STASH
        </div>
      </footer>

      {/* 3-Second Assign Echo Duty Intermission */}
      {phase === 'ASSIGN_DUTY' && (
        <AssignDutyOverlay
          completedLoop={hud.loopNumber}
          remainingSeconds={assignRemaining}
          p1Selection={p1Choice}
          p2Selection={p2Choice}
          vsBot={hud.vsBot}
          onSelectP1={(role) => {
            setP1Choice(role);
            soundEngine.playSwitchClick(true);
          }}
          onSelectP2={(role) => {
            if (!hud.vsBot) {
              setP2Choice(role);
              soundEngine.playSwitchClick(true);
            }
          }}
        />
      )}

      {/* Rival Heist Pause Modal */}
      {phase === 'PAUSED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rival Heist Paused"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-md border border-[#334155] bg-[#0F141E] p-6 shadow-2xl">
            <div className="font-mono-timer text-xs font-bold tracking-[0.2em] text-[#38BDF8]">
              RIVAL HEIST PAUSED
            </div>
            <h2 className="mt-1 font-display text-3xl font-black tracking-wide text-white">
              KYOTO {hud.p1Score} — {hud.p2Score} OSLO
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Loop {hud.loopNumber} of {RIVAL_TOTAL_LOOPS} ·{' '}
              {hud.vsBot ? '1P vs AI Bot' : '2P Local Showdown'}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleTogglePause();
                }}
                className="w-full cursor-pointer bg-[#E63946] py-3 font-mono-timer text-xs font-bold tracking-[0.18em] text-white transition-colors hover:bg-[#DC2626]"
              >
                RESUME MATCH
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewMatch(hud.vsBot);
                }}
                className="w-full cursor-pointer border border-[#334155] bg-[#161D2B] py-2.5 font-mono-timer text-xs font-bold tracking-[0.16em] text-[#E2E8F0] transition-colors hover:border-white hover:text-white"
              >
                RESTART MATCH
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startNewMatch(!hud.vsBot);
                }}
                className="w-full cursor-pointer border border-[#38BDF8]/60 bg-[#0D1A26] py-2.5 font-mono-timer text-xs font-bold tracking-[0.16em] text-[#BAE6FD] transition-colors hover:bg-[#38BDF8] hover:text-[#07090D]"
              >
                {hud.vsBot ? 'SWITCH TO 2P LOCAL' : 'SWITCH TO VS AI BOT'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReturnTitle();
                }}
                className="w-full cursor-pointer border border-[#1E293B] bg-transparent py-2.5 font-mono-timer text-xs font-bold tracking-[0.16em] text-[#94A3B8] transition-colors hover:border-[#64748B] hover:text-white"
              >
                RETURN TO TITLE
              </button>
            </div>

            <div className="mt-4 border-t border-[#1E293B] pt-3">
              <div className="mb-1.5 font-mono-timer text-[10px] font-bold tracking-[0.16em] text-[#94A3B8]">
                SWITCH ARENA
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {RIVAL_ARENA_LIST.map((arena) => (
                  <button
                    key={arena.id}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      startNewMatch(hud.vsBot, arena.id, hud.botDifficulty);
                    }}
                    className={`cursor-pointer border px-2 py-1.5 font-mono-timer text-[10px] font-bold transition-colors ${
                      hud.arenaId === arena.id
                        ? 'border-[#E63946] bg-[#E63946]/20 text-white'
                        : 'border-[#334155] bg-[#141923] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {arena.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
