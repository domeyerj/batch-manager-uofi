#!/usr/bin/env node
/**
 * Changelog helper shared by Claude and Gemini agents.
 *
 *   node scripts/changelog.mjs new --agent claude --slug add-job-monitor --title "Add job monitor page"
 *   node scripts/changelog.mjs list [--limit 10]
 *   node scripts/changelog.mjs open            # only in-progress / blocked entries
 *   node scripts/changelog.mjs validate        # check filenames + front matter
 *
 * Entries live in changelog/ as <YYYYMMDDTHHMMSSZ>_<agent>_<slug>.md (UTC), so a
 * plain directory listing is chronological. See changelog/README.md.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'changelog');
const TEMPLATE = join(DIR, '_TEMPLATE.md');
const AGENTS = ['claude', 'gemini', 'human'];
const STATUSES = ['in-progress', 'blocked', 'done', 'abandoned'];
const NAME_RE = /^(\d{8}T\d{6}Z)_([a-z]+)_([a-z0-9][a-z0-9-]*)\.md$/;
const STALE_MS = 24 * 60 * 60 * 1000;

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function stamp(d = new Date()) {
  const iso = d.toISOString(); // 2026-10-05T18:24:56.123Z
  return {
    file: iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'), // 20261005T182456Z
    iso: iso.replace(/\.\d{3}Z$/, 'Z'),
  };
}

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return fm;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return fm;
}

function entries() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => NAME_RE.test(f))
    .sort()
    .map((file) => {
      const [, ts, agent, slug] = file.match(NAME_RE);
      const fm = frontMatter(readFileSync(join(DIR, file), 'utf8'));
      return { file, ts, agent, slug, ...fm };
    });
}

function toDate(ts) {
  // 20261005T182456Z -> Date
  return new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`);
}

function row(e) {
  const updated = e.updated ? Date.parse(e.updated) : toDate(e.ts).getTime();
  const stale = ['in-progress', 'blocked'].includes(e.status) && Date.now() - updated > STALE_MS ? '  (STALE >24h)' : '';
  return `${e.ts}  ${(e.agent || '').padEnd(6)}  ${(e.status || '?').padEnd(11)}  ${e.title || e.slug}${stale}\n    ${e.file}${e.scope ? `\n    scope: ${e.scope}` : ''}`;
}

function cmdNew(a) {
  const agent = String(a.agent || '').toLowerCase();
  const slug = String(a.slug || '').toLowerCase();
  const title = a.title && a.title !== true ? String(a.title) : slug.replace(/-/g, ' ');
  if (!AGENTS.includes(agent)) fail(`--agent must be one of ${AGENTS.join(', ')}`);
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)) fail('--slug must be kebab-case, 3-61 chars');
  const t = stamp();
  const file = `${t.file}_${agent}_${slug}.md`;
  const id = file.replace(/\.md$/, '');
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const tpl = readFileSync(TEMPLATE, 'utf8')
    .replace(/\{\{id\}\}/g, id)
    .replace(/\{\{timestamp\}\}/g, t.iso)
    .replace(/\{\{agent\}\}/g, agent)
    .replace(/\{\{title\}\}/g, title.replace(/"/g, "'"));
  writeFileSync(join(DIR, file), tpl);
  const open = entries().filter((e) => e.file !== file && ['in-progress', 'blocked'].includes(e.status));
  console.log(`Created changelog/${file}`);
  if (open.length) {
    console.log('\nOther open entries — check for scope overlap before you start:');
    open.forEach((e) => console.log(row(e)));
  }
}

function cmdList(a, onlyOpen = false) {
  let list = entries();
  if (onlyOpen) list = list.filter((e) => ['in-progress', 'blocked'].includes(e.status));
  const limit = Number(a.limit || (onlyOpen ? 1000 : 10));
  const recent = list.slice(-limit);
  if (!recent.length) return console.log(onlyOpen ? 'No open entries.' : 'No changelog entries yet.');
  console.log(onlyOpen ? 'Open entries:' : `Last ${recent.length} entries (oldest first):`);
  recent.forEach((e) => console.log(row(e)));
  if (!onlyOpen) {
    const open = entries().filter((e) => ['in-progress', 'blocked'].includes(e.status));
    console.log(`\nOpen claims: ${open.length}${open.length ? ' — run `npm run changelog -- open`' : ''}`);
  }
}

function cmdValidate() {
  let bad = 0;
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.md') || f === 'README.md' || f.startsWith('_')) continue;
    const m = f.match(NAME_RE);
    if (!m) { console.log(`BAD NAME   ${f}`); bad++; continue; }
    const fm = frontMatter(readFileSync(join(DIR, f), 'utf8'));
    const problems = [];
    if (fm.id !== f.replace(/\.md$/, '')) problems.push('id != filename');
    if (fm.agent !== m[2]) problems.push('agent != filename');
    if (!STATUSES.includes(fm.status)) problems.push(`status "${fm.status}"`);
    if (!fm.title) problems.push('missing title');
    if (problems.length) { console.log(`BAD ENTRY  ${f}: ${problems.join(', ')}`); bad++; }
  }
  console.log(bad ? `\n${bad} problem(s).` : 'All changelog entries valid.');
  process.exit(bad ? 1 : 0);
}

function fail(msg) { console.error(`changelog: ${msg}`); process.exit(2); }

const a = args(process.argv.slice(2));
switch (a._[0]) {
  case 'new': cmdNew(a); break;
  case 'list': case undefined: cmdList(a); break;
  case 'open': cmdList(a, true); break;
  case 'validate': cmdValidate(); break;
  default: fail(`unknown command "${a._[0]}" (new | list | open | validate)`);
}
