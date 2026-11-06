// Reads the report files that playtesters send back (Settings > Send feedback > Download report) and prints
// how long each stage took them, with the median across players.
//   npx tsx scripts/playtest-report.ts reports/*.txt

import { readFileSync } from 'node:fs';

interface Row {
  file: string;
  stages: Record<number, number>; // stage -> hours played when reached
  notes: string;
  played: string;
}

export function parseReport(file: string, text: string): Row {
  const stages: Record<number, number> = {};
  for (const line of text.split('\n')) {
    const m = /^\S+\s+stage\s+(\{.*\})\s*$/.exec(line);
    if (!m) continue;
    try {
      const d = JSON.parse(m[1]) as { stage: number; played: number; run?: number };
      if ((d.run ?? 0) === 0 && d.stage && d.played >= 0 && stages[d.stage] === undefined) stages[d.stage] = d.played / 3600;
    } catch {
      /* skip a damaged line */
    }
  }
  const notes = /Notes from the player\n([\s\S]*?)\n\nMilestones/.exec(text)?.[1]?.trim() ?? '';
  const played = /^played: (.*)$/m.exec(text)?.[1] ?? '?';
  return { file, stages, notes, played };
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

if (process.argv[1]?.endsWith('playtest-report.ts')) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: tsx scripts/playtest-report.ts reports/*.txt');
    process.exit(2);
  }
  const rows = files.map((f) => parseReport(f, readFileSync(f, 'utf8')));
  console.log('Hours of play at which each stage was reached\n');
  console.log(['player'.padEnd(28), ...[2, 3, 4, 5, 6].map((n) => `S${n}`.padStart(7))].join(' '));
  for (const r of rows) console.log([r.file.slice(-28).padEnd(28), ...[2, 3, 4, 5, 6].map((n) => (r.stages[n] === undefined ? '-' : r.stages[n].toFixed(1)).padStart(7))].join(' '));
  console.log(['median'.padEnd(28), ...[2, 3, 4, 5, 6].map((n) => {
    const v = rows.map((r) => r.stages[n]).filter((x) => x !== undefined);
    return (v.length ? median(v).toFixed(1) : '-').padStart(7);
  })].join(' '));
  console.log(`\n${rows.length} report(s). Intended (attentive bot): S2 0.4, S3 2-3, S4 11-12, S5 26-29, S6 52-57 hours.\n`);
  for (const r of rows.filter((x) => x.notes && x.notes !== '(none)')) console.log(`--- ${r.file} (${r.played})\n${r.notes}\n`);
}
