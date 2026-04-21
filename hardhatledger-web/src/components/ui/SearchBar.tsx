import { forwardRef, type InputHTMLAttributes } from 'react';
import { HiSearch, HiX } from 'react-icons/hi';

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Controlled string value */
  value: string;
  /** Called with the new string value on every keystroke */
  onChange: (value: string) => void;
  /** Optional label rendered above the input */
  label?: string;
  /** Shows a spinning indicator inside the input while true */
  isLoading?: boolean;
  /** Extra classes applied to the outer wrapper div */
  containerClassName?: string;
}

/**
 * SearchBar — a self-contained neumorphic search input with:
 * - Search / loading icon on the left
 * - One-click clear (×) button on the right when the field has a value
 * - Optional accessible label above the field
 *
 * Uses `neu-inline-input` so it fits naturally inside filter cards.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      label,
      isLoading = false,
      containerClassName = '',
      className = '',
      placeholder = 'Search…',
      ...rest
    },
    ref,
  ) => {
    return (
      <div className={`w-full ${containerClassName}`} role="search">
        {label && (
          <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1 uppercase tracking-wide">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {/* Left icon — search glyph or spinner */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--n-text-dim)]"
          >
            {isLoading ? (
              <span
                className="block w-4 h-4 rounded-full border-2 border-[var(--n-text-dim)] border-t-[var(--n-accent)] animate-spin"
                role="status"
                aria-label="Loading"
              />
            ) : (
              <HiSearch className="w-4 h-4" />
            )}
          </span>

          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`neu-inline-input w-full pl-9 ${value ? 'pr-8' : 'pr-3'} ${className}`}
            aria-label={label ?? placeholder}
            {...rest}
          />

          {/* Clear button — only visible when there is a value */}
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-[var(--n-text-dim)] hover:text-[var(--n-text)] hover:bg-[var(--n-inset)] transition-colors"
            >
              <HiX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';
