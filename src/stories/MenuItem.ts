
import '../../lib';

import { html } from 'lit';

export interface MenuItemProps {
  name: string;
  price: string;
  description: string;
}

/**
 * Function that takes MenuItem properties and returns
 * the markup for a MenuItem.
 */
export const MenuItem = ({name, price, description}: MenuItemProps) => {
  return html`
    <menu-item
      name=${name}
      price=${price}
      description=${description} 
    >
    </menu-item>
  `;
};
