/**
 * Legacy `_monitor_filters.php` row: labelled controls, every select a
 * Chosen-style multi-select as legacy's are, the wire values behind their
 * translated labels, Server/Storage only when the box has more than one, and
 * the per-field clear (×). Driven with a stub `MonitorFilterRowState` so this
 * stays a unit test of the presentation — the hook has its own coverage.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { chooseOptions, chosenChips, chosenOptionLabels, openChosen } from '@/test/chosen';
import type { Monitor } from '@/types';
import type {
  FilterRowField, FilterRowValues, MonitorFilterRowState,
} from '@/features/monitors/useMonitorFilterRow';
import { FILTER_ROW_FIELDS, splitValues } from '@/features/monitors/useMonitorFilterRow';
import { ClassicFilterRow } from './FilterRow';

const monitors = [
  { id: 1, name: 'Front Door' },
  { id: 2, name: 'Driveway East' },
] as unknown as Monitor[];

const groups = [
  { id: 7, name: 'Perimeter' },
  { id: 8, name: 'Indoors' },
] as unknown as MonitorFilterRowState['groups'];

const EMPTY: FilterRowValues = {
  groupId: '', name: '', capturing: '', analysing: '',
  recording: '', status: '', source: '', monitorId: '',
  serverId: '', storageId: '',
};

const set = vi.fn();
const setMulti = vi.fn();
const clear = vi.fn();

function makeState(
  values: Partial<FilterRowValues> = {},
  over: Partial<Pick<MonitorFilterRowState, 'servers' | 'storages'>> = {},
): MonitorFilterRowState {
  const merged = { ...EMPTY, ...values };
  return {
    groups,
    servers: [],
    storages: [],
    ...over,
    values: merged,
    valuesMulti: Object.fromEntries(
      FILTER_ROW_FIELDS.map((f) => [f, splitValues(merged[f])]),
    ) as Record<FilterRowField, string[]>,
    set,
    setMulti,
    clear,
    reset: vi.fn(),
    filtered: monitors,
    activeCount: Object.values(merged).filter((v) => v !== '').length,
  };
}

function mount(
  values?: Partial<FilterRowValues>,
  tone?: 'light' | 'dark',
  over?: Partial<Pick<MonitorFilterRowState, 'servers' | 'storages'>>,
) {
  return renderWithProviders(
    <ClassicFilterRow monitors={monitors} state={makeState(values, over)} tone={tone} className="mb-2" />,
  );
}

const combo = (name: string) => screen.getByRole('combobox', { name });
const optionLabels = (name: string) => chosenOptionLabels(userEvent.setup(), combo(name));

beforeEach(() => { set.mockClear(); setMulti.mockClear(); clear.mockClear(); });

describe('ClassicFilterRow', () => {
  it('renders the legacy fields in order under one named group', () => {
    mount();
    const group = screen.getByRole('group', { name: 'Monitor filter bar' });
    expect(within(group).getAllByRole('combobox')).toHaveLength(6);
    expect(within(group).getAllByRole('textbox')).toHaveLength(2);
    for (const label of ['GroupId', 'Capturing', 'Analysing', 'Recording', 'Status', 'Monitor']) {
      expect(combo(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Source' })).toBeInTheDocument();
  });

  it('makes every select a multi-select reading "All" while empty, as legacy does', async () => {
    mount();
    for (const label of ['GroupId', 'Capturing', 'Status', 'Monitor']) {
      expect(combo(label)).toHaveAttribute('placeholder', 'All');
      const list = await openChosen(userEvent.setup(), combo(label));
      expect(list).toHaveAttribute('aria-multiselectable', 'true');
    }
  });

  it('lists the groups the hook supplied, with no "All" option', async () => {
    mount();
    expect(await optionLabels('GroupId')).toEqual(['Perimeter', 'Indoors']);
    expect(screen.getByRole('option', { name: 'Perimeter' })).toHaveAttribute('data-value', '7');
  });

  it('translates the capture-mode wire values', async () => {
    mount();
    expect(await optionLabels('Capturing')).toEqual(['None', 'On Demand', 'Always']);
    expect(await optionLabels('Analysing')).toEqual(['None', 'Always']);
    expect(await optionLabels('Recording')).toEqual(['None', 'On Motion', 'Always']);
  });

  it('translates the runtime status values the way legacy did, without Deleted', async () => {
    mount();
    // `Running` means the daemon is up but not yet capturing. Legacy's
    // `Deleted` pseudo-status is omitted: the API cannot list deleted monitors.
    expect(await optionLabels('Status')).toEqual(['Unknown', 'Not Running', 'Not Capturing', 'Capturing']);
    expect(screen.getByRole('option', { name: 'Capturing' })).toHaveAttribute('data-value', 'Connected');
    expect(screen.getByRole('option', { name: 'Not Capturing' })).toHaveAttribute('data-value', 'Running');
  });

  it('labels each monitor option with its id', async () => {
    mount();
    expect(await optionLabels('Monitor')).toEqual(['1 Front Door', '2 Driveway East']);
  });

  it('hides Server and Storage until the box has more than one', () => {
    mount();
    expect(screen.queryByRole('combobox', { name: 'Server' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Storage' })).not.toBeInTheDocument();
  });

  it('shows Server and Storage once there are two of either', async () => {
    mount({}, undefined, {
      servers: [{ id: 1, name: 'zm1' }, { id: 2, name: 'zm2' }] as MonitorFilterRowState['servers'],
      storages: [{ id: 1, name: 'Default' }, { id: 2, name: 'Archive' }] as MonitorFilterRowState['storages'],
    });
    expect(await optionLabels('Server')).toEqual(['zm1', 'zm2']);
    expect(await optionLabels('Storage')).toEqual(['Default', 'Archive']);
  });

  it('reflects the current values, several at a time', () => {
    mount({ groupId: '8', capturing: 'Always', status: 'NotRunning,Connected', monitorId: '1,2', name: 'door', source: '10.0.0' });
    expect(chosenChips(combo('GroupId'))).toEqual(['Indoors']);
    expect(chosenChips(combo('Status'))).toEqual(['Not Running', 'Capturing']);
    expect(chosenChips(combo('Monitor'))).toEqual(['1 Front Door', '2 Driveway East']);
    // The placeholder only shows while nothing is picked.
    expect(combo('Monitor')).not.toHaveAttribute('placeholder');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('door');
    expect(screen.getByRole('textbox', { name: 'Source' })).toHaveValue('10.0.0');
  });

  it('reports a select change as the whole selection', async () => {
    mount();
    const user = userEvent.setup();
    await chooseOptions(user, combo('Recording'), 'OnMotion');
    expect(setMulti).toHaveBeenCalledWith('recording', ['OnMotion']);

    // The stub never echoes a selection back, so each click reports only
    // what the DOM holds at that moment — the field name is the point here.
    await chooseOptions(user, combo('Monitor'), '1');
    expect(setMulti).toHaveBeenLastCalledWith('monitorId', ['1']);
  });

  it('reports typed text per keystroke against its field name', async () => {
    mount();
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'ab');
    expect(set).toHaveBeenNthCalledWith(1, 'name', 'a');
    // Value is controlled by the stub, so each keystroke starts from ''.
    expect(set).toHaveBeenNthCalledWith(2, 'name', 'b');
  });

  it('hints that the text fields accept a regular expression', () => {
    mount();
    expect(screen.getByRole('textbox', { name: 'Name' }))
      .toHaveAttribute('placeholder', 'text or regular expression');
  });

  it('disables the clear button until the field has a value', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Clear groupid' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear monitor' })).toBeDisabled();
  });

  it('clears the field it belongs to', async () => {
    mount({ capturing: 'Always', groupId: '7' });
    const clearCapturing = screen.getByRole('button', { name: 'Clear capturing' });
    expect(clearCapturing).toBeEnabled();

    await userEvent.click(clearCapturing);
    expect(clear).toHaveBeenCalledWith('capturing');

    await userEvent.click(screen.getByRole('button', { name: 'Clear groupid' }));
    expect(clear).toHaveBeenLastCalledWith('groupId');
  });

  it('renders on the dark header band too', () => {
    mount({}, 'dark');
    expect(screen.getByRole('group', { name: 'Monitor filter bar' })).toBeInTheDocument();
  });

  it('offers nothing to pick when there are no groups or monitors', async () => {
    const state = makeState();
    state.groups = [];
    renderWithProviders(<ClassicFilterRow monitors={[]} state={state} />);
    expect(await optionLabels('GroupId')).toEqual([]);
    expect(await optionLabels('Monitor')).toEqual([]);
  });
});
