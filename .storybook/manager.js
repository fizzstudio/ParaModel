import { addons } from '@storybook/manager-api';
import fizzTheme from './FizzTheme';

addons.setConfig({
  theme: fizzTheme,
});