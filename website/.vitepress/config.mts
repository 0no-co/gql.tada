import { defineConfig } from 'vitepress';
import { defaultTwoslashOptions } from '@shikijs/twoslash';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
import llmstxt from 'vitepress-plugin-llms';
import type { JsxEmit } from 'typescript';

// Bundles the `graphql` grammar together with the `javascript`, `typescript`,
// `jsx`, and `tsx` grammars that the custom injection grammar embeds. Shiki v2
// no longer auto-resolves a custom grammar's `embeddedLangs`, so these must be
// registered explicitly ahead of it.
import bundledGraphqlLanguages from '@shikijs/langs/graphql';

import { graphqlLanguage } from './graphql-textmate.mts';

const devlogItems = [
  {
    text: 'v1.11.0',
    longText: 'v1.11.0 - Closing gaps',
    link: '/devlog/2026-06-14',
  },
  {
    text: 'v1.8.0',
    longText: 'v1.8.0 - Future Setup Instructions',
    link: '/devlog/2024-06-26',
  },
  {
    text: 'v1.6.0',
    longText: 'v1.6.0 - Multi-Schema Mode',
    link: '/devlog/2024-04-26',
  },
  {
    text: 'v1.5.0',
    longText: 'v1.5.0 - New CLI Workflows',
    link: '/devlog/2024-04-15',
  },
];

// https://vitepress.dev/reference/site-config
export default defineConfig({
  rewrites: {
    'reference/graphqlsp-config.md': 'reference/config-format.md',
  },

  lang: 'en-US',
  title: 'gql.tada 🪄',
  description: 'Magical GraphQL query engine for TypeScript',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
  ],

  sitemap: {
    hostname: 'https://gql-tada.0no.co'
  },

  markdown: {
    languages: [
      ...bundledGraphqlLanguages,
      graphqlLanguage,
    ],

    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          ...defaultTwoslashOptions(),
          // Twoslash resolves relative imports in examples (e.g.
          // `./graphql/graphql-env.d.ts`) against `vfsRoot`, which must be the
          // `website/` directory. (Older twoslash resolved these against cwd and
          // ignored `vfsRoot`, so this previously pointed at a non-existent dir.)
          vfsRoot: `${import.meta.dirname}/../`,
          shouldGetHoverInfo: (() => {
            let lastIdentifier: string | undefined;
            return (identifier, _start, _filename) => {
              try {
                switch (identifier) {
                  case 'li':
                  case 'ul':
                  case 'div':
                  case 'p':
                  case 'h1':
                  case 'h2':
                  case 'h3':
                  case 'section':
                  case 'Promise':
                  case 'fetch':
                  case 'JSON':
                    return false;
                  case 'stringify':
                    return lastIdentifier !== 'JSON';
                  case 'method':
                    return lastIdentifier !== 'fetch';
                  case 'response':
                    return lastIdentifier !== 'Promise' && lastIdentifier !== 'fetch';
                  case 'json':
                    return lastIdentifier !== 'response';
                  default:
                    return true;
                }
              } finally {
                  lastIdentifier = identifier;
              }
            };
          })(),
          compilerOptions: {
            jsx: 4 as JsxEmit,
          },
        },
      }),
    ],
  },

  themeConfig: {
    editLink: {
      pattern: 'https://github.com/0no-co/gql.tada/edit/main/website/:path'
    },
    outline: {
      level: [2, 3],
    },
    search: {
      provider: 'local'
    },

    nav: [
      {
        text: 'Devlog',
        items: devlogItems,
      },
      { text: 'Community', link: '/community/' },
      { text: 'Documentation', link: '/get-started/' },
    ],

    sidebar: {
      '/community': [
        {
          text: 'Community',
          collapsed: false,
          items: [
            {
              text: 'Creator Videos',
              link: '/community/',
            },
          ],
        },
      ],

      '/devlog': [
        {
          text: 'Devlog',
          collapsed: false,
          items: devlogItems.map((item) => ({
            text: item.longText || item.text,
            link: item.link,
          })),
        },
      ],

      '/': [
        {
          text: 'Get Started',
          collapsed: false,
          items: [
            {
              text: 'Introduction',
              link: '/get-started/',
            },
            {
              text: 'Installation',
              link: '/get-started/installation',
            },
            {
              text: 'Writing GraphQL',
              link: '/get-started/writing-graphql',
            },
            {
              text: 'Essential Workflows',
              link: '/get-started/workflows',
            },
          ],
        },
        {
          text: 'Guides',
          collapsed: false,
          items: [
            {
              text: 'Typed Documents',
              link: '/guides/typed-documents',
            },
            {
              text: 'Fragment Colocation',
              link: '/guides/fragment-colocation',
            },
            {
              text: 'Persisted Documents',
              link: '/guides/persisted-documents',
            },
            {
              text: 'Multiple Schemas',
              link: '/guides/multiple-schemas',
            },
            {
              text: 'Testing',
              link: '/guides/testing',
            },
            {
              text: 'Recipebook',
              link: '/guides/recipebook',
            },
            {
              text: 'Graphcache',
              link: '/guides/graphcache',
            },
          ],
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            {
              text: 'gql.tada API',
              link: '/reference/gql-tada-api',
            },
            {
              text: 'gql.tada CLI',
              link: '/reference/gql-tada-cli',
            },
            {
              text: 'Config Format',
              link: '/reference/config-format',
            },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/0no-co/gql.tada' },
      { icon: 'discord', link: 'https://urql.dev/discord' },
    ]
  },
  vite: {
    server: {
      allowedHosts: true,
      fs: {
        strict: false,
      },
    },
    plugins: [
      llmstxt({
        ignoreFiles: ['CHANGELOG.md', 'community/*', 'devlog/*'],
        sidebar: (sidebar) => {
          if (!sidebar || Array.isArray(sidebar)) return sidebar;
          const { ['/community']: _community, ...rest } = sidebar;
          return rest;
        },
        customLLMsTxtTemplate: ['# {title}', '', '{description}', '', '## Table of Contents', '', '{toc}'].join('\n'),
      }) as any,
    ],
  },
});
