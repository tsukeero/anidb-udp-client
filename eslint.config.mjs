import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [ 'dist/', 'lib/', 'testing/node_modules/', 'coverage/', 'docs/' ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [ '**/*.{js,mjs,cjs,ts}' ],
    plugins: {
      '@stylistic': stylistic,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        __DEV__: 'writable',
        __CLIENT__: 'writable',
        __REV__: 'writable',
      },
    },
    rules: {
      // 2 = errors (bugs)
      'default-case': 2,
      'eqeqeq': [ 2, 'smart' ],
      'no-eval': 2,
      'no-implied-eval': 2,
      'no-extend-native': 2,
      'no-irregular-whitespace': 2,
      'no-obj-calls': 2,
      'no-octal': 2,
      'no-proto': 2,
      'no-redeclare': 2,
      'no-throw-literal': 2,
      'no-undef': 0,
      'no-use-before-define': [ 2, { functions: false }],
      'no-var': 2,
      'no-with': 2,
      'radix': 2,
      'use-isnan': 2,
      '@stylistic/space-infix-ops': [ 2, { int32Hint: false }],
      '@stylistic/space-unary-ops': [ 2, { words: true, nonwords: false }],
      '@stylistic/wrap-iife': [ 2, 'outside' ],

      // 1 = warnings (fugly code)
      'func-style': [ 1, 'declaration', { allowArrowFunctions: true }],
      'no-implicit-coercion': [ 1, { 'boolean': false }],
      'no-useless-return': 1,
      'prefer-const': 1,
      'require-await': 1,
      'require-yield': 1,
      'strict': 0,
      '@stylistic/array-bracket-spacing': [ 1, 'always', { singleValue: true, objectsInArrays: false, arraysInArrays: false }],
      '@stylistic/arrow-spacing': 1,
      // function args/params were never checked (eslintrc defaulted to ecmaVersion 5)
      '@stylistic/comma-dangle': [ 1, {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'ignore',
        enums: 'ignore',
        generics: 'ignore',
        tuples: 'ignore',
      }],
      '@stylistic/indent': [ 1, 2, { 'SwitchCase': 0 }],
      '@stylistic/jsx-quotes': [ 1, 'prefer-single' ],
      '@stylistic/key-spacing': [ 1, { beforeColon: false, afterColon: true }],
      '@stylistic/keyword-spacing': 1,
      '@stylistic/linebreak-style': [ 1, 'unix' ],
      '@stylistic/no-multi-spaces': 1,
      '@stylistic/no-multiple-empty-lines': [ 1, { 'max': 2, 'maxEOF': 0 }],
      '@stylistic/no-trailing-spaces': 1,
      '@stylistic/object-curly-spacing': [ 1, 'always' ],
      '@stylistic/quotes': [ 1, 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
      '@stylistic/rest-spread-spacing': [ 1, 'never' ],
      '@stylistic/semi': [ 1, 'never' ],
      '@stylistic/space-before-blocks': 1,
      '@stylistic/space-before-function-paren': [ 1, 'always' ],
      '@stylistic/spaced-comment': [ 1, 'always', { exceptions: [ '*' ], block: { balanced: true } }],
      '@stylistic/template-curly-spacing': [ 1, 'always' ],
      '@stylistic/template-tag-spacing': [ 1, 'never' ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [ 1, { argsIgnorePattern: '^_', varsIgnorePattern: '(^log$)|(^_.*)' }],
    },
  },
)
