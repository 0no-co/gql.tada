import { defineConfig } from 'vocs';

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

export default defineConfig({
  //banner: 'Head to our new [Discord](https://discord.gg/JUrRkGweXV)!',
  title: 'gql.tada 🪄',
  description: 'Magical GraphQL query engine for TypeScript',
  editLink: {
    pattern: 'https://github.com/0no-co/gql.tada/edit/main/website/:path',
  },
  rootDir: '.',
  topNav: [
    {
      text: 'Devlog',
      items: devlogItems,
    },
    { text: 'Documentation', link: '/docs/get-started/' },
  ],
  // TODO: shiki and theme stuff
  //markdown: {
  //   code: {
  //     langs: [graphqlLanguage]
  //   },
  //},

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

    '/docs': [
      {
        text: 'Get Started',
        collapsed: false,
        items: [
          {
            text: 'Introduction',
            link: '/docs/get-started/',
          },
          {
            text: 'Installation',
            link: '/docs/get-started/installation',
          },
          {
            text: 'Writing GraphQL',
            link: '/docs/get-started/writing-graphql',
          },
          {
            text: 'Essential Workflows',
            link: '/docs/get-started/workflows',
          },
        ],
      },
      {
        text: 'Guides',
        collapsed: false,
        items: [
          {
            text: 'Typed Documents',
            link: '/docs/guides/typed-documents',
          },
          {
            text: 'Fragment Colocation',
            link: '/docs/guides/fragment-colocation',
          },
          {
            text: 'Persisted Documents',
            link: '/docs/guides/persisted-documents',
          },
          {
            text: 'Multiple Schemas',
            link: '/docs/guides/multiple-schemas',
          },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          {
            text: 'gql.tada API',
            link: '/docs/reference/gql-tada-api',
          },
          {
            text: 'gql.tada CLI',
            link: '/docs/reference/gql-tada-cli',
          },
          {
            text: 'Config Format',
            link: '/docs/reference/config-format',
          },
        ],
      },
    ],
  },

  socials: [
    { icon: 'github', link: 'https://github.com/0no-co/gql.tada' },
    { icon: 'discord', link: 'https://urql.dev/discord' },
  ],
});
