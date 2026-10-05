#!/usr/bin/env node
/**
 * Look up ISC endpoints in the local SailPoint api-specs repo (idn specs only).
 *
 *   node scripts/api-find.mjs task-status
 *   node scripts/api-find.mjs "load-accounts" --spec v2026
 *   node scripts/api-find.mjs /task-status/v1 --detail       # params, filters, scopes, schema fields
 *   node scripts/api-find.mjs --op getTaskStatusListV1 --detail
 *
 * Spec location: $SAILPOINT_API_SPECS, else ../../../api-specs relative to this repo.
 * Specs: v1 (default, deref-sailpoint-api.json), v2026, v2025, v2024, v3, beta.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPECS = resolve(process.env.SAILPOINT_API_SPECS || join(ROOT, '..', '..', '..', 'api-specs'));
const FILES = {
  v1: 'deref-sailpoint-api.json',
  v2026: 'deref-sailpoint-api.v2026.json',
  v2025: 'deref-sailpoint-api.v2025.json',
  v2024: 'deref-sailpoint-api.v2024.json',
  v3: 'deref-sailpoint-api.v3.json',
  beta: 'deref-sailpoint-api.beta.json',
};
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head'];

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined; };
const term = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').match(/^--(spec|op)$/));
const specKey = opt('spec') || 'v1';
const opId = opt('op');
const detail = !!opt('detail');
const all = !!opt('all-specs');

if (!term && !opId) {
  console.error('usage: api-find <path-or-keyword> [--spec v1|v2026|v2025|v2024|v3|beta] [--detail] [--all-specs] | --op <operationId>');
  process.exit(2);
}

function load(key) {
  const f = join(SPECS, 'dereferenced', FILES[key]);
  if (!existsSync(f)) { console.error(`Spec not found: ${f}\nSet SAILPOINT_API_SPECS to the api-specs repo root.`); process.exit(2); }
  return JSON.parse(readFileSync(f, 'utf8'));
}

function makeResolver(doc) {
  return function res(x, depth = 0) {
    if (x && typeof x === 'object' && x.$ref && depth < 8) {
      const parts = x.$ref.replace(/^#\//, '').split('/');
      let cur = doc; for (const p of parts) cur = cur?.[p];
      return res(cur, depth + 1);
    }
    return x;
  };
}

function propsOf(schema, res) {
  schema = res(schema);
  if (!schema) return {};
  if (schema.type === 'array') return propsOf(schema.items, res);
  const out = {};
  for (const part of schema.allOf || [schema]) Object.assign(out, res(part)?.properties || {});
  return out;
}

const secOf = (o) => [...new Set((o.security || []).flatMap((s) => Object.values(s).flat()))];
const isExp = (o, res) => (o.parameters || []).some((p) => res(p)?.name?.toLowerCase() === 'x-sailpoint-experimental');

function search(key) {
  const doc = load(key);
  const res = makeResolver(doc);
  const hits = [];
  for (const [p, item] of Object.entries(doc.paths)) {
    for (const m of METHODS) {
      const o = item[m];
      if (!o) continue;
      const hay = `${p} ${o.operationId} ${o.summary || ''} ${(o.tags || []).join(' ')}`.toLowerCase();
      if (opId ? o.operationId === opId : hay.includes(String(term).toLowerCase())) hits.push({ p, m, o });
    }
  }
  const base = (doc.servers?.[0]?.url || '').replace(/^https?:\/\/[^/]+/, '');
  console.log(`\n== ${key} (${FILES[key]}) — ${hits.length} match(es)${base ? `  [paths below are relative to base "${base}" — prefix it when calling]` : ''}`);
  for (const { p, m, o } of hits) {
    console.log(`${m.toUpperCase().padEnd(6)} ${p}   [${o.operationId}]${isExp(o, res) ? '  EXPERIMENTAL' : ''}${o.deprecated ? '  DEPRECATED' : ''}`);
    if (!detail) continue;
    console.log(`  summary: ${o.summary || ''}`);
    console.log(`  scopes:  ${secOf(o).join(', ') || '(none listed)'}`);
    if (o['x-sailpoint-userLevels']) console.log(`  levels:  ${o['x-sailpoint-userLevels'].join(', ')}`);
    for (const prm of o.parameters || []) {
      const r = res(prm);
      const d = (r.description || '').replace(/\s+/g, ' ');
      console.log(`  param ${r.in}:${r.name}${r.required ? '*' : ''}  ${d.slice(0, r.name === 'filters' || r.name === 'sorters' ? 900 : 160)}`);
    }
    if (o.requestBody) {
      const [ct, body] = Object.entries(o.requestBody.content || {})[0] || [];
      console.log(`  body (${ct}): ${Object.keys(propsOf(body?.schema, res)).join(', ') || JSON.stringify(res(body?.schema))?.slice(0, 200)}`);
    }
    const ok = Object.entries(o.responses || {}).find(([c]) => c.startsWith('2'));
    if (ok) {
      const [code, r] = ok;
      const schema = Object.values(res(r).content || {})[0]?.schema;
      const props = propsOf(schema, res);
      console.log(`  ${code} fields:`);
      for (const [k, v] of Object.entries(props)) {
        const rv = res(v);
        const en = rv?.enum ? `  enum=${JSON.stringify(rv.enum)}` : '';
        console.log(`    .${k}: ${rv?.type || (rv?.allOf ? 'object' : '?')}${en}`);
      }
    }
  }
}

for (const key of all ? Object.keys(FILES) : [specKey]) search(key);
