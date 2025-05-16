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

import type { Meta, StoryObj } from '@storybook/web-components';

import { type CatalogListing } from '@fizz/chart-data';

import CATALOG from '../../node_modules/@fizz/chart-data/data/chart_catalog.json'; 

import { ManifestPickerProps } from '@fizz/test-utils';
import { ModelPickerMaker } from './ModelPicker';

const FILENAMES = (CATALOG as CatalogListing[]).map((listing) => listing.path);

const meta = {
  title: 'Model Picker',
  tags: ['autodocs'],
  render: (args) => ModelPickerMaker(args),
  argTypes: {
    filename: {
      description: 'Manifest filename',
      control: { type: 'select' },
      options: FILENAMES
    }
  }
} satisfies Meta<ManifestPickerProps>;

export default meta;
type Story = StoryObj<ManifestPickerProps>;

export const ModelPicker: Story = { };
