import { defineConfig } from 'vitepress';
import { defaultTwoslashOptions } from 'shikiji-twoslash';
import { transformerTwoslash } from 'vitepress-plugin-twoslash';
import type { JsxEmit } from 'typescript';

import { graphqlLanguage } from './graphql-textmate.mts';

// https://vitepress.dev/reference/site-config
export default defineConfig({
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
      { text: 'Documentation', link: '/get-started/' },
    ],

    sidebar: [
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
            text: 'GraphQLSP Config',
            link: '/reference/graphqlsp-config',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/0no-co/gql.tada' },
      { icon: 'discord', link: 'https://urql.dev/discord' },
    ]
  }
});
