const js = require('@eslint/js')
const eslintConfigPrettier = require('eslint-config-prettier/flat')
const pluginVue = require('eslint-plugin-vue')
const globals = require('globals')
const tseslint = require('typescript-eslint')

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['*.config.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  eslintConfigPrettier,
]
