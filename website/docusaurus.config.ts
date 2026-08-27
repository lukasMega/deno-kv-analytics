import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// From the `origin` remote. A wrong `baseUrl` produces a site whose CSS/JS 404
// on GitHub Pages, so these two must match the repo exactly.
const ORG = 'lukasMega';
const REPO = 'deno-kv-analytics';

// Origin of the deployed collector, e.g. `https://stats.example.com`. Read from
// the environment and deliberately NOT hardcoded — not even split across
// expressions, which would still reconstruct the host for anyone reading the
// file. Unset (the default, and every fork) omits the beacon entirely, so the
// site builds and works with no analytics rather than emitting a tag that 404s.
//
// This only keeps the host out of *git*. Whatever value is set at build time is
// baked into the published HTML as a `<script src>` that every visitor can read
// — a browser beacon URL cannot be secret. Point a custom domain at the
// collector if the *.deno.net host itself should stay unadvertised.
// Scheme is optional in the env var: a bare `stats.example.com` would otherwise
// build a relative `<script src>` that resolves against the docs host and 404s,
// with no build error.
const COLLECTOR_RAW = process.env.COLLECTOR_ORIGIN?.trim().replace(/\/+$/, '');
const COLLECTOR = COLLECTOR_RAW
  ? /^https?:\/\//.test(COLLECTOR_RAW)
    ? COLLECTOR_RAW
    : `https://${COLLECTOR_RAW}`
  : undefined;

// Must be an id in the collector's `SITES` env var — an unlisted id resolves to
// null, and the beacon then returns the same gif while writing nothing, so a
// typo here is silent. Verify against `GET /sites` on the collector, not against
// this file.
const SITE_ID = process.env.COLLECTOR_SITE_ID ?? 'docs';

const config: Config = {
  title: 'deno-kv-analytics',
  tagline: 'Cookieless, multi-tenant pageview collector on Deno KV',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  // future.v4 disables the MDX v1 compatibility options, which includes the
  // legacy `:::warning Title` admonition form — it degrades to a literal
  // paragraph with no build warning. Titles must use the Markdown Directive
  // syntax `:::warning[Title]`.
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Mermaid, so the flow diagram is one ```mermaid block that renders both here
  // and unmodified in README.md — GitHub renders mermaid natively, so the two
  // cannot drift into different pictures of the same pipeline.
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

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
  // Guarded: without COLLECTOR_ORIGIN this would emit `src="undefined/s.js"`,
  // a relative URL that 404s against the docs host on every page, with no build
  // error. Unset must mean no tag at all.
  headTags: COLLECTOR
    ? [
        {
          tagName: 'script',
          attributes: {
            defer: 'true',
            src: `${COLLECTOR}/s.js`,
            'data-site': SITE_ID,
          },
        },
      ]
    : [],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Docs at the site root: seven pages don't need a landing page in
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
            {label: 'Getting started', to: '/deploy'},
            {label: 'Several projects', to: '/multiple-projects'},
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
