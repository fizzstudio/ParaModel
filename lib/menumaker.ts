
import '@fizz/ui-components';

import { LitElement, html, css } from 'lit';
import { property, state, customElement } from 'lit/decorators.js';


interface MenuSection {
  id: string;
  label: string;
  items: MenuItemInfo[];
}

interface MenuItemInfo {
  name: string;
  desc: string;
  price: string;
}

/**
 * Given the URL to a menu JSON file, 
 * creates a dropdown for each category of food, and a list of twisties of each dish.
 * @public
 */
@customElement('menu-maker')
export class MenuMaker extends LitElement {

  @property() menuUrl = '';

  @state() private _menu: MenuSection[] | null = null;
  @state() private _selected = -1;

  connectedCallback() {
    super.connectedCallback();
    this.loadMenu(this.menuUrl);
  }

  /**
   * Load menu file from a given URL.
   * @param menuUrl - URL of the menu JSON file.
   */
  private async loadMenu(menuUrl: string) {
    console.log('loading menu file');
    const response = await fetch(menuUrl);
    this._menu = await response.json();
    console.log('menu loaded');
  }

  static styles = css`
  `;

  protected render() {
    return html`
      ${this._menu ? html`
        <fizz-dropdown 
          label="Select dish type:" 
          placeholder="Select one" 
          .options=${this._menu.map(section => section.label)}
          @select=${(e: CustomEvent) => {
            console.log('selected item', e.detail);
            this._selected = e.detail;
          }}
        >
        </fizz-dropdown>
        <div id="menu-items">
          ${this._selected !== -1 ? html`
            ${this._menu[this._selected].items.map(item => html`
              <menu-item
                name=${item.name}
                price=${item.price}
                description=${item.desc}
              >
              </menu-item>
            `)}
          ` : 'Nothing selected'}
        </div>
      ` : 'Loading'}
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'menu-maker': MenuMaker;
  }
}