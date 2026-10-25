import React from 'react';

const MARK_SIZES = {
  sm: 'h-8 w-8 rounded-[0.6rem]',
  md: 'h-9 w-9 rounded-[0.7rem]',
  lg: 'h-11 w-11 rounded-[0.85rem]',
};

const ICON_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
};

const TEXT_SIZES = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

export default function Brand({
  size = 'md',
  inverted = false,
  showWordmark = true,
  className = '',
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`relative flex shrink-0 items-center justify-center ${
          MARK_SIZES[size]
        } ${
          inverted
            ? 'bg-white text-accent ring-1 ring-white/20'
            : 'bg-accent text-white'
        }`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className={ICON_SIZES[size]}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
        </svg>
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-pop-yellow ring-2 ${
            inverted ? 'ring-[#26086E]' : 'ring-panel'
          }`}
        />
      </span>
      {showWordmark && (
        <span
          className={`font-display font-extrabold leading-none tracking-[-0.055em] ${
            TEXT_SIZES[size]
          } ${inverted ? 'text-white' : 'text-ink'}`}
        >
          tdl
          <span className={inverted ? 'text-pop-yellow' : 'text-accent'}>.</span>
        </span>
      )}
    </span>
  );
}
