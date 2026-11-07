import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    // android/ and ios/ are the generated Capacitor native projects - each holds a minified copy
    // of the built website, which is not our source and produced ~10,600 false errors the moment
    // `cap sync` had been run on a machine.
    ignores: ['dist/**', 'node_modules/**', 'build/**', 'coverage/**', 'prisma/migrations/**', 'android/**', 'ios/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Declared directly rather than spreading reactHooks.configs.recommended.rules -
      // that export's exact shape has changed across plugin versions, and a mismatch there
      // would crash the whole lint config rather than just one rule.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The existing codebase relies heavily on `any` at Express/Prisma boundaries -
      // tightening this is worthwhile future work, but flagging every occurrence today
      // would drown out real issues rather than surfacing them.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // public/sw.js is a service worker, not app code: it runs in ServiceWorkerGlobalScope,
    // where self/caches/clients/fetch/URL are ambient. The globals block above is scoped to
    // **/*.{ts,tsx}, so this file was linted with no environment at all and every one of
    // those references raised no-undef - 13 errors, which is what failed CI's Lint step
    // (and had been failing it on master since September).
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.browser },
    },
  }
);
