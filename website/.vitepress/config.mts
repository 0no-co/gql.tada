import { defineConfig } from 'vitepress';
import { defaultTwoslashOptions } from 'shikiji-twoslash';
import { transformerTwoslash } from 'vitepress-plugin-twoslash';
import type { JsxEmit } from 'typescript';

import { graphqlLanguage } from './graphql-textmate.mts';

const devlogItems = [
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

  sitemap: {
    hostname: 'https://gql-tada.0no.co'
  },

  markdown: {
    languages: [
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
          vfsRoot: `${import.meta.dirname}/../twoslash/`,
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
      { text: 'Documentation', link: '/get-started/' },
    ],

    sidebar: {
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
  }
});
