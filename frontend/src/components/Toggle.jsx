import React from 'react';

/**
 * Accessible switch used across settings surfaces. Renders a real checkbox so
 * keyboard and screen-reader behavior comes for free.
 */
export default function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <label
      className={`flex items-start justify-between gap-4 py-3 ${
        disabled ? 'opacity-60' : 'cursor-pointer'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full border border-line bg-surface-2 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 peer-checked:border-accent peer-checked:bg-accent"
      >
        <span className="absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-faint shadow transition-all duration-200 peer-checked:left-6 peer-checked:bg-white" />
      </span>
    </label>
  );
}
