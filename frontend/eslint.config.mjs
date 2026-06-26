import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintConfigPrettier from 'eslint-config-prettier'
import i18next from 'eslint-plugin-i18next'

export default [
  {
    ignores: ['dist', 'node_modules', 'wailsjs', '**/*.config.*'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  i18next.configs['flat/recommended'],
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: [
      'src/components/ui/button.tsx',
      'src/components/ui/badge.tsx',
      'src/components/ui/toggle.tsx',
      'src/components/ui/sidebar.tsx',
      'src/components/data-table.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          markupOnly: false,
          ignoreAttribute: [],
          validateTemplate: true,
        },
      ],
    },
  },
  eslintConfigPrettier,
]

