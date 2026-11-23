import React, { useEffect } from 'react';
import { LevelDef } from '../types';

interface ChapterCardProps {
  level: LevelDef;
  onComplete: () => void;
}

export const ChapterCard: React.FC<ChapterCardProps> = ({
  level,
  onComplete,
}) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, 2000);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onComplete();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onComplete]);

  return (
    <div
      role="dialog"
      aria-label={`Chapter ${level.chapter}: ${level.planName}`}
      onClick={onComplete}
      className="fixed inset-0 z-30 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#07090D] select-none"
    >
      {/* Dramatic crimson diagonal slash band */}
      <div
        aria-hidden="true"
        className="animate-slash-enter pointer-events-none absolute h-56 w-[130%] -rotate-3 bg-[#E63946] opacity-95"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-64 w-[130%] -rotate-3 border-y border-[#F8FAFC]/20"
      />

      {/* Chapter typography lockup */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="mb-2 font-mono-timer text-sm font-bold tracking-[0.34em] text-[#07090D]">
          CHAPTER {level.chapter} OF 5
        </div>

        <h1 className="font-display text-6xl font-black tracking-[0.08em] text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)] md:text-7xl">
          CHAPTER {level.chapter} <span className="text-[#07090D]">/</span>{' '}
          {level.planName}
        </h1>

        <div className="mt-3 flex items-center gap-4 text-sm font-mono-timer font-semibold tracking-[0.2em] text-[#FEF2F2]">
          <span>{level.title.toUpperCase()}</span>
          <span aria-hidden="true">·</span>
          <span>PAR {level.parLoops} {level.parLoops === 1 ? 'LOOP' : 'LOOPS'}</span>
        </div>
      </div>

      {/* Bottom skip prompt */}
      <div className="absolute bottom-8 z-10 font-mono-timer text-xs tracking-[0.2em] text-[#94A3B8]">
        PRESS SPACE OR CLICK TO DEPLOY
      </div>
    </div>
  );
};
