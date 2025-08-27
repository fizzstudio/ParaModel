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
import { isPastryType } from "@fizz/paramanifest";
import { html, TemplateResult } from "lit";
import { BasicSeriesPairMetadataAnalyzer, Model, modelFromInlineData, PlaneModel, planeModelFromInlineData } from "../../lib/index";
import { SeriesAnalyzer } from "@fizz/series-analyzer";

@customElement('model-picker')
export class ModelPicker extends ManifestPicker {

  private model?: Model;

  protected async onManifestLoad(): Promise<void> {
    if (isPastryType(this.manifest!.datasets[0].type)) {
      this.model = modelFromInlineData(this.manifest!);
    } else {
      this.model = planeModelFromInlineData(this.manifest!, SeriesAnalyzer, BasicSeriesPairMetadataAnalyzer);
      // Just to trigger series analyses
      const _ = await (this.model as PlaneModel).getSeriesAnalysis(this.model.seriesKeys[0]);
    }
  }

  protected async renderManifest(): Promise<TemplateResult> {
    if (!this.model) {
      return html`<p>No model loaded</p>`;
    }

    return html`
      <p>Model loaded</p>
      <pre>${JSON.stringify(this.model, null, 2)}</pre>
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
