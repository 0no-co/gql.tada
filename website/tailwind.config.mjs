import colors from 'tailwindcss/colors';
import defaultTheme from 'tailwindcss/defaultTheme';
import starlightPlugin from '@astrojs/starlight-tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },

      colors: {
        accent: {
          50: '#ffffff',
          100: '#fbfbfc',
          200: '#dbdce6',
          300: '#babccf',
          400: '#999cb8',
          500: '#787ca1',
          600: '#5c6084',
          700: '#454863',
          800: '#2e3042',
          900: '#171821',
          950: '#0c0c11',
        },

        gray: {
          100: 'hsl(235, 5%, 99%)',
          200: 'hsl(235, 5%, 87%)',
          300: 'hsl(235, 5%, 72%)',
          400: 'hsl(235, 5%, 57%)',
          500: 'hsl(235, 5%, 41%)',
          600: 'hsl(235, 5%, 27%)',
          700: 'hsl(235, 5%, 12%)',
          800: 'hsl(235, 5%, 4%)',
          900: 'hsl(235, 5%, 1%)',
        },

        blue: {
          DEFAULT: '#2973E1',
          50: '#A2C2F2',
          100: '#94B9F0',
          200: '#7AA8EC',
          300: '#5F96E9',
          400: '#4485E5',
          500: '#2973E1',
          600: '#1C62CA',
          700: '#1853AB',
          800: '#14448B',
          900: '#0F356C',
          950: '#0D2D5C',
        },
      },
    },
  },
  plugins: [starlightPlugin()],
};
