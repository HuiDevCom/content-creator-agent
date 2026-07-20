'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: { value: string; label: string }[];
}

export function CustomSelect({ label, value, onChange, disabled, options }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors",
          open
            ? "border-brand-500 ring-2 ring-brand-500/20"
            : "border-gray-300 dark:border-gray-600",
          disabled
            ? "bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500 cursor-not-allowed"
            : "bg-white text-gray-900 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500"
        )}
      >
        <span className={!selected ? 'text-gray-400' : ''}>
          {selected?.label || label}
        </span>
        <svg
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="relative">
          <div className="absolute top-0 z-50 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-sm transition-colors",
                  opt.value === value
                    ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-900/20 dark:text-brand-400"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                )}
              >
                <span className="flex-1 text-left">{opt.label}</span>
                {opt.value === value && (
                  <svg className="h-4 w-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}