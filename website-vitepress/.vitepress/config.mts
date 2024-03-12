import { defineConfig } from 'vitepress';
import { transformerTwoslash } from 'vitepress-plugin-twoslash';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'gql.tada 🪄',
  description: 'Magical GraphQL query engine for TypeScript',

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    codeTransformers: [
      transformerTwoslash(),
    ],
  },

  themeConfig: {
    search: {
      provider: 'local'
    },
    nav: [],
    sidebar: [
      {
        text: 'Get Started',
        collapsed: false,
        items: [
          {
            text: 'Introduction',
            link: '/',
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
