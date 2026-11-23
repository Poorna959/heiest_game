import React from 'react';
import { Shield, Terminal, Zap } from 'lucide-react';
import { RIVAL_TOTAL_LOOPS, RivalRole } from '../types';

interface AssignDutyOverlayProps {
  completedLoop: number;
  remainingSeconds: number;
  p1Selection: RivalRole | null;
  p2Selection: RivalRole | null;
  vsBot: boolean;
  onSelectP1: (role: RivalRole) => void;
  onSelectP2: (role: RivalRole) => void;
}

const ROLES: {
  role: RivalRole;
  title: string;
  p1Key: string;
  p2Key: string;
  desc: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  {
    role: 'GUARD',
    title: 'GUARD',
    p1Key: '1',
    p2Key: 'J',
    desc: 'Patrols path · Stuns rival or Runners 1.2s & knocks gold loose',
    Icon: Shield,
  },
  {
    role: 'HACKER',
    title: 'HACKER',
    p1Key: '2',
    p2Key: 'K',
    desc: 'Activates biometric plates to open linked vault laser gates',
    Icon: Terminal,
  },
  {
    role: 'RUNNER',
    title: 'RUNNER',
    p1Key: '3',
    p2Key: 'L',
    desc: 'Replays at 1.2x speed · Auto-loots vault, floor & rival stash',
    Icon: Zap,
  },
];

export const AssignDutyOverlay: React.FC<AssignDutyOverlayProps> = ({
  completedLoop,
  remainingSeconds,
  p1Selection,
  p2Selection,
  vsBot,
  onSelectP1,
  onSelectP2,
}) => {
  const pct = Math.max(0, Math.min(100, (remainingSeconds / 3.0) * 100));
  const nextLoop = completedLoop + 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Assign Echo Duty"
      data-testid="assign-duty-overlay"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#07090D]/88 p-4 select-none"
    >
      <div className="w-full max-w-[920px] border border-[#334155] bg-[#0D111A] p-6 shadow-2xl">
        {/* Top Header + 3.0s Countdown Bar */}
        <div className="flex items-end justify-between border-b border-[#1E293B] pb-3">
          <div>
            <div className="font-mono-timer text-xs font-bold tracking-[0.22em] text-[#FFD166]">
              LOOP {completedLoop} COMPLETE · PREPARING LOOP {nextLoop} OF{' '}
              {RIVAL_TOTAL_LOOPS}
              {nextLoop === RIVAL_TOTAL_LOOPS
                ? ' (GOLDEN CROWN + 2 LASERS)'
                : ''}
            </div>
            <h2 className="mt-1 font-display text-3xl font-black tracking-[0.06em] text-white">
              ASSIGN ECHO DUTY
            </h2>
          </div>

          <div className="text-right">
            <div className="font-mono-timer text-[10px] tracking-[0.18em] text-[#94A3B8]">
              DEFAULT: RUNNER
            </div>
            <div className="font-mono-timer text-2xl font-black text-[#FFD166]">
              {remainingSeconds.toFixed(1)}s
            </div>
          </div>
        </div>

        <div className="mt-2 h-1.5 w-full bg-[#1E293B]">
          <div
            className="h-full bg-[#FFD166] transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Split P1 (Kyoto Crimson) vs P2 (Oslo Cobalt) Selection Panels */}
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* P1 Column */}
          <div className="border border-[#E63946]/50 bg-[#121622] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono-timer text-xs font-black tracking-[0.16em] text-[#E63946]">
                P1 · KYOTO (KEYS 1 / 2 / 3)
              </div>
              <div className="font-mono-timer text-[11px] font-bold text-[#CBD5E1]">
                {p1Selection ? `LOCKED: ${p1Selection}` : 'WAITING...'}
              </div>
            </div>

            <div className="space-y-2.5">
              {ROLES.map(({ role, title, p1Key, desc, Icon }) => {
                const selected = p1Selection === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectP1(role);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-3 border px-3.5 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-[#E63946] bg-[#E63946]/20 text-white'
                        : 'border-[#334155] bg-[#0B0E16] text-[#CBD5E1] hover:border-[#E63946]/70'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center border font-mono-timer text-sm font-black ${
                        selected
                          ? 'border-[#E63946] bg-[#E63946] text-white'
                          : 'border-[#475569] bg-[#141923] text-[#F8FAFC]'
                      }`}
                    >
                      {p1Key}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-mono-timer text-xs font-black tracking-[0.12em]">
                        <Icon className="h-3.5 w-3.5 text-[#E63946]" />
                        <span>{title}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-[#94A3B8]">
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* P2 Column */}
          <div className="border border-[#38BDF8]/50 bg-[#121622] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono-timer text-xs font-black tracking-[0.16em] text-[#38BDF8]">
                P2 · OSLO {vsBot ? '(AI BOT)' : '(KEYS J / K / L)'}
              </div>
              <div className="font-mono-timer text-[11px] font-bold text-[#CBD5E1]">
                {p2Selection ? `LOCKED: ${p2Selection}` : 'WAITING...'}
              </div>
            </div>

            <div className="space-y-2.5">
              {ROLES.map(({ role, title, p2Key, desc, Icon }) => {
                const selected = p2Selection === role;
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={vsBot}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectP2(role);
                    }}
                    className={`flex w-full items-center gap-3 border px-3.5 py-2.5 text-left transition-colors ${
                      vsBot ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      selected
                        ? 'border-[#38BDF8] bg-[#38BDF8]/20 text-white'
                        : 'border-[#334155] bg-[#0B0E16] text-[#CBD5E1] hover:border-[#38BDF8]/70'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center border font-mono-timer text-sm font-black ${
                        selected
                          ? 'border-[#38BDF8] bg-[#38BDF8] text-[#07090D]'
                          : 'border-[#475569] bg-[#141923] text-[#F8FAFC]'
                      }`}
                    >
                      {p2Key}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-mono-timer text-xs font-black tracking-[0.12em]">
                        <Icon className="h-3.5 w-3.5 text-[#38BDF8]" />
                        <span>{title}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-[#94A3B8]">
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
