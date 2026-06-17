// SPEC 018.2 - guardas de seguridad: la service_role NUNCA puede aparecer en el
// frontend, y .env.example no puede contener claves reales.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const frontendRoot = process.cwd(); // app/frontend al ejecutar npm test
const srcDir = join(frontendRoot, 'src');
const repoRoot = join(frontendRoot, '..', '..');

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('SPEC 018.2 - seguridad de Supabase en frontend', () => {
  it('ningun archivo de frontend referencia la service_role key', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(srcDir)) {
      const text = readFileSync(file, 'utf-8');
      if (/service_role/i.test(text) || /SERVICE_ROLE_KEY/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('el frontend solo usa variables VITE_SUPABASE_* publicas', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(srcDir)) {
      const text = readFileSync(file, 'utf-8');
      // Cualquier env de Supabase usada en frontend debe llevar prefijo VITE_.
      const matches = text.match(/import\.meta\.env\.(\w+)/g) ?? [];
      for (const m of matches) {
        const name = m.replace('import.meta.env.', '');
        if (name.includes('SUPABASE') && !name.startsWith('VITE_')) {
          offenders.push(`${file}: ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('.env.example existe y no contiene claves reales', () => {
    const envExample = join(repoRoot, '.env.example');
    expect(existsSync(envExample)).toBe(true);
    const text = readFileSync(envExample, 'utf-8');
    expect(text).toContain('VITE_SUPABASE_URL');
    expect(text).toContain('VITE_SUPABASE_ANON_KEY');
    // Placeholders, no valores reales: ninguna clave JWT (empiezan por eyJ).
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});
