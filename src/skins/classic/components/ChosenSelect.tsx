import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export interface ChosenOption {
  value: string;
  label: string;
}

interface ClassicChosenSelectProps {
  /** Id of the search input, for an external `<label htmlFor>`. */
  id?: string;
  options: ChosenOption[];
  /** Selected values. Reported back in option order. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Shown while nothing is selected: legacy's `data-placeholder`. */
  placeholder?: string;
  /** Renders legacy's clear (×) button inside the box, at its end. */
  onClear?: () => void;
  clearLabel?: string;
  /** Width utility for the box. */
  className?: string;
}

/**
 * Legacy's Chosen multi-select (`chosen.jquery.js` with ZoneMinder's skin
 * overrides): picks show as removable chips in a single text-like box, typing
 * filters the drop-down, already-picked options stay listed but greyed, and
 * Backspace in the empty search removes the last chip. Picking closes the
 * drop-down unless Ctrl/Cmd is held, as Chosen's `hide_results_on_select`.
 *
 * The input is an ARIA combobox over a multi-selectable listbox. Picked
 * options are `aria-selected` and skipped by the arrow keys, as Chosen skips
 * them; the keyboard removes a pick with Backspace.
 */
export function ClassicChosenSelect({
  id, options, value, onChange, placeholder, onClear, clearLabel, className,
}: ClassicChosenSelectProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const inputId = id ?? `${baseId}-input`;
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // Chosen's `chosen-container-active`: the box, not the input, shows focus.
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);

  const selected = new Set(value);
  const chips = options.filter((o) => selected.has(o.value));
  const needle = query.trim().toLocaleLowerCase();
  // search_contains: a match anywhere in the label, not only at a word start.
  const shown = needle ? options.filter((o) => o.label.toLocaleLowerCase().includes(needle)) : options;
  const firstFree = (from: number, step: 1 | -1) => {
    for (let i = from; i >= 0 && i < shown.length; i += step) {
      if (!selected.has(shown[i].value)) return i;
    }
    return -1;
  };

  const report = (next: Set<string>) => {
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  };
  const pick = (option: ChosenOption, keepOpen: boolean) => {
    const next = new Set(selected);
    if (next.has(option.value)) next.delete(option.value);
    else next.add(option.value);
    report(next);
    setQuery('');
    if (!keepOpen) {
      setOpen(false);
      setActive(-1);
    }
  };
  const remove = (v: string) => {
    const next = new Set(selected);
    next.delete(v);
    report(next);
  };
  const openList = () => {
    if (!open) {
      setOpen(true);
      setActive(firstFree(0, 1));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!open) { openList(); return; }
        const next = firstFree(active + 1, 1);
        if (next !== -1) setActive(next);
        return;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = firstFree(active - 1, -1);
        if (prev !== -1) setActive(prev);
        return;
      }
      case 'Enter':
        if (open && active >= 0 && active < shown.length) {
          e.preventDefault();
          pick(shown[active], e.ctrlKey || e.metaKey);
        }
        return;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        return;
      case 'Backspace':
        if (query === '' && chips.length > 0) {
          e.preventDefault();
          remove(chips[chips.length - 1].value);
        }
        return;
      case 'Tab':
        setOpen(false);
        return;
    }
  };

  // Keep focus in the input while the pointer works the chips and the list.
  const keepFocus = (e: MouseEvent) => e.preventDefault();

  const activeId = open && active >= 0 && active < shown.length ? `${baseId}-opt-${active}` : undefined;

  return (
    <div
      className={clsx('relative text-start text-[13px]', className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
          setOpen(false);
          setActive(-1);
          setQuery('');
        }
      }}
    >
      <ul
        onMouseDown={(e) => {
          if (e.target !== inputRef.current) e.preventDefault();
          inputRef.current?.focus();
          openList();
        }}
        className={clsx(
          'm-0 flex min-h-[29px] w-full cursor-text list-none flex-wrap items-center overflow-hidden',
          'rounded-[4px] border bg-white bg-[linear-gradient(#eee_1%,#fff_15%)] ps-[5px]',
          onClear ? 'pe-8' : 'pe-[5px]',
          focused ? 'border-[#5897fb] shadow-[0_0_5px_rgba(0,0,0,0.3)]' : 'border-[rgb(200,200,200)]',
        )}
      >
        {chips.map((o) => (
          <li
            key={o.value}
            className={clsx(
              'relative my-[3px] me-[5px] max-w-full cursor-default break-words rounded-[3px] border border-[#aaa]',
              'bg-[#eee] bg-[linear-gradient(#f4f4f4_20%,#f0f0f0_50%,#e8e8e8_52%,#eee_100%)] bg-[length:100%_19px] bg-repeat-x',
              'py-[3px] ps-[5px] pe-5 leading-[13px] text-[#333] shadow-[inset_0_0_2px_#fff,0_1px_0_rgba(0,0,0,0.05)]',
            )}
          >
            <span>{o.label}</span>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={keepFocus}
              onClick={() => remove(o.value)}
              aria-label={t('Remove {{label}}', { label: o.label })}
              className="absolute end-[3px] top-[3px] flex h-3 w-3 items-center justify-center text-[#888] hover:text-[#222]"
            >
              <X size={10} strokeWidth={3} aria-hidden />
            </button>
          </li>
        ))}
        <li className={clsx('m-0 p-0 whitespace-nowrap', chips.length === 0 && 'flex-1')}>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeId}
            value={query}
            placeholder={chips.length === 0 ? (placeholder ?? t('All')) : undefined}
            onFocus={() => { setFocused(true); openList(); }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              const n = e.target.value.trim().toLocaleLowerCase();
              const list = n ? options.filter((o) => o.label.toLocaleLowerCase().includes(n)) : options;
              setActive(list.findIndex((o) => !selected.has(o.value)));
            }}
            onKeyDown={onKeyDown}
            // Inline, because the global :focus-visible ring is unlayered and
            // beats a utility; the box carries the focus style instead.
            style={{ outline: 'none', ...(chips.length > 0 ? { width: `${Math.max(query.length + 1, 2)}ch` } : {}) }}
            className={clsx(
              'my-px h-[25px] border-0 bg-transparent p-0 font-sans text-[#999] outline-none focus:text-[#222]',
              'placeholder:text-[#999]',
              chips.length === 0 && 'w-full',
            )}
          />
        </li>
      </ul>
      {onClear && (
        <button
          type="button"
          onClick={() => { onClear(); setQuery(''); }}
          disabled={value.length === 0}
          aria-label={clearLabel ?? t('Clear')}
          className={clsx(
            'absolute end-[3px] top-[2.5px] flex h-6 w-7 items-center justify-center rounded-[3px]',
            'border border-[#ccc] bg-white/90 text-[#666] hover:bg-zinc-100 disabled:text-zinc-300 disabled:hover:bg-white/90',
          )}
        >
          <X size={16} aria-hidden />
        </button>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={inputId}
          onMouseDown={keepFocus}
          className={clsx(
            'absolute start-0 top-full z-[1010] m-0 max-h-60 w-full list-none overflow-y-auto p-0',
            'rounded-b-[4px] border border-t-0 border-[#aaa] bg-white text-[#444] shadow-[0_4px_5px_rgba(0,0,0,0.15)]',
          )}
        >
          {shown.length === 0 && (
            <li className="bg-[#f4f4f4] px-1.5 py-[5px] leading-[15px] text-[#777]">
              {t('No results match')} <span>&ldquo;{query}&rdquo;</span>
            </li>
          )}
          {shown.map((o, i) => {
            const isSelected = selected.has(o.value);
            return (
              <li
                key={o.value}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                data-value={o.value}
                onMouseEnter={() => { if (!isSelected) setActive(i); }}
                onClick={(e) => { if (!isSelected) pick(o, e.ctrlKey || e.metaKey); }}
                className={clsx(
                  'break-words px-1.5 py-[5px] leading-[15px]',
                  isSelected
                    ? 'cursor-default text-[#ccc]'
                    : 'cursor-pointer',
                  i === active && !isSelected && 'bg-[#3875d7] bg-[linear-gradient(#3875d7_20%,#2a62bc_90%)] text-white',
                )}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
