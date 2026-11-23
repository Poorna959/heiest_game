import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Trash2, Volume2, VolumeX } from 'lucide-react';
import { ChapterCard } from './components/ChapterCard';
import { NewspaperEnding } from './components/NewspaperEnding';
import { RivalHeistArena } from './components/RivalHeistArena';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import {
  buildRunStatsSnapshot,
  clearAllEchoes,
  createInitialGameState,
  getLevelGoldCases,
  getRemainingSeconds,
  stepSimulation,
  triggerManualRewind,
} from './game/engine';
import { LEVELS } from './game/levels';
import { renderGame } from './game/renderer';
import {
  resolveStoryRadioTransmission,
  SPEAKER_PROFILES,
} from './game/scriptEngine';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIXED_DT,
  GameMode,
  GameState,
  InputState,
  MAX_ECHOES,
  RivalArenaId,
  RivalBotDifficulty,
  RunStatsSnapshot,
  ScreenPhase,
  SimEvent,
} from './types';

function parseBootParams(): {
  autostart: boolean;
  chapterIdx: number;
  mode: GameMode;
  vsBot: boolean;
} {
  if (typeof window === 'undefined') {
    return { autostart: false, chapterIdx: 0, mode: 'STORY', vsBot: true };
  }
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode');
  const mode: GameMode = modeParam === 'rival' ? 'RIVAL' : 'STORY';
  const botParam = params.get('bot');
  const vsBot = botParam === '0' ? false : true;
  const autostart = params.get('autostart') === '1' || mode === 'RIVAL';
  const chParam = Number(params.get('chapter'));
  const chapterIdx =
    Number.isFinite(chParam) && chParam >= 1 && chParam <= LEVELS.length
      ? chParam - 1
      : 0;
  return { autostart, chapterIdx, mode, vsBot };
}

interface HudSnapshot {
  chapter: number;
  title: string;
  planName: string;
  parLoops: number;
  loopNumber: number;
  echoCount: number;
  urgent: boolean;
  requiresGold: boolean;
  goldCollected: boolean;
  goldCount: number;
  goldTotal: number;
  radioTag: string;
  radioColor: string;
  radioBlipFreq: number;
  radioText: string;
}

function extractHudSnapshot(state: GameState): HudSnapshot {
  const remaining = getRemainingSeconds(state.tick);
  const goldCases = getLevelGoldCases(state.level);
  const tx = resolveStoryRadioTransmission(state, state.lastRadioEvent ?? null);
  const profile = SPEAKER_PROFILES[tx.speaker];
  return {
    chapter: state.level.chapter,
    title: state.level.title,
    planName: state.level.planName,
    parLoops: state.level.parLoops,
    loopNumber: state.loopNumber,
    echoCount: state.echoes.length,
    urgent: remaining < 3.0 && !state.freezeFrameActive,
    requiresGold: Boolean(state.level.requiresGold),
    goldCollected: state.goldCollected,
    goldCount: state.collectedGoldIds?.size ?? (state.goldCollected ? 1 : 0),
    goldTotal: goldCases.length,
    radioTag: tx.tag,
    radioColor: tx.color,
    radioBlipFreq: profile.blipFreq,
    radioText: tx.text,
  };
}

export default function App() {
  const boot = useRef(parseBootParams());
  const [gameMode, setGameMode] = useState<GameMode>(boot.current.mode);
  const [rivalVsBot, setRivalVsBot] = useState<boolean>(boot.current.vsBot);
  const [rivalArenaId, setRivalArenaId] = useState<RivalArenaId>('BULLION_HALL');
  const [rivalBotDifficulty, setRivalBotDifficulty] =
    useState<RivalBotDifficulty>('TACTICIAN');
  const [phase, setPhase] = useState<ScreenPhase>(
    boot.current.autostart ? 'PLAYING' : 'TITLE'
  );
  const [muted, setMuted] = useState(false);
  const [endingStats, setEndingStats] = useState<RunStatsSnapshot | null>(null);

  const gameStateRef = useRef<GameState>(
    createInitialGameState(boot.current.chapterIdx)
  );
  const phaseRef = useRef<ScreenPhase>(phase);
  phaseRef.current = phase;
  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;

  const [hud, setHud] = useState<HudSnapshot>(() =>
    extractHudSnapshot(gameStateRef.current)
  );
  const [typedRadio, setTypedRadio] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerDisplayRef = useRef<HTMLSpanElement | null>(null);
  const lastTimerTextRef = useRef<string>('10.00s');
  const lastUrgentRef = useRef<boolean>(false);
  const keysHeldRef = useRef<Set<string>>(new Set());

  // Mirror Story Mode state machine to document.body.dataset (Rival Mode manages its own dataset)
  useEffect(() => {
    if (gameMode === 'RIVAL' && phase !== 'TITLE') return;
    const bodyState =
      phase === 'TITLE'
        ? 'title'
        : phase === 'PAUSED'
        ? 'paused'
        : phase === 'ENDING'
        ? 'gameover'
        : 'playing';
    document.body.dataset.state = bodyState;
    document.body.dataset.mode = 'story';
    document.body.dataset.phase = phase.toLowerCase();
    document.body.dataset.chapter = String(hud.chapter);
    document.body.dataset.loop = String(hud.loopNumber);
    document.body.dataset.echoes = String(hud.echoCount);
  }, [gameMode, phase, hud.chapter, hud.loopNumber, hud.echoCount]);

  // Typewriter animation for multi-speaker radio comms
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const fullText = hud.radioText;
    const freq = hud.radioBlipFreq;
    setTypedRadio('');
    let idx = 0;

    const interval = window.setInterval(() => {
      idx += 1;
      setTypedRadio(fullText.slice(0, idx));
      if (idx % 3 === 0 && fullText[idx - 1] !== ' ') {
        soundEngine.playRadioBlip(freq);
      }
      if (idx >= fullText.length) {
        window.clearInterval(interval);
      }
    }, 22);

    return () => window.clearInterval(interval);
  }, [hud.radioText, hud.radioBlipFreq, hud.chapter, phase]);

  const syncHudFromState = useCallback(() => {
    const next = extractHudSnapshot(gameStateRef.current);
    setHud((prev) => {
      if (
        prev.chapter === next.chapter &&
        prev.loopNumber === next.loopNumber &&
        prev.echoCount === next.echoCount &&
        prev.urgent === next.urgent &&
        prev.goldCollected === next.goldCollected &&
        prev.goldCount === next.goldCount &&
        prev.radioTag === next.radioTag &&
        prev.radioText === next.radioText
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const dispatchAudioForEvents = useCallback((events: SimEvent[]) => {
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
        case 'REWIND':
          soundEngine.playLoopRewind();
          break;
        case 'LASER_HIT':
          soundEngine.playLaserZap();
          break;
        case 'GOLD_PICKUP':
          soundEngine.playGoldPickup();
          break;
        case 'CHAPTER_CLEAR':
          soundEngine.playChapterClear();
          break;
        case 'BLAST_DOOR_SLAM':
          soundEngine.playChapterSlam();
          break;
        case 'CLEAR_ECHOES':
          soundEngine.playClearEchoes();
          break;
      }
    }
  }, []);

  const blurActiveElement = () => {
    if (
      document.activeElement &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
  };

  const startAtChapter = useCallback(
    (levelIndex: number, showCard = true, resetCumulative = true) => {
      soundEngine.ensureUnlocked();
      blurActiveElement();
      keysHeldRef.current.clear();

      const prev = gameStateRef.current;
      gameStateRef.current = createInitialGameState(
        levelIndex,
        resetCumulative
          ? undefined
          : {
              totalLoopsUsed: prev.totalLoopsUsed,
              totalEchoesCreated: prev.totalEchoesCreated,
              totalElapsedSeconds: prev.totalElapsedSeconds,
            }
      );

      setEndingStats(null);
      setHud(extractHudSnapshot(gameStateRef.current));
      if (timerDisplayRef.current) {
        timerDisplayRef.current.textContent = '10.00s';
      }

      if (showCard) {
        soundEngine.playChapterSlam();
        setPhase('CHAPTER_CARD');
      } else {
        setPhase('PLAYING');
      }
    },
    []
  );

  const handleStartHeist = useCallback(() => {
    setGameMode('STORY');
    gameModeRef.current = 'STORY';
    startAtChapter(0, true, true);
  }, [startAtChapter]);

  const handleStartRival = useCallback((vsBot: boolean) => {
    soundEngine.ensureUnlocked();
    blurActiveElement();
    keysHeldRef.current.clear();
    setRivalVsBot(vsBot);
    setGameMode('RIVAL');
    gameModeRef.current = 'RIVAL';
    phaseRef.current = 'PLAYING';
    setPhase('PLAYING');
  }, []);

  const handleReturnToTitle = useCallback(() => {
    keysHeldRef.current.clear();
    setGameMode('STORY');
    gameModeRef.current = 'STORY';
    phaseRef.current = 'TITLE';
    setPhase('TITLE');
  }, []);

  const handleChapterCardComplete = useCallback(() => {
    blurActiveElement();
    setPhase('PLAYING');
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleManualRewind = useCallback(() => {
    if (phaseRef.current !== 'PLAYING') return;
    soundEngine.ensureUnlocked();
    const events = triggerManualRewind(gameStateRef.current);
    if (events.length > 0) {
      if (timerDisplayRef.current) {
        lastTimerTextRef.current = '10.00s';
        timerDisplayRef.current.textContent = '10.00s';
      }
      lastUrgentRef.current = false;
      dispatchAudioForEvents(events);
      syncHudFromState();
    }
  }, [dispatchAudioForEvents, syncHudFromState]);

  const handleClearEchoes = useCallback(() => {
    if (phaseRef.current !== 'PLAYING') return;
    soundEngine.ensureUnlocked();
    const events = clearAllEchoes(gameStateRef.current);
    if (events.length > 0) {
      if (timerDisplayRef.current) {
        lastTimerTextRef.current = '10.00s';
        timerDisplayRef.current.textContent = '10.00s';
      }
      lastUrgentRef.current = false;
      dispatchAudioForEvents(events);
      syncHudFromState();
    }
  }, [dispatchAudioForEvents, syncHudFromState]);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'PLAYING') {
      keysHeldRef.current.clear();
      setPhase('PAUSED');
    } else if (phaseRef.current === 'PAUSED') {
      blurActiveElement();
      keysHeldRef.current.clear();
      setPhase('PLAYING');
    }
  }, []);

  // Global keyboard listener on window — works immediately after Start without clicking canvas
  useEffect(() => {
    const MOVEMENT_CODES = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    const onKeyDown = (e: KeyboardEvent) => {
      if (gameModeRef.current === 'RIVAL') return;
      soundEngine.ensureUnlocked();

      if (MOVEMENT_CODES.has(e.code)) {
        if (phaseRef.current === 'PLAYING' || phaseRef.current === 'CHAPTER_CARD') {
          e.preventDefault();
          keysHeldRef.current.add(e.code);
        }
        return;
      }

      if (e.repeat) return;

      if (e.code === 'KeyM') {
        if (phaseRef.current !== 'TITLE') {
          e.preventDefault();
          handleToggleMute();
        }
        return;
      }

      if (phaseRef.current === 'PLAYING') {
        if (e.code === 'KeyR') {
          e.preventDefault();
          handleManualRewind();
        } else if (e.code === 'KeyC') {
          e.preventDefault();
          handleClearEchoes();
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleTogglePause();
        }
      } else if (phaseRef.current === 'PAUSED') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleTogglePause();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearHeldKeys = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldKeys);
    document.addEventListener('visibilitychange', clearHeldKeys);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldKeys);
      document.removeEventListener('visibilitychange', clearHeldKeys);
    };
  }, [
    handleClearEchoes,
    handleManualRewind,
    handleToggleMute,
    handleTogglePause,
  ]);

  // Fixed-timestep 60 FPS game loop mounted once outside HUD re-renders
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) * 0.001;
      lastTime = now;
      const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);

      const currentPhase = phaseRef.current;
      const state = gameStateRef.current;

      if (
        gameModeRef.current === 'STORY' &&
        (currentPhase === 'PLAYING' || currentPhase === 'FREEZE_FRAME')
      ) {
        accumulator += clampedDt;

        const keys = keysHeldRef.current;
        const input: InputState = {
          up: keys.has('KeyW') || keys.has('ArrowUp'),
          down: keys.has('KeyS') || keys.has('ArrowDown'),
          left: keys.has('KeyA') || keys.has('ArrowLeft'),
          right: keys.has('KeyD') || keys.has('ArrowRight'),
        };

        let needsHudSync = false;

        while (accumulator >= FIXED_DT) {
          accumulator -= FIXED_DT;
          const events = stepSimulation(state, input);
          if (events.length > 0) {
            dispatchAudioForEvents(events);
            needsHudSync = true;
          }

          if (state.freezeFrameActive && phaseRef.current !== 'FREEZE_FRAME') {
            phaseRef.current = 'FREEZE_FRAME';
            setPhase('FREEZE_FRAME');
            needsHudSync = true;
          }

          if (state.chapterCompleted) {
            accumulator = 0;
            const nextIndex = state.levelIndex + 1;
            if (nextIndex < LEVELS.length) {
              startAtChapter(nextIndex, true, false);
            } else {
              const snapshot = buildRunStatsSnapshot(state);
              setEndingStats(snapshot);
              phaseRef.current = 'ENDING';
              setPhase('ENDING');
            }
            break;
          }
        }

        // Direct DOM mutation for chronometer text at 20Hz (zero React re-renders, isolated container)
        const rem = getRemainingSeconds(state.tick);
        if (timerDisplayRef.current && (state.tick % 3 === 0 || state.tick === 0)) {
          const nextText = `${rem.toFixed(2)}s`;
          if (nextText !== lastTimerTextRef.current) {
            lastTimerTextRef.current = nextText;
            timerDisplayRef.current.textContent = nextText;
          }
        }

        const isUrgentNow = rem < 3.0 && !state.freezeFrameActive;
        if (needsHudSync || isUrgentNow !== lastUrgentRef.current) {
          lastUrgentRef.current = isUrgentNow;
          syncHudFromState();
        }
      } else {
        accumulator = 0;
      }

      // Render Story Mode canvas whenever Story arena is mounted
      const canvas = canvasRef.current;
      if (
        gameModeRef.current === 'STORY' &&
        canvas &&
        (currentPhase === 'PLAYING' ||
          currentPhase === 'PAUSED' ||
          currentPhase === 'CHAPTER_CARD' ||
          currentPhase === 'FREEZE_FRAME')
      ) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGame(ctx, gameStateRef.current, now * 0.001);
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [dispatchAudioForEvents, startAtChapter, syncHudFromState]);

  if (phase === 'TITLE') {
    return (
      <TitleScreen
        onStartHeist={handleStartHeist}
        onStartRival={handleStartRival}
        rivalVsBot={rivalVsBot}
        onToggleRivalVsBot={() => setRivalVsBot((v) => !v)}
        rivalArenaId={rivalArenaId}
        onSelectRivalArena={setRivalArenaId}
        rivalBotDifficulty={rivalBotDifficulty}
        onSelectRivalBotDifficulty={setRivalBotDifficulty}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
    );
  }

  if (gameMode === 'RIVAL') {
    return (
      <RivalHeistArena
        initialVsBot={rivalVsBot}
        initialArenaId={rivalArenaId}
        initialBotDifficulty={rivalBotDifficulty}
        muted={muted}
        onToggleMute={handleToggleMute}
        onReturnTitle={handleReturnToTitle}
      />
    );
  }

  if (phase === 'ENDING' && endingStats) {
    return (
      <NewspaperEnding
        stats={endingStats}
        onReplayHeist={() => startAtChapter(0, true, true)}
        onJumpToChapter={(idx) => startAtChapter(idx, true, true)}
        onLaunchRivalVsOslo={() => handleStartRival(true)}
      />
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#07090D] text-[#F8FAFC] select-none">
      {/* Top World-Matched HUD Bar: Architect Radio + Chronometer & Echo Crew */}
      <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#1E293B] bg-[#0C1018] px-4 md:px-6">
        {/* Left/Center: The Architect Encrypted Radio Bar */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2 border border-[#334155] bg-[#141923] px-2.5 py-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#E63946]"
            />
            <span className="font-mono-timer text-[11px] font-bold tracking-[0.14em] text-[#E63946]">
              REC
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-mono-timer tracking-[0.14em] text-[#94A3B8]">
              <span className="font-bold" style={{ color: hud.radioColor }}>
                {hud.radioTag}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                CH {hud.chapter}: {hud.planName}
              </span>
              {hud.requiresGold && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      hud.goldCollected
                        ? 'text-[#FFD166] font-bold'
                        : 'text-[#94A3B8]'
                    }
                  >
                    {hud.goldCollected
                      ? 'BULLION SECURED'
                      : hud.goldTotal > 1
                      ? `BULLION ${hud.goldCount}/${hud.goldTotal}`
                      : 'TARGET: GOLD CASE'}
                  </span>
                </>
              )}
            </div>
            <p className="truncate text-sm font-medium text-[#E2E8F0]">
              &ldquo;{typedRadio || hud.radioText}&rdquo;
            </p>
          </div>
        </div>

        {/* Right: Chronometer, Loop Counter, 5 Echo Crew Slots, Utility Icons */}
        <div className="flex shrink-0 items-center gap-4">
          {/* Loop & Par + Echo Slots */}
          <div className="hidden flex-col items-end sm:flex">
            <div className="font-mono-timer text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8]">
              LOOP <span className="text-white">{hud.loopNumber}</span>{' '}
              <span className="text-[#64748B]">/ PAR {hud.parLoops}</span>
            </div>
            <div
              className="mt-1 flex items-center gap-1.5"
              aria-label={`${hud.echoCount} of ${MAX_ECHOES} echoes active`}
            >
              {Array.from({ length: MAX_ECHOES }).map((_, idx) => {
                const active = idx < hud.echoCount;
                return (
                  <svg
                    key={idx}
                    viewBox="0 0 18 18"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle
                      cx="9"
                      cy="9"
                      r="7"
                      fill={active ? '#E63946' : '#141923'}
                      stroke={active ? '#38BDF8' : '#334155'}
                      strokeWidth="1.75"
                    />
                    {active && <circle cx="10.5" cy="9" r="2.2" fill="#F8FAFC" />}
                  </svg>
                );
              })}
            </div>
          </div>

          {/* Monospaced 10.00s Chronometer */}
          <div
            className={`flex w-[120px] flex-col items-end border px-3 py-1 transition-colors [contain:layout_paint] ${
              hud.urgent
                ? 'border-[#EF4444] bg-[#2A0E14]'
                : 'border-[#334155] bg-[#141923]'
            }`}
          >
            <span className="font-mono-timer text-[9px] font-bold tracking-[0.2em] text-[#94A3B8]">
              CHRONOMETER
            </span>
            <span
              ref={timerDisplayRef}
              data-testid="chronometer"
              className={`block h-[24px] w-full text-right font-mono-timer text-2xl leading-none font-black tracking-tight ${
                hud.urgent ? 'text-[#EF4444]' : 'text-[#F8FAFC]'
              }`}
            >
              10.00s
            </span>
          </div>

          {/* Compact Utility Icon Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleManualRewind();
              }}
              aria-label="Rewind loop (R)"
              title="Rewind Loop (R)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[#334155] bg-[#141923] text-[#CBD5E1] transition-colors hover:border-[#38BDF8] hover:text-[#38BDF8]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleClearEchoes();
              }}
              aria-label="Clear echoes (C)"
              title="Clear Echoes (C)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[#334155] bg-[#141923] text-[#CBD5E1] transition-colors hover:border-[#E63946] hover:text-[#E63946]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleMute();
              }}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title="Toggle Audio (M)"
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
              aria-label={phase === 'PAUSED' ? 'Resume heist' : 'Pause heist (Esc)'}
              title="Pause (Esc)"
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

      {/* Center Unobstructed Vault Canvas Viewport */}
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <div className="relative flex h-full w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            data-testid="game-canvas"
            className="aspect-video max-h-full max-w-full border border-[#334155] bg-[#0B0D12] [contain:layout_paint]"
          />
        </div>
      </main>

      {/* Bottom Minimal Single-Line Control Strip */}
      <footer className="z-20 flex h-[34px] shrink-0 items-center justify-between border-t border-[#1E293B] bg-[#0C1018] px-4 font-mono-timer text-xs text-[#94A3B8] md:px-6">
        <div className="truncate">
          WASD / Arrows: Move <span aria-hidden="true"> · </span> R: Rewind Loop{' '}
          <span aria-hidden="true"> · </span> C: Clear Echoes{' '}
          <span aria-hidden="true"> · </span> M: Audio{' '}
          <span aria-hidden="true"> · </span> Esc: Pause
        </div>
        <div className="hidden shrink-0 text-[#64748B] sm:block">
          {hud.title.toUpperCase()} · ECHOES {hud.echoCount}/{MAX_ECHOES}
        </div>
      </footer>

      {/* 2-Second Crimson Slash Chapter Card Overlay */}
      {phase === 'CHAPTER_CARD' && (
        <ChapterCard
          level={gameStateRef.current.level}
          onComplete={handleChapterCardComplete}
        />
      )}

      {/* Focused Pause Modal */}
      {phase === 'PAUSED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Heist Paused"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-md border border-[#334155] bg-[#0F141E] p-6 shadow-2xl">
            <div className="font-mono-timer text-xs font-bold tracking-[0.2em] text-[#E63946]">
              CHRONOMETER PAUSED
            </div>
            <h2 className="mt-1 font-display text-3xl font-black tracking-wide text-white">
              CHAPTER {hud.chapter}: {hud.planName}
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {hud.title} · Loop {hud.loopNumber} (Par {hud.parLoops})
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
                RESUME HEIST
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startAtChapter(gameStateRef.current.levelIndex, false, false);
                }}
                className="w-full cursor-pointer border border-[#334155] bg-[#161D2B] py-2.5 font-mono-timer text-xs font-bold tracking-[0.16em] text-[#E2E8F0] transition-colors hover:border-white hover:text-white"
              >
                RESTART ROOM
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setPhase('TITLE');
                }}
                className="w-full cursor-pointer border border-[#1E293B] bg-transparent py-2.5 font-mono-timer text-xs font-bold tracking-[0.16em] text-[#94A3B8] transition-colors hover:border-[#64748B] hover:text-white"
              >
                RETURN TO TITLE
              </button>
            </div>

            <div className="mt-5 border-t border-[#1E293B] pt-4">
              <div className="mb-2 font-mono-timer text-[11px] font-semibold tracking-[0.16em] text-[#94A3B8]">
                JUMP TO CHAPTER
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {LEVELS.map((lvl, idx) => (
                  <button
                    key={lvl.chapter}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      startAtChapter(idx, true, false);
                    }}
                    className={`cursor-pointer border py-1.5 font-mono-timer text-xs font-bold transition-colors ${
                      idx === gameStateRef.current.levelIndex
                        ? 'border-[#E63946] bg-[#E63946]/20 text-white'
                        : 'border-[#334155] bg-[#141923] text-[#CBD5E1] hover:border-white hover:text-white'
                    }`}
                  >
                    CH {lvl.chapter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
