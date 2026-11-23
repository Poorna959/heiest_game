import React from 'react';
import { RivalStatsSnapshot } from '../types';

interface RivalNewspaperEndingProps {
  stats: RivalStatsSnapshot;
  onRematch: () => void;
  onToggleBotRematch: () => void;
  onReturnTitle: () => void;
}

export const RivalNewspaperEnding: React.FC<RivalNewspaperEndingProps> = ({
  stats,
  onRematch,
  onToggleBotRematch,
  onReturnTitle,
}) => {
  const headline =
    stats.winner === 'P1'
      ? 'KYOTO OUTSMARTS OSLO — CRIMSON CREW SWEEPS THE MINT'
      : stats.winner === 'P2'
      ? 'OSLO OUTSMARTS KYOTO — COBALT CREW SWEEPS THE MINT'
      : 'ROYAL MINT DEADLOCK — KYOTO AND OSLO SPLIT THE GOLD';

  const stampText =
    stats.winner === 'P1'
      ? 'KYOTO WINS'
      : stats.winner === 'P2'
      ? 'OSLO WINS'
      : 'DRAW';

  const stampColor =
    stats.winner === 'P2'
      ? 'border-[#0284C7] text-[#0284C7]'
      : 'border-[#C81E2B] text-[#C81E2B]';

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0A0C10] p-4 md:p-6 select-none">
      <article className="relative flex max-h-full w-full max-w-[1040px] flex-col border-2 border-[#1A1A1A] bg-[#F2ECE1] px-7 py-5 text-[#141414] shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
        {/* Masthead */}
        <header className="border-b-4 border-double border-[#1A1A1A] pb-2.5">
          <div className="flex items-center justify-between font-mono-timer text-[11px] font-semibold tracking-[0.18em] text-[#4B463F]">
            <span>RIVAL HEIST EDITION · 6-LOOP SHOWDOWN</span>
            <span>ROYAL MINT SPECIAL DISPATCH</span>
            <span>{stats.vsBot ? 'MODE: 1P VS AI BOT' : 'MODE: 2P LOCAL'}</span>
          </div>

          <div className="relative mt-1 flex items-center justify-center">
            <h1 className="font-broadsheet text-center text-4xl font-black tracking-[0.08em] text-[#111111] md:text-5xl">
              THE ROYAL CHRONICLE
            </h1>

            <div
              data-testid="rival-winner-stamp"
              className={`pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rotate-[-7deg] border-2 px-2.5 py-0.5 font-mono-timer text-xs font-black tracking-[0.2em] ${stampColor}`}
            >
              {stampText}
            </div>
          </div>
        </header>

        {/* Headline */}
        <section className="border-b border-[#1A1A1A]/30 py-3 text-center">
          <h2 className="font-broadsheet text-2xl font-black leading-tight tracking-tight text-[#111111] md:text-3xl">
            {headline}
          </h2>
          <p className="mt-1 font-mono-timer text-xs tracking-[0.14em] text-[#575148]">
            FINAL SCORE: KYOTO {stats.p1Score} — OSLO {stats.p2Score} · SIX
            TEN-SECOND LOOPS LEAVE VAULT STRIPPED CLEAN
          </p>
        </section>

        {/* 2-Column Editorial Debrief */}
        <div className="grid flex-1 grid-cols-12 gap-6 py-4">
          {/* Left: High-Contrast Rivalry CCTV Print + Story */}
          <div className="col-span-6 flex flex-col justify-between border-r border-[#1A1A1A]/20 pr-6">
            <div className="border-2 border-[#1A1A1A] bg-[#10141C] p-2">
              <svg
                viewBox="0 0 420 175"
                className="h-auto w-full"
                role="img"
                aria-label="Security still of rival crimson and cobalt thieves clashing inside the Royal Vault"
              >
                <rect x="0" y="0" width="420" height="175" fill="#0B0F17" />
                <g stroke="#1E293B" strokeWidth="1">
                  <line x1="0" y1="44" x2="420" y2="44" />
                  <line x1="0" y1="88" x2="420" y2="88" />
                  <line x1="0" y1="132" x2="420" y2="132" />
                  <line x1="105" y1="0" x2="105" y2="175" />
                  <line x1="210" y1="0" x2="210" y2="175" />
                  <line x1="315" y1="0" x2="315" y2="175" />
                </g>

                {/* Center Crown pedestal */}
                <rect
                  x="155"
                  y="32"
                  width="110"
                  height="110"
                  fill="rgba(255,209,102,0.06)"
                  stroke="#FFD166"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <polygon
                  points="196,95 194,79 203,87 210,73 217,87 226,79 224,95"
                  fill="#FFD166"
                  stroke="#FFFBEB"
                  strokeWidth="1.5"
                />

                {/* Crimson Kyoto figure left */}
                <circle
                  cx="104"
                  cy="88"
                  r="19"
                  fill="#E63946"
                  stroke="#F8FAFC"
                  strokeWidth="2"
                />
                <ellipse cx="110" cy="88" rx="6" ry="8" fill="#F8FAFC" />

                {/* Cobalt Oslo figure right */}
                <circle
                  cx="316"
                  cy="88"
                  r="19"
                  fill="#38BDF8"
                  stroke="#F8FAFC"
                  strokeWidth="2"
                />
                <ellipse cx="310" cy="88" rx="6" ry="8" fill="#F8FAFC" />

                <text
                  x="14"
                  y="20"
                  fill="#E2E8F0"
                  fontFamily="SFMono-Regular, Menlo, Consolas, monospace"
                  fontSize="10"
                  fontWeight="700"
                >
                  ROYAL VAULT · RIVALRY SURVEILLANCE STILL
                </text>
                <text
                  x="14"
                  y="163"
                  fill="#FFD166"
                  fontFamily="SFMono-Regular, Menlo, Consolas, monospace"
                  fontSize="10"
                  fontWeight="700"
                >
                  KYOTO {stats.p1Score} PTS vs OSLO {stats.p2Score} PTS
                </text>
              </svg>
            </div>

            <p className="mt-3 font-broadsheet text-sm leading-relaxed text-[#26231F]">
              <strong>MADRID —</strong> Investigators reviewing sixty seconds of
              layered surveillance footage confirmed two rival chronometer crews
              clashed simultaneously inside the Royal Vault, deploying
              holographic Guards, Hackers, and Runners to raid each other&apos;s
              stashes before vanishing with the bullion and the Royal Crown.
            </p>
          </div>

          {/* Right: Head-to-Head Forensic Ledger */}
          <div className="col-span-6 flex flex-col justify-between">
            <div>
              <div className="grid grid-cols-3 border-b-2 border-[#1A1A1A] pb-1.5 font-mono-timer text-xs font-black tracking-[0.14em]">
                <span>FORENSIC METRIC</span>
                <span className="text-right text-[#C81E2B]">KYOTO (P1)</span>
                <span className="text-right text-[#0284C7]">
                  OSLO ({stats.vsBot ? 'BOT' : 'P2'})
                </span>
              </div>

              <div className="mt-2 divide-y divide-[#1A1A1A]/15 font-mono-timer">
                <div className="grid grid-cols-3 items-baseline py-2.5">
                  <span className="text-xs font-semibold text-[#4B463F]">
                    BANKED GOLD SCORE
                  </span>
                  <span className="text-right text-2xl font-black text-[#C81E2B]">
                    {stats.p1Score}
                  </span>
                  <span className="text-right text-2xl font-black text-[#0284C7]">
                    {stats.p2Score}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-baseline py-2.5">
                  <span className="text-xs font-semibold text-[#4B463F]">
                    GOLD STOLEN
                  </span>
                  <span className="text-right text-xl font-bold text-[#141414]">
                    {stats.p1Stolen}
                  </span>
                  <span className="text-right text-xl font-bold text-[#141414]">
                    {stats.p2Stolen}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-baseline py-2.5">
                  <span className="text-xs font-semibold text-[#4B463F]">
                    STUNS LANDED
                  </span>
                  <span className="text-right text-xl font-bold text-[#141414]">
                    {stats.p1Stuns}
                  </span>
                  <span className="text-right text-xl font-bold text-[#141414]">
                    {stats.p2Stuns}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-baseline py-2.5">
                  <span className="text-xs font-semibold text-[#4B463F]">
                    ECHOES DEPLOYED
                  </span>
                  <span className="text-right text-xl font-bold text-[#141414]">
                    {stats.p1EchoesDeployed}
                  </span>
                  <span className="text-right text-xl font-bold text-[#141414]">
                    {stats.p2EchoesDeployed}
                  </span>
                </div>
              </div>
            </div>

            <blockquote className="mt-3 border-t border-[#1A1A1A]/20 pt-2.5 font-broadsheet text-xs italic text-[#3F3A33]">
              &ldquo;Two chronometers in one vault. Only one crew walks out rich.&rdquo;
              — The Architect
            </blockquote>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#1A1A1A] pt-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRematch();
              }}
              className="cursor-pointer bg-[#C81E2B] px-6 py-2.5 font-mono-timer text-xs font-bold tracking-[0.18em] text-white transition-colors hover:bg-[#991B1B] whitespace-nowrap shrink-0"
            >
              REMATCH
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleBotRematch();
              }}
              className="cursor-pointer border border-[#1A1A1A] bg-[#EAE1D2] px-4 py-2.5 font-mono-timer text-xs font-bold tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#F2ECE1] whitespace-nowrap shrink-0"
            >
              {stats.vsBot ? 'SWITCH TO 2P LOCAL' : 'SWITCH TO VS AI BOT'}
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onReturnTitle();
            }}
            className="cursor-pointer border border-[#1A1A1A] bg-[#F8F4EC] px-4 py-2.5 font-mono-timer text-xs font-bold tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#F2ECE1] whitespace-nowrap shrink-0"
          >
            TITLE SCREEN
          </button>
        </footer>
      </article>
    </div>
  );
};
