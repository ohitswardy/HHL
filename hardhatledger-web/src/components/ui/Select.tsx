import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { HiCheck, HiChevronDown } from 'react-icons/hi';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  /** Show a search box when options exceed this count (default: 7) */
  searchThreshold?: number;
  /** Inline variant for filter bars (smaller padding) */
  inline?: boolean;
  name?: string;
  required?: boolean;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  value,
  onChange,
  disabled,
  className = '',
  searchThreshold = 7,
  inline = false,
  name,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const showSearch = options.length > searchThreshold;

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (isOpen) {
      const idx = filtered.findIndex((o) => String(o.value) === String(value));
      setFocusedIdx(idx >= 0 ? idx : 0);
    }
  }, [isOpen]);

  // Scroll focused option into view
  useEffect(() => {
    if (!isOpen || focusedIdx < 0) return;
    const el = listRef.current?.children[focusedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, isOpen]);

  const doSelect = useCallback(
    (opt: SelectOption) => {
      onChange?.({ target: { value: String(opt.value) } });
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) { setIsOpen(true); }
          else if (focusedIdx >= 0 && focusedIdx < filtered.length) { doSelect(filtered[focusedIdx]); }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) { setIsOpen(true); }
          else { setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) setFocusedIdx((i) => Math.max(i - 1, 0));
          break;
        case 'Escape':
          setIsOpen(false);
          setSearch('');
          break;
        case 'Tab':
          if (isOpen) { setIsOpen(false); setSearch(''); }
          break;
      }
    },
    [disabled, isOpen, focusedIdx, filtered, doSelect],
  );

  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;

  return (
    <div ref={containerRef} className={`w-full ${inline ? 'neu-select-inline' : ''} ${className}`} style={{ position: 'relative' }}>
      {label && <label className="neu-label" htmlFor={triggerId}>{label}</label>}
      <div
        className={`neu-inset${error ? ' shadow-[inset_3px_3px_6px_var(--n-shadow-dark-sm),inset_-3px_-3px_6px_var(--n-shadow-light-sm),0_0_0_1.5px_var(--n-danger)]' : ''}`}
        style={{ position: 'relative' }}
      >
        <button
          type="button"
          id={triggerId}
          className={`neu-select-trigger${!selectedOption ? ' placeholder' : ''}`}
          onClick={() => !disabled && setIsOpen((v) => !v)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-label={label || placeholder}
        >
          {selectedOption ? selectedOption.label : placeholder || 'Select\u2026'}
        </button>
        <HiChevronDown className={`neu-select-chevron${isOpen ? ' open' : ''}`} style={{ width: 14, height: 14 }} />
        {name && <input type="hidden" name={name} value={value ?? ''} />}
      </div>

      {isOpen && (
        <div className="neu-select-panel" role="listbox" id={listId} aria-label={label || 'Options'}>
          {showSearch && (
            <div className="neu-select-search">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search\u2026"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setFocusedIdx(0); }}
                onKeyDown={handleKeyDown}
                aria-label="Search options"
              />
            </div>
          )}
          <div className="neu-select-options" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="neu-select-empty">No matches</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`neu-select-option${isSelected ? ' selected' : ''}${idx === focusedIdx ? ' focused' : ''}`}
                    onClick={() => doSelect(opt)}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>{opt.label}</span>
                    <HiCheck className="check-icon" style={{ width: 14, height: 14 }} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
      {error && <p className="neu-error">{error}</p>}
    </div>
  );
}

export type { SelectProps };
