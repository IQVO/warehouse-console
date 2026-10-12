import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * The shared shape every warehouse-systems documentation site uses, minus
 * the categories that don't apply to a shell with no bounded-context domain
 * model or REST API of its own (no Business Context / DDD / API Reference
 * categories here — see each remote's own repo for those).
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Overview',
      collapsed: false,
      link: {type: 'doc', id: 'overview/index'},
      items: ['overview/getting-started'],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/module-federation',
        'architecture/cross-cutting-screens',
        'architecture/features',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      collapsed: false,
      items: [
        'operations/configuration',
        'operations/runbook',
        'operations/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      collapsed: false,
      items: ['development/testing'],
    },
    {
      type: 'category',
      label: 'Ecosystem',
      collapsed: false,
      items: [
        'ecosystem/context-map',
        'ecosystem/consuming-the-fleet',
      ],
    },
    {
      type: 'category',
      label: 'Architecture Decision Records',
      collapsed: false,
      link: {type: 'doc', id: 'adr/index'},
      items: ['adr/0001-shell-owns-cross-cutting-screens-only'],
    },
  ],
};

export default sidebars;
