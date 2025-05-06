
import { LitElement, html, css, nothing, type PropertyValueMap } from 'lit';
import { property, state, customElement, queryAssignedElements } from 'lit/decorators.js';
import { ref, createRef } from 'lit/directives/ref.js';

import '@fizz/ui-components';

/**
 * @public
 */
@customElement('menu-item')
export class MenuItem extends LitElement {

  @property() name = '';
  @property() price = '';
  @property() description = '';

  connectedCallback() {
    super.connectedCallback();
  }

  static styles = css`
    fizz-details {
      --background: cornflowerblue;
      outline: solid cornflowerblue 1px;
      margin: 0.5rem 0;
      padding: 0.5rem;
      padding-left: 1.5rem;
    }
  `;

  protected render() {
    return html`
      <fizz-details>
        <span slot="summary">${this.name}, ${this.price}</span>
        <div slot="content">
          ${this.description}
        </div>
      </fizz-details>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'menu-item': MenuItem;
  }
}