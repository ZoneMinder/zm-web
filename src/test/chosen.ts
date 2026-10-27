import { within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Helpers for the classic skin's Chosen-style multi-select
 * (`ClassicChosenSelect`), standing in for `userEvent.selectOptions` and
 * `toHaveValue` on the native `<select multiple>` it replaced.
 */

/** The listbox a Chosen combobox controls; opens it first if needed. */
export async function openChosen(user: UserEvent, combobox: HTMLElement): Promise<HTMLElement> {
  if (combobox.getAttribute('aria-expanded') !== 'true') await user.click(combobox);
  const list = document.getElementById(combobox.getAttribute('aria-controls') ?? '');
  if (!list) throw new Error('Chosen listbox did not open');
  return list;
}

/** Option labels in the drop-down, in order. */
export async function chosenOptionLabels(user: UserEvent, combobox: HTMLElement): Promise<string[]> {
  const list = await openChosen(user, combobox);
  return within(list).queryAllByRole('option').map((o) => o.textContent ?? '');
}

/**
 * Picks each value (an option's value or its label) in turn, as a user
 * clicking through the drop-down would; each pick closes it again.
 */
export async function chooseOptions(user: UserEvent, combobox: HTMLElement, values: string | string[]) {
  for (const v of Array.isArray(values) ? values : [values]) {
    const list = await openChosen(user, combobox);
    const option = within(list).getAllByRole('option')
      .find((o) => o.getAttribute('data-value') === v || o.textContent === v);
    if (!option) throw new Error(`No Chosen option ${v}`);
    await user.click(option);
  }
}

/** Labels of the chips, i.e. what is selected, in order. */
export function chosenChips(combobox: HTMLElement): string[] {
  const box = combobox.closest('ul');
  if (!box) return [];
  return [...box.querySelectorAll(':scope > li > span')].map((s) => s.textContent ?? '');
}
