import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'gql.tada',
			social: {
				github: 'https://github.com/0no-co/gql.tada',
        discord: 'https://urql.dev/discord',
			},
			sidebar: [
        {
					label: 'Get Started',
          items: [
            { label: 'Introduction', link: '/' },
            { label: 'Installation', link: '/get-started/installation/' },
            { label: 'Writing GraphQL', link: '/get-started/writing-graphql/' },
          ],
				},
        /*
				{
					label: 'Guides',
					autogenerate: { directory: 'guides' },
				},
        */
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
			customCss: ['./src/tailwind.css'],
      expressiveCode: {
        plugins: [
          pluginCollapsibleSections(),
        ],
      },
		}),

		tailwind({ applyBaseStyles: false }),
	],
});
