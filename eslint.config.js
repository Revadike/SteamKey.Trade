import globals from 'globals';
import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import vueEslintParser from 'vue-eslint-parser';
import vuetify from 'eslint-config-vuetify';
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.cjs', '**/*.vue'],
    languageOptions: {
      parser: vueEslintParser,
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    ignores: ['dist/*'],
    plugins: { vue },
    rules: {
      ...vuetify.rules,
      'array-bracket-newline': ['error', 'consistent'],
      'array-bracket-spacing': ['error', 'never'],
      'array-callback-return': 'error',
      'array-element-newline': ['error', 'consistent'],
      'arrow-spacing': 'error',
      'block-spacing': ['error', 'always'],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'comma-dangle': ['error', 'never'],
      'comma-spacing': ['error', { before: false, after: true }],
      'curly': ['error', 'all'],
      'import/no-named-as-default': 'off',
      'indent': ['error', 2, { SwitchCase: 1 }],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': 'error',
      'multiline-ternary': 'off',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
      'no-return-assign': 'off',
      'no-trailing-spaces': 'error',
      'no-whitespace-before-property': 'error',
      'object-curly-newline': ['error', { consistent: true }],
      'object-curly-spacing': ['error', 'always'],
      'object-shorthand': ['error', 'always'],
      'padded-blocks': ['error', 'never'],
      'prefer-const': ['error', { destructuring: 'all' }],
      'quote-props': ['error', 'consistent-as-needed'],
      'quotes': ['error', 'single'],
      'require-await': 'off',
      'semi': ['error', 'always'],
      'semi-spacing': 'error',
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', { anonymous: 'always', asyncArrow: 'always', named: 'never' }],
      'space-in-parens': ['error', 'never'],
      'space-infix-ops': 'error',
      'spaced-comment': ['error', 'always'],
      'vue/attributes-order': ['error', { alphabetical: true }],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/first-attribute-linebreak': ['error', { singleline: 'beside', multiline: 'below' }],
      'vue/max-attributes-per-line': ['error', { singleline: { max: 1 }, multiline: { max: 1 } }],
      'vue/object-curly-spacing': ['error', 'always'],
      'vue/padding-line-between-blocks': 'error',
      'vue/script-indent': ['error', 2, { baseIndent: 1, switchCase: 1, ignores: [] }]
    }
  },
  {
    files: ['**/*.vue'],
    rules: {
      'indent': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['functions/bin/**/*.js'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['supabase/functions/**/*.js'],
    rules: {
      'no-console': 'off'
    },
    languageOptions: {
      globals: {
        Deno: 'readonly',
        EdgeRuntime: 'readonly'
      }
    }
  }
);
