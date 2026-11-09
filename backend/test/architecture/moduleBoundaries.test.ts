import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pruebas de arquitectura ("fitness functions"): fallan si alguien —humano o IA—
 * rompe el desacoplamiento del monolito modular.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const MODULES = join(SRC, 'modules');

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listTsFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');
}

function moduleOf(path: string): string | null {
  const rel = relative(MODULES, path);
  return rel.startsWith('..') ? null : (rel.split(sep)[0] ?? null);
}

const moduleFiles = listTsFiles(MODULES);

describe('Arquitectura del monolito modular', () => {
  it('un módulo solo importa de otro módulo a través de su public.ts', () => {
    const violations: string[] = [];
    for (const file of moduleFiles) {
      const own = moduleOf(file);
      for (const spec of importsOf(file).filter((s) => s.startsWith('.'))) {
        const target = resolve(dirname(file), spec).replace(/\.js$/, '.ts');
        const targetModule = moduleOf(target);
        if (targetModule && targetModule !== own && target !== join(MODULES, targetModule, 'public.ts')) {
          violations.push(`${relative(SRC, file)} → ${spec}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });

  it('la capa de dominio no depende de aplicación, infraestructura ni Express', () => {
    const violations = moduleFiles
      .filter((file) => file.includes(`${sep}domain${sep}`))
      .flatMap((file) =>
        importsOf(file)
          .filter((spec) => /infrastructure|express|\/http\//.test(spec))
          .map((spec) => `${relative(SRC, file)} → ${spec}`),
      );
    assert.deepEqual(violations, []);
  });

  it('dominio y aplicación no usan `new Date()` sin argumentos (se inyecta Clock)', () => {
    const violations = moduleFiles
      .filter((file) => /[\\/](domain|application)[\\/]/.test(file))
      .filter((file) => /new Date\(\s*\)/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    assert.deepEqual(violations, []);
  });

  it('ningún archivo de src usa el tipo any', () => {
    const violations = listTsFiles(SRC)
      .filter((file) => /:\s*any\b|<any>|as any\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    assert.deepEqual(violations, []);
  });
});
