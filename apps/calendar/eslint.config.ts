import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import unusedImports from 'eslint-plugin-unused-imports'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import oxlint from 'eslint-plugin-oxlint'

const config: ConfigArray = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'warn',
      'no-console': 'warn',
      'prefer-const': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'off',
    },
  },
  {
    files: ['lib/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
  },
  oxlint.configs['flat/recommended'],
)

export default config
