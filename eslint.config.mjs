import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

/**
 * One config covering the whole repository.
 *
 * The src/core/ block below is an ARCHITECTURAL BOUNDARY from AGENTS.md, not
 * a style preference. Do not disable it, do not add an exception to it, and
 * do not weaken it to accommodate a violation. If code under src/core/ needs
 * something this rule forbids, the code is in the wrong directory: the pure
 * part belongs in src/core/ and the input-output part belongs in src/services/.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-e2e/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'drizzle/**',
      'next-env.d.ts',
    ],
  },

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2024 },
    },
  },

  js.configs.recommended,

  // Browser globals for the surfaces that actually run in one.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },

  // ───────────────────────────────────────────────────────────────────
  // THE src/core/ BOUNDARY — see AGENTS.md, "src/core/ is pure and imports
  // nothing that performs input or output".
  // ───────────────────────────────────────────────────────────────────
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/db',
                '@/db/*',
                '@/services',
                '@/services/*',
                '@/app',
                '@/app/*',
                '@/lib',
                '@/lib/*',
                '@/components',
                '@/components/*',
                '@/emails',
                '@/emails/*',
                '../db/*',
                '../services/*',
                '../app/*',
                '../lib/*',
                '../components/*',
                '../emails/*',
                '../../db/*',
                '../../services/*',
                '../../app/*',
                '../../lib/*',
                '../../components/*',
                '../../emails/*',
              ],
              message:
                'src/core/ is pure. It may not import from src/db/, src/services/, src/app/, src/lib/, src/components/, or src/emails/. Move the input-output part to src/services/ and keep the pure part here. See AGENTS.md.',
            },
            {
              group: [
                'next',
                'next/*',
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'drizzle-orm',
                'drizzle-orm/*',
                '@neondatabase/serverless',
                'resend',
                '@react-email/*',
                '@vercel/blob',
                'googleapis',
                'google-auth-library',
                'node:fs',
                'node:fs/*',
                'node:http',
                'node:https',
                'node:net',
                'node:dns',
                'node:child_process',
                'node:worker_threads',
                'node:os',
                'node:process',
                'fs',
                'fs/*',
                'http',
                'https',
                'net',
                'dns',
                'child_process',
                'worker_threads',
                'os',
              ],
              message:
                'src/core/ may import only from src/core/ and Node built-ins that perform no input or output. This package performs input or output, reaches the network, the filesystem, or the environment. See AGENTS.md.',
            },
          ],
        },
      ],
      // A pure function takes the clock and the random source as arguments.
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'src/core/ reads no environment. Pass the value in as an argument.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'src/core/ reads no clock. Take the current instant as an argument.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'src/core/ has no randomness. Take a random source as an argument.',
        },
      ],
    },
  },

  // Playwright specs run in Node, but the callbacks passed to page.evaluate
  // are serialized and run in the BROWSER, so they legitimately reference
  // document and window. Without this, `document is not defined` is reported
  // against code that never executes in Node.
  {
    files: ['e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Spike scripts are throwaway and run outside the build. They are allowed
  // console output and are not part of the typed source tree.
  {
    files: ['scripts/**/*.{mjs,ts}'],
    rules: { 'no-console': 'off' },
  },

  prettier,
]
