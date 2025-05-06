import { MenuMaker, type MenuMakerProps } from './MenuMaker';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import * as QUERY_HELPER from './_StoriesLocatorHelpers';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
const meta = {
  title: 'MenuMaker',
  tags: ['autodocs'],
  render: (args) => MenuMaker(args),
  argTypes: {
    menuUrl: {
      description: 'URL of menu JSON file',
      control: 'text',
    },
  }
} satisfies Meta<MenuMakerProps>;

export default meta;
type Story = StoryObj<MenuMakerProps>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Story1: Story = {
  args: {
    menuUrl: '/data/menu.json',
  },
  async play({args, canvasElement, step}) {
    const menuMaker = canvasElement.querySelector('menu-maker');
    await waitFor(() => expect(QUERY_HELPER.MAKER_DROPDOWN(menuMaker)).not.toBeNull());

    const dropdown = QUERY_HELPER.MAKER_DROPDOWN(menuMaker);
    const menuItemContainer = QUERY_HELPER.MAKER_ITEM_CONTAINER(menuMaker);

    await step('Confirm structure', () => {
      // Since the menu maker is made up of nested web components, we need to 
      // know specific details about the structure of the elements
      // in order find subcomponents. To do that, we have the QUERY_HELPER's!
      // If you have failed one of these tests, it's because you changed 
      // something in the structure that we're relying on, so tests will break.
      // However, instead of hunting down those weird breakages throughout 
      // all of the tests, we've collected all of the possible breakages here, ahead of time.
      expect(menuItemContainer).toBeTruthy();
    });

    dropdown?.select(0);
    await sleep(500);

    await step('When user selects a dropdown item, the items container should update', () => {
       expect(menuItemContainer).not.toHaveTextContent('Nothing selected');
    });
  }
};
