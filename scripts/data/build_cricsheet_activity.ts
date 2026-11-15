// ============================================================
// IPL DYNASTY - Cricsheet Activity Index Builder
// Scans extracted Cricsheet `*_info.csv` files (one sub-folder per league)
// and records each registry person's most recent professional T20 match.
//
// Usage:
//   1. Download & unzip from https://cricsheet.org/downloads/ into <dir>/<league>/
//      (ipl, t20s_male, sma_male, bbl_male, cpl_male, sat_male, ilt_male,
//       mlc_male, ntb_male, hnd_male, lpl_male, bpl_male)
//   2. npx tsx scripts/data/build_cricsheet_activity.ts <dir> <out.json>
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

export interface CricsheetActivity {
  names: string[];
  last: string; // ISO date of most recent T20 appearance in any covered league
  lastIpl: string;
  lastIndianDomestic: string; // IPL / SMAT / India T20I
  leagues: Record<string, number>;
  team: string;
  intlTeams: string[]; // national sides represented in T20 internationals
}

const [root, outFile] = process.argv.slice(2);
if (!root || !outFile) {
  console.error('Usage: tsx build_cricsheet_activity.ts <cricsheet-dir> <out.json>');
  process.exit(1);
}

const out: Record<string, CricsheetActivity> = {};

for (const league of fs.readdirSync(root)) {
  const dir = path.join(root, league);
  if (!fs.statSync(dir).isDirectory()) continue;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('_info.csv')) continue;
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    let date = '';
    const registry: [string, string][] = [];
    const teamOf: Record<string, string> = {};

    for (const line of lines) {
      const p = line.split(',');
      if (p[1] === 'date' && !date) date = p[2].trim().replace(/\//g, '-');
      if (p[1] === 'player') teamOf[p.slice(3).join(',').trim()] = p[2];
      if (p[1] === 'registry' && p[2] === 'people') registry.push([p[3], p[4].trim()]);
    }

    for (const [name, id] of registry) {
      const rec = (out[id] ||= { names: [], last: '', lastIpl: '', lastIndianDomestic: '', leagues: {}, team: '', intlTeams: [] });
      if (!rec.names.includes(name)) rec.names.push(name);
      rec.leagues[league] = (rec.leagues[league] || 0) + 1;
      if (date > rec.last) {
        rec.last = date;
        rec.team = teamOf[name] || '';
      }
      if (league === 'ipl' && date > rec.lastIpl) rec.lastIpl = date;
      if (league.startsWith('t20s') && teamOf[name] && !rec.intlTeams.includes(teamOf[name])) {
        rec.intlTeams.push(teamOf[name]);
      }
      const indianT20I = league.startsWith('t20s') && teamOf[name] === 'India';
      if ((league === 'ipl' || league.startsWith('sma') || indianT20I) && date > rec.lastIndianDomestic) {
        rec.lastIndianDomestic = date;
      }
    }
  }
}

fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`Indexed ${Object.keys(out).length} Cricsheet people -> ${outFile}`);
