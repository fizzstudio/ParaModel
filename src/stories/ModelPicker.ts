/* Manifest Testing
Copyright (C) 2025 Fizz Studios

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.*/

import { customElement } from "lit/decorators.js";
import { ManifestPicker, ManifestPickerProps } from "@fizz/test-utils";
import { isPastryType, Manifest } from "@fizz/paramanifest";
import { html, TemplateResult } from "lit";
import { Model, modelFromInlineData, planeModelFromInlineData } from "../../lib/index";
import { SeriesAnalyzer } from "@fizz/series-analyzer";

@customElement('model-picker')
export class ModelPicker extends ManifestPicker {

  private model?: Model;

  protected onManifestLoad(manifest: Manifest): void {
    this.model = isPastryType(manifest.datasets[0].type) 
      ? modelFromInlineData(manifest)
      : planeModelFromInlineData(manifest, SeriesAnalyzer)
  }

  protected renderManifest(manifest: Manifest): TemplateResult {
    if (!this.model) {
      return html`<p>No model loaded</p>`;
    }

    return html`
      <p>Model loaded</p>
      <p>${JSON.stringify(this.model, null, 2)}</p>
    `;
  }
  
}

export const ModelPickerMaker = ({ filename, debug }: ManifestPickerProps) => {
  return html`
    <model-picker
      filename=${filename}
      debug=${debug}
    >
    </model-picker>
  `;
};
