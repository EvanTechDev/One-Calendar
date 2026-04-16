import js from '@eslint/js'
import next from 'eslint-config-next'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next(),
  {
    rules: {
      "no-console": "warn",
      "prefer-const": "error"
    }
  }
]
