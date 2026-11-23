import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { renderTitleBlueprint } from '../game/renderer';

interface TitleScreenProps {
  onStartHeist: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartHeist,
  muted,
  onToggleMute,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      renderTitleBlueprint(ctx, window.innerWidth, window.innerHeight, elapsed);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStartHeist();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartHeist, onToggleMute]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07090D] select-none">
      {/* Live architectural Royal Mint blueprint background */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full"
      />

      {/* Top-right compact audio control */}
      <div className="absolute top-6 right-6 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="flex h-10 w-10 items-center justify-center border border-[#334155] bg-[#111520] text-[#CBD5E1] transition-colors hover:border-[#E63946] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Main asymmetric left-anchored focal region */}
      <main className="relative z-10 flex h-full w-full flex-col justify-between px-10 py-10 md:px-16 md:py-12">
        <div className="text-xs font-mono-timer tracking-[0.22em] text-[#94A3B8]">
          ROYAL MINT LOCKDOWN · 10-SECOND CHRONOMETER PROTOCOL
        </div>

        <div className="max-w-xl">
          {/* Bespoke inline SVG Title Lockup */}
          <svg
            viewBox="0 0 540 148"
            className="mb-6 w-full max-w-[490px]"
            role="img"
            aria-label="PLAN ZERO"
          >
            {/* Crimson heist emblem mark (mask + chronometer ring) */}
            <g transform="translate(8, 18)">
              <rect
                x="0"
                y="0"
                width="82"
                height="112"
                fill="#E63946"
              />
              {/* Chronometer ticks */}
              <circle
                cx="41"
                cy="56"
                r="29"
                fill="none"
                stroke="#0B0D12"
                strokeWidth="3"
                strokeDasharray="6 4"
              />
              {/* Stylized heist mask */}
              <ellipse cx="41" cy="56" rx="16" ry="21" fill="#F8FAFC" />
              <rect x="31" y="51" width="7" height="3.5" fill="#0B0D12" />
              <rect x="44" y="51" width="7" height="3.5" fill="#0B0D12" />
              <path
                d="M31 63 Q36 60 41 62 Q46 60 51 63 M31 63 Q29 60 30 58 M51 63 Q53 60 52 58"
                fill="none"
                stroke="#0B0D12"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>

            {/* Diagonal architectural slash */}
            <polygon points="106,130 120,18 128,18 114,130" fill="#334155" />

            {/* PLAN ZERO bold typographic lockup */}
            <text
              x="140"
              y="72"
              fill="#F8FAFC"
              fontFamily="Arial Narrow, Impact, Helvetica Neue, sans-serif"
              fontWeight="900"
              fontSize="68"
              letterSpacing="5"
            >
              PLAN
            </text>
            <text
              x="140"
              y="130"
              fill="#E63946"
              fontFamily="Arial Narrow, Impact, Helvetica Neue, sans-serif"
              fontWeight="900"
              fontSize="68"
              letterSpacing="7"
            >
              ZERO
            </text>

            {/* Precision 10.00s reticle accent */}
            <rect x="382" y="88" width="136" height="36" fill="#141923" stroke="#334155" strokeWidth="1.5" />
            <text
              x="450"
              y="112"
              textAnchor="middle"
              fill="#FFD166"
              fontFamily="SFMono-Regular, Menlo, Consolas, monospace"
              fontWeight="700"
              fontSize="20"
              letterSpacing="2"
            >
              10.00s
            </text>
          </svg>

          <p className="mb-8 max-w-md text-base leading-relaxed text-[#CBD5E1]">
            SWAT is breaching the Royal Mint, and the vault locks were built for
            a full crew. Every ten seconds your watch rewinds—turning your past
            echoes into the team that gets you out with the gold.
          </p>

          <div className="flex items-center gap-5">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartHeist();
              }}
              className="group inline-flex cursor-pointer items-center gap-3 bg-[#E63946] px-8 py-4 text-base font-bold tracking-[0.14em] text-white transition-transform duration-150 hover:bg-[#DC2626] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFD166] whitespace-nowrap shrink-0"
            >
              <span>START HEIST</span>
              <span
                aria-hidden="true"
                className="transition-transform duration-150 group-hover:translate-x-1"
              >
                →
              </span>
            </button>

            <span className="text-xs font-mono-timer tracking-wider text-[#94A3B8]">
              5 CHAPTERS · PRESS ENTER
            </span>
          </div>
        </div>

        {/* Flat single-line bottom control legend */}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1E293B] pt-4 text-xs font-mono-timer tracking-wide text-[#94A3B8]">
          <div>
            WASD / Arrows Move <span aria-hidden="true">·</span> R Rewind Loop{' '}
            <span aria-hidden="true">·</span> C Clear Echoes{' '}
            <span aria-hidden="true">·</span> M Audio{' '}
            <span aria-hidden="true">·</span> Esc Pause
          </div>
          <div className="text-[#64748B]">OPERATIVE: KYOTO</div>
        </footer>
      </main>
    </div>
  );
};
