import type { Config } from 'tailwindcss'

// Tailwind 3. Pinned deliberately — docs/dev-plan.md §3 lists this file and
// docs/META-PLAN.md §2 lists postcss and autoprefixer, which is the v3 shape.
// Tailwind 4 replaces all three with a CSS-first config and no config file.
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/emails/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}

export default config
