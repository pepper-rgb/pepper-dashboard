import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pepper: {
          primary: '#1a1a2e',
          secondary: '#16213e',
          accent: '#e94560',
          light: '#0f3460',
          text: '#eaeaea',
        }
      }
    },
  },
  plugins: [],
}
export default config
