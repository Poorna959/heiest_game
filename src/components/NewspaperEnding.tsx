import React from 'react';
import { LEVELS } from '../game/levels';
import { RunStatsSnapshot } from '../types';

interface NewspaperEndingProps {
  stats: RunStatsSnapshot;
  onReplayHeist: () => void;
  onJumpToChapter: (levelIndex: number) => void;
}

function formatHeistTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${rem.toFixed(1)}s`;
  }
  return `${rem.toFixed(1)}s`;
}

export const NewspaperEnding: React.FC<NewspaperEndingProps> = ({
  stats,
  onReplayHeist,
  onJumpToChapter,
}) => {
  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0A0C10] p-4 md:p-6 select-none">
      <article className="relative flex max-h-full w-full max-w-[1040px] flex-col border-2 border-[#1A1A1A] bg-[#F2ECE1] px-7 py-5 text-[#141414] shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
        {/* Top Masthead */}
        <header className="border-b-4 border-double border-[#1A1A1A] pb-3">
          <div className="flex items-center justify-between text-[11px] font-mono-timer font-semibold tracking-[0.18em] text-[#4B463F]">
            <span>VOL. CXIV · NO. 001</span>
            <span>ROYAL MINT SPECIAL EDITION</span>
            <span>PRICE: TWO SHILLINGS</span>
          </div>

          <div className="relative mt-1 flex items-center justify-center">
            <h1 className="font-broadsheet text-center text-4xl font-black tracking-[0.08em] text-[#111111] md:text-5xl">
              THE ROYAL CHRONICLE
            </h1>

            {/* Crimson rubber stamp accent */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rotate-[-8deg] border-2 border-[#C81E2B] px-2.5 py-0.5 font-mono-timer text-xs font-black tracking-[0.22em] text-[#C81E2B]"
            >
              CASE UNSOLVED
            </div>
          </div>
        </header>

        {/* Main Front-Page Headline */}
        <section className="border-b border-[#1A1A1A]/30 py-3 text-center">
          <h2 className="font-broadsheet text-2xl font-black leading-tight tracking-tight text-[#111111] md:text-3xl">
            ROYAL MINT ROBBED — POLICE SEALED IN WITH A GHOST
          </h2>
          <p className="mt-1 text-xs font-mono-timer tracking-[0.14em] text-[#575148]">
            BULLION VAULT EMPTIED IN TEN-SECOND BURSTS · SOLE SUSPECT VANISHES
            BEHIND BLAST DOORS
          </p>
        </section>

        {/* Broadsheet 2-Column Body */}
        <div className="grid flex-1 grid-cols-12 gap-6 py-4">
          {/* Left Column: CCTV Illustration + Dispatch */}
          <div className="col-span-7 flex flex-col justify-between border-r border-[#1A1A1A]/20 pr-6">
            {/* Inline SVG High-Contrast Broadsheet CCTV Print */}
            <div className="relative border-2 border-[#1A1A1A] bg-[#141820] p-2">
              <svg
                viewBox="0 0 460 190"
                className="h-auto w-full"
                role="img"
                aria-label="Security camera still of the sealed glass chamber containing a fading echo silhouette"
              >
                {/* Vault architectural blueprint lines */}
                <rect x="0" y="0" width="460" height="190" fill="#10141C" />
                <g stroke="#1E293B" strokeWidth="1">
                  <line x1="0" y1="45" x2="460" y2="45" />
                  <line x1="0" y1="95" x2="460" y2="95" />
                  <line x1="0" y1="145" x2="460" y2="145" />
                  <line x1="115" y1="0" x2="115" y2="190" />
                  <line x1="230" y1="0" x2="230" y2="190" />
                  <line x1="345" y1="0" x2="345" y2="190" />
                </g>

                {/* Spotlight cone */}
                <polygon
                  points="230,0 138,190 322,190"
                  fill="#F8FAFC"
                  opacity="0.11"
                />

                {/* Glass Decoy Chamber Frame */}
                <rect
                  x="150"
                  y="34"
                  width="160"
                  height="122"
                  fill="rgba(56,189,248,0.08)"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                />
                {/* Biometric Override Plate */}
                <rect
                  x="208"
                  y="73"
                  width="44"
                  height="44"
                  rx="4"
                  fill="rgba(34,197,94,0.18)"
                  stroke="#22C55E"
                  strokeWidth="2"
                />
                {/* Fading Decoy Echo Silhouette */}
                <circle
                  cx="230"
                  cy="95"
                  r="17"
                  fill="#E63946"
                  opacity="0.58"
                  stroke="#38BDF8"
                  strokeWidth="2"
                />
                <ellipse cx="235" cy="95" rx="5.5" ry="7" fill="#F8FAFC" opacity="0.8" />
                <circle
                  cx="230"
                  cy="95"
                  r="26"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />

                {/* Heavy sealed blast door on right */}
                <rect x="378" y="20" width="24" height="150" fill="#2A3241" stroke="#FFD166" strokeWidth="2" />
                <line x1="378" y1="95" x2="402" y2="95" stroke="#EF4444" strokeWidth="3" />

                {/* CCTV overlay metadata */}
                <text
                  x="14"
                  y="22"
                  fill="#E2E8F0"
                  fontFamily="SFMono-Regular, Menlo, Consolas, monospace"
                  fontSize="10"
                  fontWeight="700"
                >
                  CAM-05 · DECOY CHAMBER · SEALED
                </text>
                <text
                  x="14"
                  y="178"
                  fill="#E63946"
                  fontFamily="SFMono-Regular, Menlo, Consolas, monospace"
                  fontSize="10"
                  fontWeight="700"
                >
                  SWAT BREACH: SUSPECT DISSOLVED ON CONTACT
                </text>
              </svg>
            </div>

            <div className="mt-3 font-broadsheet text-sm leading-relaxed text-[#26231F]">
              <p>
                <strong>MADRID —</strong> Tactical units breaching the Royal
                Mint&apos;s inner bullion hall found the blast doors locked from
                within and a lone figure in a crimson jumpsuit standing calmly
                inside the glass override chamber. Seconds after officers forced
                the seal, the figure flickered out of existence—leaving an empty
                vault and no trace of the real thief.
              </p>
            </div>
          </div>

          {/* Right Column: Official Heist Statistics & Rank */}
          <div className="col-span-5 flex flex-col justify-between">
            <div>
              <div className="border-b-2 border-[#1A1A1A] pb-1.5 font-mono-timer text-xs font-bold tracking-[0.2em] text-[#1A1A1A]">
                POLICE FORENSIC LEDGER
              </div>

              <dl className="mt-3 space-y-2.5">
                <div className="flex items-baseline justify-between border-b border-[#1A1A1A]/15 pb-2">
                  <dt className="font-mono-timer text-xs tracking-wider text-[#4B463F]">
                    TOTAL LOOPS USED
                  </dt>
                  <dd className="font-mono-timer text-xl font-black text-[#141414]">
                    {stats.totalLoopsUsed}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between border-b border-[#1A1A1A]/15 pb-2">
                  <dt className="font-mono-timer text-xs tracking-wider text-[#4B463F]">
                    ECHOES LEFT BEHIND
                  </dt>
                  <dd className="font-mono-timer text-xl font-black text-[#141414]">
                    {stats.echoesLeftBehind}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between border-b border-[#1A1A1A]/15 pb-2">
                  <dt className="font-mono-timer text-xs tracking-wider text-[#4B463F]">
                    TOTAL HEIST TIME
                  </dt>
                  <dd className="font-mono-timer text-xl font-black text-[#141414]">
                    {formatHeistTime(stats.totalHeistSeconds)}
                  </dd>
                </div>
              </dl>

              {/* Heist Rank Stamp */}
              <div className="mt-4 flex items-center justify-between border-2 border-[#1A1A1A] bg-[#EAE1D2] px-4 py-3">
                <div>
                  <div className="font-mono-timer text-[11px] font-bold tracking-[0.2em] text-[#4B463F]">
                    MASTERMIND RANK
                  </div>
                  <div className="mt-0.5 font-mono-timer text-[10px] text-[#575148]">
                    S ≤ 10 · A ≤ 15 · B 16+ LOOPS
                  </div>
                </div>
                <div
                  data-testid="heist-rank"
                  className="flex h-14 w-14 items-center justify-center border-2 border-[#C81E2B] font-display text-4xl font-black text-[#C81E2B]"
                >
                  {stats.rank}
                </div>
              </div>
            </div>

            {/* Architect Sign-off */}
            <blockquote className="mt-3 border-t border-[#1A1A1A]/20 pt-2.5 font-broadsheet text-xs italic text-[#3F3A33]">
              &ldquo;They brought forty officers to catch one ghost. Enjoy the
              gold, Kyoto.&rdquo; — The Architect
            </blockquote>
          </div>
        </div>

        {/* Footer Action Bar */}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#1A1A1A] pt-3.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onReplayHeist();
            }}
            className="cursor-pointer bg-[#C81E2B] px-6 py-2.5 font-mono-timer text-xs font-bold tracking-[0.18em] text-white transition-colors hover:bg-[#991B1B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414] whitespace-nowrap shrink-0"
          >
            REPLAY HEIST
          </button>

          <div className="flex items-center gap-2">
            <span className="mr-1 font-mono-timer text-[11px] font-bold tracking-[0.14em] text-[#4B463F]">
              JUMP TO CHAPTER:
            </span>
            {LEVELS.map((lvl, idx) => (
              <button
                key={lvl.chapter}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onJumpToChapter(idx);
                }}
                title={`Chapter ${lvl.chapter}: ${lvl.title} (${lvl.planName})`}
                className="cursor-pointer border border-[#1A1A1A] bg-[#F8F4EC] px-3 py-1.5 font-mono-timer text-xs font-bold text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#F2ECE1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C81E2B] whitespace-nowrap shrink-0"
              >
                CH {lvl.chapter}
              </button>
            ))}
          </div>
        </footer>
      </article>
    </div>
  );
};
