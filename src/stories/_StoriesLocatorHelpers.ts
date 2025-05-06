import type { MenuMaker, MenuItem } from '../../lib';

export const MAKER_DROPDOWN = (mm: MenuMaker | null) => mm?.shadowRoot?.querySelector('fizz-dropdown');
export const MAKER_ITEM_CONTAINER = (mm: MenuMaker | null) => mm?.shadowRoot?.querySelector('#menu-items');
export const ITEM_DETAILS = (mi: MenuItem | null) => mi?.shadowRoot?.querySelector('fizz-details');
