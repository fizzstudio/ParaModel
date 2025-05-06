import type { StorybookConfig } from "@storybook/web-components-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],

  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-coverage"
  ],

  framework: {
    name: "@storybook/web-components-vite",
    options: {},
  },

  managerHead: (head) => 
    `${head}
      <link rel="shortcut icon" href="../public/favicon.svg" type="image/xml+svg">`,

  docs: {}
};
export default config;
