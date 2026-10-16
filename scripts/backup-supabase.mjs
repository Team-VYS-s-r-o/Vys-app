#!/usr/bin/env node
// Noční záloha Supabase do JSON. Stopgap, dokud projekt běží na free plánu bez PITR.
//
// Spuštění:  node scripts/backup-supabase.mjs
// Výstup:    ~/Documents/VYS-zalohy/<YYYY-MM-DD_HHmm>/<tabulka>.json  (+ _manifest.json)
// Čte SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY z aplikacevys.cz/.env.local (nebo z prostředí).
//
// POZOR: zálohuje jen data v schématu public přes PostgREST. NEzálohuje auth.users,
// soubory ve storage ani definice funkcí/RLS (ty žijí v supabase/migrations v gitu).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ENV_FILES = [
  path.join(homedir(), 'Desktop/aplikacevys.cz/.env.local'),
  path.join(homedir(), 'Documents/GitHub/Vys-app/.env.local'),
];

const KEEP_DAYS = 30;
const PAGE_SIZE = 1000;

async function loadEnv() {
  const env = { ...process.env };
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;
    const raw = await readFile(file, 'utf8');
    for (const line of raw.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (env[key]) continue;
      env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

async function listTables(env) {
  // PostgREST kořen vrací OpenAPI dokument se seznamem vystavených tabulek a views.
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Nelze načíst seznam tabulek: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return Object.keys(doc.paths ?? {})
    .filter((p) => p.startsWith('/') && p.length > 1 && !p.startsWith('/rpc/'))
    .map((p) => p.slice(1))
    .sort();
}

async function dumpTable(env, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const url = `${env.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function main() {
  const env = await loadEnv();
  env.SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.');
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const outDir = path.join(homedir(), 'Documents/VYS-zalohy', stamp);
  await mkdir(outDir, { recursive: true });

  const tables = await listTables(env);
  const manifest = { startedAt: now.toISOString(), supabaseUrl: env.SUPABASE_URL, tables: {}, errors: {} };

  for (const table of tables) {
    try {
      const rows = await dumpTable(env, table);
      await writeFile(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
      manifest.tables[table] = rows.length;
      console.log(`${table}: ${rows.length}`);
    } catch (error) {
      manifest.errors[table] = String(error.message ?? error);
      console.error(`${table}: CHYBA — ${error.message ?? error}`);
    }
  }

  manifest.finishedAt = new Date().toISOString();
  manifest.totalRows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  await writeFile(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\nHotovo: ${Object.keys(manifest.tables).length} tabulek, ${manifest.totalRows} řádků → ${outDir}`);
  if (Object.keys(manifest.errors).length) {
    console.error(`Chyby u ${Object.keys(manifest.errors).length} tabulek — viz _manifest.json`);
  }

  // Úklid záloh starších než KEEP_DAYS.
  const { readdir, rm, stat } = await import('node:fs/promises');
  const root = path.join(homedir(), 'Documents/VYS-zalohy');
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const entry of await readdir(root)) {
    const full = path.join(root, entry);
    if (full === outDir) continue;
    const info = await stat(full).catch(() => null);
    if (info?.isDirectory() && info.mtimeMs < cutoff) {
      await rm(full, { recursive: true, force: true });
      console.log(`Smazána stará záloha: ${entry}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
