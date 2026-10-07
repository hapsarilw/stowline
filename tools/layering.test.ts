import { ESLint } from 'eslint';
import { describe, expect, it, vi } from 'vitest';

// NFR-22: the domain layer imports nothing from React, three.js or the DOM.
// These tests lint a snippet as if it lived in src/domain, using the real ESLint config.
// The first lint starts a type-aware ESLint over the whole project, which takes a few seconds.
vi.setConfig({ testTimeout: 60_000 });

const eslint = new ESLint();

async function messages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) =>
    [
      'no-restricted-imports',
      'no-restricted-globals',
      '@typescript-eslint/no-explicit-any',
    ].includes(m.ruleId ?? ''),
  );
}

const inDomain = 'src/domain/types.ts';

describe('domain layering rule', () => {
  it.each([
    ['react', "import { useState } from 'react';\nexport const s = useState;"],
    ['react-dom', "import { createRoot } from 'react-dom/client';\nexport const c = createRoot;"],
    ['three', "import * as THREE from 'three';\nexport const v = THREE.Vector3;"],
    ['react three fiber', "import { Canvas } from '@react-three/fiber';\nexport const c = Canvas;"],
    ['zustand', "import { create } from 'zustand';\nexport const c = create;"],
    ['a layer above', "import { x } from '../state/plan-store';\nexport const y = x;"],
    ['features', "import { x } from '@/features/inspector/x';\nexport const y = x;"],
  ])('blocks an import of %s', async (_name, code) => {
    const found = await messages(code, inDomain);
    expect(found.map((m) => m.ruleId)).toContain('no-restricted-imports');
  });

  it.each(['document', 'window', 'localStorage', 'requestAnimationFrame'])(
    'blocks use of the global %s',
    async (name) => {
      const found = await messages(`export const x = typeof ${name};`, inDomain);
      expect(found.map((m) => m.ruleId)).toContain('no-restricted-globals');
    },
  );

  it('blocks any in the domain', async () => {
    const found = await messages('export const x: any = 1;', inDomain);
    expect(found.map((m) => m.ruleId)).toContain('@typescript-eslint/no-explicit-any');
  });

  it('allows plain TypeScript in the domain', async () => {
    const found = await messages(
      "import type { Plan } from './types';\nexport const n = (p: Plan): number => p.version;",
      inDomain,
    );
    expect(found).toEqual([]);
  });

  it('does not restrict the layers above the domain', async () => {
    const found = await messages(
      "import { useState } from 'react';\nexport const s = useState;\nexport const t = document.title;",
      'src/App.tsx',
    );
    expect(found.filter((m) => m.ruleId !== '@typescript-eslint/no-explicit-any')).toEqual([]);
  });
});
