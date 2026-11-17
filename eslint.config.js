import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-server/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'api/index.js',
      // Scripts de diagnóstico pontuais na raiz: correm-se à mão com `node`,
      // não fazem parte da aplicação nem do bundle. Mantê-los fora do lint
      // evita 20+ erros de CommonJS e expressões soltas sem valor de código.
      'check_supabase.cjs',
      'check_supabase.js',
      'compress_video.cjs',
      'full_setup.cjs',
      'get_*.cjs',
      'test_generation.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Scripts avulsos de manutenção são CommonJS por natureza (correm com
    // `node ficheiro.cjs`), fora do bundle da aplicação. Exigir-lhes `import`
    // obrigaria a convertê-los para ESM sem qualquer ganho.
    files: ['**/*.cjs', '*.js', 'scripts/**/*.{js,mjs}', 'tools/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // Convenção nos scripts: um nome prefixado com `_` é deliberadamente
      // ignorado (parâmetros de callback, valores de destructuring).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
);
