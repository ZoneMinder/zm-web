/**
 * The classic skin's Chosen-style multi-select: chips for the picks, an "All"
 * placeholder while empty, a type-to-filter drop-down that keeps picked
 * options listed but greyed, Backspace to drop the last chip, and the
 * clear (×) button inside the box.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithProviders } from '@/test/render';
import { chosenChips } from '@/test/chosen';
import { ClassicChosenSelect, type ChosenOption } from './ChosenSelect';

const OPTIONS: ChosenOption[] = [
  { value: 'None', label: 'None' },
  { value: 'Ondemand', label: 'On Demand' },
  { value: 'Always', label: 'Always' },
];

/** A controlled host, so picks echo back as they do on a real page. */
function Host({ initial = [], onChange, onClear }: {
  initial?: string[]; onChange?: (v: string[]) => void; onClear?: boolean;
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <label htmlFor="cap">Capturing</label>
      <ClassicChosenSelect
        id="cap"
        options={OPTIONS}
        value={value}
        onChange={(v) => { setValue(v); onChange?.(v); }}
        onClear={onClear ? () => setValue([]) : undefined}
        clearLabel="Clear capturing"
      />
    </>
  );
}

const combo = () => screen.getByRole('combobox', { name: 'Capturing' });
const listbox = () => screen.getByRole('listbox');

describe('ClassicChosenSelect', () => {
  it('reads "All" while nothing is picked and stays closed until focused', () => {
    renderWithProviders(<Host />);
    expect(combo()).toHaveAttribute('placeholder', 'All');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens on click and picks an option as a chip, closing again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Host onChange={onChange} />);

    await user.click(combo());
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
    expect(within(listbox()).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['None', 'On Demand', 'Always']);

    await user.click(screen.getByRole('option', { name: 'Always' }));
    expect(onChange).toHaveBeenLastCalledWith(['Always']);
    expect(chosenChips(combo())).toEqual(['Always']);
    expect(combo()).not.toHaveAttribute('placeholder');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reports picks in option order, whatever order they were made in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Host onChange={onChange} />);

    await user.click(combo());
    await user.click(screen.getByRole('option', { name: 'Always' }));
    await user.click(combo());
    await user.click(screen.getByRole('option', { name: 'None' }));
    expect(onChange).toHaveBeenLastCalledWith(['None', 'Always']);
    expect(chosenChips(combo())).toEqual(['None', 'Always']);
  });

  it('keeps a picked option listed but greyed and inert', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Host initial={['Always']} onChange={onChange} />);

    await user.click(combo());
    const picked = screen.getByRole('option', { name: 'Always' });
    expect(picked).toHaveAttribute('aria-selected', 'true');
    await user.click(picked);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters the drop-down on what is typed, anywhere in the label', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host />);

    await user.type(combo(), 'dem');
    expect(within(listbox()).getAllByRole('option').map((o) => o.textContent)).toEqual(['On Demand']);

    await user.clear(combo());
    await user.type(combo(), 'zzz');
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0);
    expect(listbox()).toHaveTextContent('No results match “zzz”');
  });

  it('works from the keyboard: arrows skip picks, Enter picks, Escape closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Host initial={['Ondemand']} onChange={onChange} />);

    await user.click(combo());
    // The first free option is highlighted on opening.
    expect(combo()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'None' }).id);
    // Down skips the picked "On Demand".
    await user.keyboard('{ArrowDown}');
    expect(combo()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Always' }).id);
    await user.keyboard('{ArrowUp}');
    expect(combo()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'None' }).id);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['None', 'Ondemand']);

    await user.keyboard('{ArrowDown}');
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the drop-down open for Ctrl+Enter, as Chosen does for a held Ctrl', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host />);

    await user.click(combo());
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(chosenChips(combo())).toEqual(['None']);
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
  });

  it('drops the last chip on Backspace in an empty search', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Host initial={['None', 'Always']} onChange={onChange} />);

    await user.click(combo());
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['None']);
    expect(chosenChips(combo())).toEqual(['None']);
  });

  it('removes one chip from its own ×', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Host initial={['None', 'Always']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Remove None' }));
    expect(onChange).toHaveBeenLastCalledWith(['Always']);
  });

  it('clears everything from the × inside the box, disabled while empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host initial={['None']} onClear />);

    const clear = screen.getByRole('button', { name: 'Clear capturing' });
    expect(clear).toBeEnabled();
    await user.click(clear);
    expect(chosenChips(combo())).toEqual([]);
    expect(clear).toBeDisabled();
  });

  it('closes when focus leaves it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<><Host /><button type="button">elsewhere</button></>);

    await user.click(combo());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
