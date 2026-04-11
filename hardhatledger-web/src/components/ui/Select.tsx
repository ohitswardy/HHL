import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
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
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [openUpward, setOpenUpward] = useState(false);
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

  const computePanelStyle = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const PANEL_MAX_H = 274; // max-height 260px + borders + gap buffer
    const GAP = 6;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const flyUp = spaceBelow < PANEL_MAX_H && spaceAbove > spaceBelow;
    setOpenUpward(flyUp);
    if (flyUp) {
      setPanelStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + GAP,
        left: rect.left,
        width: rect.width,
        zIndex: 1100,
      });
    } else {
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + GAP,
        left: rect.left,
        width: rect.width,
        zIndex: 1100,
      });
    }
  }, []);

  // Close on outside click — must also check portal panel clicks
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the container or the portal panel
      const panelEl = document.getElementById(`${id}-list`);
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(panelEl && panelEl.contains(target))
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, id]);

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

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => computePanelStyle();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, computePanelStyle]);

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
          if (!isOpen) { computePanelStyle(); setIsOpen(true); }
          else if (focusedIdx >= 0 && focusedIdx < filtered.length) { doSelect(filtered[focusedIdx]); }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) { computePanelStyle(); setIsOpen(true); }
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
    [disabled, isOpen, focusedIdx, filtered, doSelect, computePanelStyle],
  );

  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;

  return (
    <div ref={containerRef} className={`w-full ${inline ? 'neu-select-inline' : ''} ${className}`}>
      {label && <label className="neu-label" htmlFor={triggerId}>{label}</label>}
      <div
        className={`neu-inset${error ? ' shadow-[inset_3px_3px_6px_var(--n-shadow-dark-sm),inset_-3px_-3px_6px_var(--n-shadow-light-sm),0_0_0_1.5px_var(--n-danger)]' : ''}`}
        style={{ position: 'relative' }}
      >
        <button
          type="button"
          id={triggerId}
          className={`neu-select-trigger${!selectedOption ? ' placeholder' : ''}`}
          onClick={() => { if (!disabled) { computePanelStyle(); setIsOpen((v) => !v); } }}
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

      {isOpen && createPortal(
        <div className={`neu-select-panel${openUpward ? ' open-upward' : ''}`} role="listbox" id={listId} aria-label={label || 'Options'} style={panelStyle}>
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
        </div>,
        document.body,
      )}
      {error && <p className="neu-error">{error}</p>}
    </div>
  );
}

export type { SelectProps };
