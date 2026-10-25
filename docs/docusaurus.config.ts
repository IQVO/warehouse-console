import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Warehouse Console',
  tagline:
    'The React SPA shell for the warehouse-systems fleet — routing, navigation, the shared design system, and the cross-cutting screens no single bounded context owns.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://iqvo.github.io',
  baseUrl: '/warehouse-console/',

  organizationName: 'IQVO',
  projectName: 'warehouse-console',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/IQVO/warehouse-console/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    image: 'img/logo.svg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Warehouse Console',
      logo: {
        alt: 'Warehouse Console',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/docs/adr',
          label: 'ADR',
          position: 'left',
        },
        {
          href: 'https://github.com/IQVO/warehouse-console',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Overview', to: '/docs/overview'},
            {label: 'Architecture', to: '/docs/architecture/module-federation'},
            {label: 'Ecosystem', to: '/docs/ecosystem/context-map'},
          ],
        },
        {
          title: 'Ecosystem',
          items: [
            {label: 'Context map', to: '/docs/ecosystem/context-map'},
            {
              label: 'warehouse-ops-agent (console-bff)',
              href: 'https://github.com/IQVO/warehouse-ops-agent',
            },
            {
              label: 'warehouse-ui-kit (design system)',
              href: 'https://github.com/IQVO/warehouse-ui-kit',
            },
            {
              label: 'facility-layout',
              href: 'https://github.com/IQVO/facility-layout',
            },
          ],
        },
        {
          title: 'Source',
          items: [
            {
              label: 'warehouse-console on GitHub',
              href: 'https://github.com/IQVO/warehouse-console',
            },
          ],
        },
      ],
      copyright: `warehouse-systems · warehouse-console — the fleet's SPA shell. Built ${new Date().getFullYear()}.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'tsx', 'typescript', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
