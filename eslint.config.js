import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// src/domain is pure TypeScript (NFR-22): no UI, 3D, state or DOM.
const domainRestrictedImports = {
  patterns: [
    {
      group: [
        'react',
        'react/*',
        'react-dom',
        'react-dom/*',
        'react-router',
        'react-router/*',
        'three',
        'three/*',
        '@react-three/*',
        'zustand',
        'zustand/*',
        '@tanstack/*',
        'comlink',
        'msw',
        'msw/*',
      ],
      message: 'src/domain must not import React, three, or other UI and runtime libraries.',
    },
    {
      group: [
        '@/app/*',
        '@/api/*',
        '@/features/*',
        '@/state/*',
        '@/ui/*',
        '@/worker/*',
        '**/app/**',
        '**/api/**',
        '**/features/**',
        '**/state/**',
        '**/ui/**',
        '**/worker/**',
      ],
      message: 'src/domain must not import from the layers above it.',
    },
  ],
};

const domainRestrictedGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'HTMLElement',
  'Element',
  'Node',
  'Worker',
  'fetch',
].map((name) => ({ name, message: 'src/domain must not use the DOM or browser APIs.' }));

export default defineConfig(
  {
    ignores: [
      'dist',
      'coverage',
      'design',
      'playwright-report',
      'test-results',
      'node_modules',
      'public',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // React Three Fiber changes three.js objects (camera, meshes, materials) inside useFrame
    // and effects, outside React renders. That is the intended pattern (CLAUDE.md "3D view"),
    // but the React Compiler rule reads it as mutating hook values. The app does not use the
    // React Compiler.
    files: ['src/features/viewport3d/scene/**/*.{ts,tsx}'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', domainRestrictedImports],
      'no-restricted-globals': ['error', ...domainRestrictedGlobals],
    },
  },
);
