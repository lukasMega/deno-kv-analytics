import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// From the `origin` remote. A wrong `baseUrl` produces a site whose CSS/JS 404
// on GitHub Pages, so these two must match the repo exactly.
const ORG = 'lukasMega';
const REPO = 'deno-kv-analytics';

// TODO(placeholder): origin of the deployed collector. It serves `/s.js`, and
// the beacon posts to its own origin, so this single value wires up analytics
// end to end. Until it points at the real *.deno.net host (or custom domain),
// the published site's beacon tag 404s and no counters move.
const COLLECTOR = 'https://stats.example.com';

const config: Config = {
  title: 'deno-kv-analytics',
  tagline: 'Cookieless, multi-tenant pageview collector on Deno KV',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: `https://${ORG}.github.io`,
  // Project Pages site: served under /<repo>/, so every reported path carries
  // that prefix in the dashboard.
  baseUrl: `/${REPO}/`,

  organizationName: ORG,
  projectName: REPO,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // The docs site dogfoods the collector. Raw script tag rather than a plugin:
  // src/client/beacon.ts already wraps pushState/replaceState/popstate itself
  // (it replaced the Docusaurus-specific version of that file), so
  // onRouteDidUpdate would only double-count. `data-site` is required here —
  // *.github.io is a shared host that no site can claim, so resolveSite falls
  // through to the `?s=` branch, which only accepts an allowlisted id.
  // localhost is skipped by the beacon, so `npm start` writes nothing.
  headTags: [
    {
      tagName: 'script',
      attributes: {
        defer: 'true',
        src: `${COLLECTOR}/s.js`,
        'data-site': 'docs',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Docs at the site root: four pages don't need a landing page in
          // front of them.
          routeBasePath: '/',
          editUrl: `https://github.com/${ORG}/${REPO}/tree/main/website/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'deno-kv-analytics',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: `https://github.com/${ORG}/${REPO}`,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/'},
            {label: 'Configuration', to: '/configuration'},
            {label: 'Dashboard & API', to: '/dashboard'},
            {label: 'Example', to: '/example'},
            {label: 'Privacy', to: '/privacy'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: `https://github.com/${ORG}/${REPO}`},
            {label: 'Deno Deploy', href: 'https://console.deno.com'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} deno-kv-analytics. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
