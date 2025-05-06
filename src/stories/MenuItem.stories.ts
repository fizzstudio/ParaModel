import { MenuItem, type MenuItemProps } from './MenuItem';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import * as QUERY_HELPER from './_StoriesLocatorHelpers';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
const meta = {
  title: 'MenuItem',
  tags: ['autodocs'],
  render: (args) => MenuItem(args),
  argTypes: {
    name: {
      description: 'Item name',
      control: 'text',
    },
    price: {
      description: 'Item price',
      control: 'text',
    },
    description: {
      description: 'Item name',
      control: 'text',
    },
  }
} satisfies Meta<MenuItemProps>;

export default meta;
type Story = StoryObj<MenuItemProps>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Story1: Story = {
  args: {
    name: 'Hamburger',
    price: '$10',
    description: 'The best cow patty money can buy'
  },
  async play({args, canvasElement, step}) {
    const menuItem = canvasElement.querySelector('menu-item');
    await waitFor(() => expect(QUERY_HELPER.ITEM_DETAILS(menuItem)).not.toBeNull());

    const details = QUERY_HELPER.ITEM_DETAILS(menuItem);
  }
};
