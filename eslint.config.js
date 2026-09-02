import withNuxt from './.nuxt/eslint.config.mjs';
import vue from 'eslint-plugin-vue';
import vuetify from 'eslint-plugin-vuetify';

export default withNuxt(
  ...vue.configs['flat/base'],
  ...vuetify.configs['flat/base'],
  {
    ignores: ['dist/*'],
    rules: {
      'array-callback-return': 'error',
      'dot-notation': 'error',
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      'import/no-named-as-default': 'off',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': ['error', { allowNamedFunctions: false, allowUnboundThis: true }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'prefer-template': 'error',

      '@stylistic/array-bracket-newline': ['error', 'consistent'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/import/no-named-as-default': 'off',
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/newline-per-chained-call': ['error', { ignoreChainWithDepth: 2 }],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
      '@stylistic/no-return-assign': 'off',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-whitespace-before-property': 'error',
      '@stylistic/object-curly-newline': ['error', { consistent: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/padding-line-between-statements': ['error', { blankLine: 'always', prev: 'if', next: '*' }, { blankLine: 'any', prev: '*', next: 'if' }, { blankLine: 'always', prev: 'function', next: 'function' }, { blankLine: 'always', prev: 'import', next: '*' }, { blankLine: 'never', prev: 'import', next: 'import' }],
      '@stylistic/quote-props': ['error', 'consistent-as-needed'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/require-await': 'off',
      '@stylistic/semi-spacing': 'error',
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/spaced-comment': ['error', 'always'],
      '@stylistic/template-curly-spacing': ['error', 'never'],

      // Turned off for eslint@9.39.0
      // @see https://github.com/eslint/eslint/issues/20272
      '@typescript-eslint/unified-signatures': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/attributes-order': ['error', { alphabetical: true }],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'vue/first-attribute-linebreak': ['error', { singleline: 'beside', multiline: 'below' }],
      'vue/max-attributes-per-line': ['error', { singleline: { max: 1 }, multiline: { max: 1 } }],
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/object-curly-spacing': ['error', 'always'],
      'vue/padding-line-between-blocks': 'error', 'vue/component-name-in-template-casing': ['error', 'kebab-case', { registeredComponentsOnly: false, ignores: [] }],
      'vue/script-indent': ['error', 2, { baseIndent: 1, switchCase: 1, ignores: [] }],

      '@stylistic/indent': 'off'
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
