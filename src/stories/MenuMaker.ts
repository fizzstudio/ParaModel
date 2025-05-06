
import '../../lib';

import { html } from 'lit';

export interface MenuMakerProps {
  menuUrl: string;
}

/**
 * Function that takes MenuMaker properties and returns
 * the markup for a MenuMaker.
 */
export const MenuMaker = ({menuUrl}: MenuMakerProps) => {
  return html`
    <menu-maker 
      menuurl=${menuUrl} 
    >
    </menu-maker>
  `;
};
