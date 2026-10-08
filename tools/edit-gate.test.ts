import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// M8: no component holds a role or status check of its own. Every enabled, disabled or hidden
// state comes from the edit gate (src/state/edit-gate.ts), which asks canEdit and planActions.

const ROOTS = ['src/features', 'src/app', 'src/ui'];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

const RULES: [string, RegExp][] = [
  [
    'compares a plan status',
    /[!=]==\s*'(draft|in_review|approved)'|'(draft|in_review|approved)'\s*[!=]==/,
  ],
  [
    'compares a role',
    /[!=]==\s*'(planner|senior|terminal|officer)'|'(planner|senior|terminal|officer)'\s*[!=]==/,
  ],
  [
    'imports the gate from the domain',
    /import[^;]*\b(canEdit|planActions|transition|EDIT_ACTIONS)\b[^;]*from '@\/domain'/s,
  ],
  ['switches on a plan status', /case '(draft|in_review|approved)':/],
];

describe('components ask the edit gate, never the role or the status (M8)', () => {
  const files = ROOTS.flatMap((r) => [...sources(r)]);

  it('scans the component layers', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('finds no role or status check outside src/domain and src/state', () => {
    const found: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const [what, re] of RULES) if (re.test(text)) found.push(`${f}: ${what}`);
    }
    expect(found).toEqual([]);
  });

  it('would catch one (the rules are not empty)', () => {
    const sample = "if (header.status === 'approved') return null;\nconst x = role === 'senior';";
    expect(RULES.filter(([, re]) => re.test(sample)).map(([w]) => w)).toEqual([
      'compares a plan status',
      'compares a role',
    ]);
  });
});
