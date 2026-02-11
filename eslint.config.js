import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // Possible Errors
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Best Practices
      curly: ['error', 'multi-line'],
      'default-case': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-return-await': 'error',

      // Variables
      'no-shadow': 'warn',
      'no-undef-init': 'error',

      // Style (handled by Prettier, but some semantic rules)
      'prefer-const': 'error',
      'prefer-template': 'warn',
      'no-var': 'error',
      'object-shorthand': ['warn', 'always'],

      // ES6
      'arrow-body-style': ['warn', 'as-needed'],
      'no-useless-constructor': 'warn',
      'prefer-arrow-callback': 'warn',
      'prefer-destructuring': ['warn', { object: true, array: false }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
    },
  },
  eslintConfigPrettier,
];
