// ============================================================
// IPL DYNASTY - Player Database Cleaner
// Produces an auction-ready global player database that is:
//   1. Free of Pakistani nationals (not eligible for the IPL auction)
//   2. Free of duplicates (same person stored twice, e.g. "Andre Russell"
//      and "AD Russell", or "Amit Mishra" and "Amit Mishra (2)")
//   3. Free of retired / long-inactive players, using a verified
//      retirement list plus last-appearance data from Cricsheet.
//
// Usage:
//   npx tsx scripts/data/build_cricsheet_activity.ts <cricsheet-dir> activity.json
//   npx tsx scripts/data/clean_player_database.ts activity.json [--dry-run]
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Player } from '../../src/lib/types/game';

interface Activity {
  names: string[];
  last: string;
  lastIpl: string;
  lastIndianDomestic: string;
  leagues: Record<string, number>;
  team: string;
  intlTeams: string[];
}

const DB_PATH = path.resolve(__dirname, '../../src/lib/data/global-player-database.json');
const REPORT_PATH = path.resolve(__dirname, './clean_player_database.report.json');

const [activityFile, ...flags] = process.argv.slice(2);
const DRY_RUN = flags.includes('--dry-run');
if (!activityFile) {
  console.error('Usage: tsx clean_player_database.ts <activity.json> [--dry-run]');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const activity: Record<string, Activity> = JSON.parse(fs.readFileSync(activityFile, 'utf8'));
let players: Player[] = db.players;
const report: Record<string, string[]> = { pakistan: [], duplicates: [], retired: [], inactive: [], unresolved: [] };

// ------------------------------------------------------------
// Verified retirements (IPL or all cricket) as of Nov 2026.
// These players have publicly retired from the IPL / Indian cricket,
// even if they still appear in overseas leagues.
// ------------------------------------------------------------
// Keyed by display name (DB ids are not always canonical, e.g. "ravichandran-ashwin-csk").
const VERIFIED_RETIRED: Record<string, string> = {
  'dinesh-karthik': 'Retired from IPL & all Indian cricket (Jun 2024)',
  'shikhar-dhawan': 'Retired from international & domestic cricket (Aug 2024)',
  'ravichandran-ashwin': 'Retired from IPL (Aug 2025)',
  'piyush-chawla': 'Retired from all forms of cricket (Jun 2025)',
  'amit-mishra': 'Retired from all forms of cricket (Sep 2025)',
  'wriddhiman-saha': 'Retired from all forms of cricket (Feb 2025)',
  'andre-russell': 'Retired from IPL (Nov 2025)',
  'kieron-pollard': 'Retired from IPL (Nov 2022)',
  'dwayne-bravo': 'Retired from IPL (2022) and all cricket (2024)',
  'kedar-jadhav': 'Retired from all cricket (Jun 2024)',
  'ambati-rayudu': 'Retired from IPL (May 2023)',
  'varun-aaron': 'Retired from all cricket (Jan 2025)',
  'mohit-sharma': 'Retired from all forms of Indian cricket (Dec 2025)',
  'imran-tahir': 'No IPL appearance since 2021; aged 47',
};

// Curated full-name records whose Cricsheet registry name is ambiguous.
const CRICSHEET_ALIASES: Record<string, string> = {
  'rohit-sharma': 'RG Sharma',
  'cameron-green': 'C Green',
  'rinku-singh': 'RK Singh',
  'prabhsimran-singh': 'P Simran Singh',
  'jitesh-sharma': 'JM Sharma',
  'finn-allen': 'FH Allen',
  'karn-sharma': 'KV Sharma',
  'kumar-kartikeya-singh': 'K Kartikeya',
  'kumar-kartikeya': 'K Kartikeya',
  'wanindu-hasaranga': 'PWH de Silva',
  'varun-chakravarthy': 'CV Varun',
  'dinesh-karthik': 'KD Karthik',
  'sai-sudharsan': 'B Sai Sudharsan',
  'sai-kishore': 'R Sai Kishore',
  'nitish-kumar-reddy': 'Nithish Kumar Reddy',
  'rasikh-dar-salam': 'Rasikh Salam',
  'ravindra-jadeja': 'RA Jadeja',
  'shubham-dubey': 'SB Dubey',
  'harshal-patel': 'HV Patel',
  'daryl-mitchell': 'DJ Mitchell',
};

const FOREIGN_LEAGUES = ['bbl_male', 'cpl_male', 'sat_male', 'ilt_male', 'mlc_male', 'lpl_male', 'bpl_male'];

const slug = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
const COUNTRY_ALIASES: Record<string, string> = {
  'United Arab Emirates': 'UAE',
  'United States of America': 'USA',
};
const normCountry = (c: string) => COUNTRY_ALIASES[c] || c;

/** A Cricsheet person is compatible with a DB player unless they represented a different nation. */
function countryCompatible(p: Player, rec: Activity | undefined): boolean {
  const nations = (rec?.intlTeams || []).filter((t) => !/\bXI$/.test(t)); // ignore World XI / Asia XI
  if (!nations.length) return true;
  return nations.some((t) => normCountry(t) === p.country);
}

const nameIndex = new Map<string, string[]>();
for (const [id, rec] of Object.entries(activity)) {
  for (const n of rec.names) nameIndex.set(n, [...(nameIndex.get(n) || []), id]);
}

const isInitialsName = (n: string) => /^[A-Z]{1,4} /.test(n);
const tokens = (n: string) => n.replace(/\s*\(\d+\)$/, '').trim().split(/\s+/);
const hasRealCricsheetId = (p: Player) =>
  !!p.cricsheetId && !!activity[p.cricsheetId] && countryCompatible(p, activity[p.cricsheetId]);
const richness = (p: Player) =>
  (p.currentFranchiseId ? 100 : 0) +
  (String(p.cricsheetId).startsWith('cric_') ? 50 : 0) +
  (isInitialsName(p.name) ? 0 : 20) +
  (/\(\d+\)$/.test(p.name) ? -40 : 0) +
  p.stats.matches / 100;

function mergeInto(keep: Player, drop: Player, reason: string) {
  keep.alternateNames = Array.from(new Set([...(keep.alternateNames || []), drop.name]));
  if (!keep.currentFranchiseId && drop.currentFranchiseId) keep.currentFranchiseId = drop.currentFranchiseId;
  if (!hasRealCricsheetId(keep) && hasRealCricsheetId(drop)) keep.cricsheetId = drop.cricsheetId;
  keep.previousFranchises = Array.from(new Set([...keep.previousFranchises, ...drop.previousFranchises]));
  report.duplicates.push(`${drop.name} (${drop.id}) -> merged into ${keep.name} (${keep.id}) [${reason}]`);
}

// ------------------------------------------------------------
// 0. Drop Cricsheet IDs that point at a different person (wrong nation),
//    and correct nationality for players whose only T20I side contradicts the DB.
// ------------------------------------------------------------
for (const p of players) {
  const rec = p.cricsheetId ? activity[p.cricsheetId] : undefined;
  if (rec && !countryCompatible(p, rec)) {
    // A curated star bound to a namesake's ID (e.g. "Rohit Sharma" -> an Indonesian Rohit Sharma)
    if (p.stats.matches >= 10 || p.currentFranchiseId) {
      p.cricsheetId = `cric_${p.id}`;
    } else if (rec.intlTeams.length === 1) {
      const nation = normCountry(rec.intlTeams[0]);
      p.country = nation;
      p.nationality = nation === 'India' ? 'Indian' : 'Overseas';
    }
  }
}

// ------------------------------------------------------------
// 1. Remove Pakistani nationals
// ------------------------------------------------------------
players = players.filter((p) => {
  if (/pakistan/i.test(p.country)) {
    report.pakistan.push(`${p.name} (${p.id})`);
    return false;
  }
  return true;
});

// Normalise compound country labels
for (const p of players) {
  if (p.country === 'Singapore/Australia') p.country = 'Australia';
}

// ------------------------------------------------------------
// 2a. Duplicates sharing the same real Cricsheet ID
// ------------------------------------------------------------
{
  const byCs = new Map<string, Player[]>();
  for (const p of players) {
    if (!hasRealCricsheetId(p)) continue;
    byCs.set(p.cricsheetId!, [...(byCs.get(p.cricsheetId!) || []), p]);
  }
  const dropped = new Set<string>();
  for (const group of byCs.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => richness(b) - richness(a));
    for (const d of group.slice(1)) {
      mergeInto(group[0], d, 'same Cricsheet ID');
      dropped.add(d.id);
    }
  }
  players = players.filter((p) => !dropped.has(p.id));
}

// ------------------------------------------------------------
// 2b. Curated full-name records duplicated by an initials-name record
//     (e.g. "Glenn Maxwell" / "GJ Maxwell"). Resolve each curated record to
//     its Cricsheet person, then fold in any DB record pointing at that person.
// ------------------------------------------------------------
function resolveCricsheetId(p: Player): string | undefined {
  if (hasRealCricsheetId(p)) return p.cricsheetId;
  const alias = CRICSHEET_ALIASES[p.id] || CRICSHEET_ALIASES[slug(p.name)];
  if (alias) return nameIndex.get(alias)?.[0];
  const exact = (nameIndex.get(p.name) || []).filter((id) => countryCompatible(p, activity[id]));
  if (exact.length === 1) return exact[0];

  const t = tokens(p.name);
  const last = t[t.length - 1];
  const first = t[0];
  const candidates: { id: string; ipl: number }[] = [];
  for (const [n, ids] of nameIndex) {
    const nt = n.split(' ');
    if (nt[nt.length - 1] !== last) continue;
    const head = nt[0];
    const headOk = isInitialsName(n) ? head[0] === first[0] : head === first;
    if (!headOk) continue;
    for (const id of ids) {
      if (!countryCompatible(p, activity[id])) continue;
      const ipl = activity[id].leagues.ipl || 0;
      if (ipl > 0) candidates.push({ id, ipl });
    }
  }
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => Math.abs(a.ipl - p.stats.matches) - Math.abs(b.ipl - p.stats.matches));
  return candidates[0].id;
}

{
  const dropped = new Set<string>();
  const byCs = new Map<string, Player>();
  for (const p of players) if (hasRealCricsheetId(p)) byCs.set(p.cricsheetId!, p);

  for (const p of players) {
    if (hasRealCricsheetId(p) || dropped.has(p.id)) continue;
    const cs = resolveCricsheetId(p);
    if (!cs) {
      report.unresolved.push(`${p.name} (${p.id})`);
      continue;
    }
    const twin = byCs.get(cs);
    if (twin && twin.id !== p.id && !dropped.has(twin.id)) {
      const [keep, drop] = richness(p) >= richness(twin) ? [p, twin] : [twin, p];
      mergeInto(keep, drop, `Cricsheet person ${cs}`);
      dropped.add(drop.id);
      keep.cricsheetId = cs;
      byCs.set(cs, keep);
    } else {
      p.cricsheetId = cs;
      byCs.set(cs, p);
    }
  }
  players = players.filter((p) => !dropped.has(p.id));
}

// 2c. Final safety net: identical normalised names + country
{
  const seen = new Map<string, Player>();
  const dropped = new Set<string>();
  for (const p of [...players].sort((a, b) => richness(b) - richness(a))) {
    const key = `${tokens(p.name).join(' ').toLowerCase()}|${p.country}`;
    const prior = seen.get(key);
    if (prior && (!hasRealCricsheetId(p) || !hasRealCricsheetId(prior) || prior.cricsheetId === p.cricsheetId)) {
      mergeInto(prior, p, 'identical name');
      dropped.add(p.id);
    } else if (!prior) {
      seen.set(key, p);
    }
  }
  players = players.filter((p) => !dropped.has(p.id));
}

// ------------------------------------------------------------
// 3. Retirements & inactivity
// ------------------------------------------------------------
function inactivityReason(p: Player): string | null {
  const rec = p.cricsheetId ? activity[p.cricsheetId] : undefined;
  if (!rec) {
    // No professional T20 footprint at all: keep only young prospects.
    return p.age > 30 ? `no recorded professional T20 match, age ${p.age}` : null;
  }

  if (p.nationality === 'Indian') {
    const played = FOREIGN_LEAGUES.filter((l) => rec.leagues[l]);
    if (played.length && rec.last > rec.lastIndianDomestic) {
      return `plays overseas leagues (${played.join(', ')}) — retired from Indian cricket`;
    }
    const lastIndian = rec.lastIndianDomestic || rec.last;
    if (lastIndian < '2021-07-01') return `last Indian T20 match ${lastIndian}`;
    if (lastIndian < '2024-01-01' && p.age >= 32) return `last Indian T20 match ${lastIndian}, age ${p.age}`;
    if (lastIndian < '2024-07-01' && p.age >= 35) return `last Indian T20 match ${lastIndian}, age ${p.age}`;
    return null;
  }

  if (rec.last < '2024-07-01') return `last professional T20 match ${rec.last}`;
  return null;
}

players = players.filter((p) => {
  const verified = VERIFIED_RETIRED[p.id] || VERIFIED_RETIRED[slug(p.name)];
  if (verified || p.isRetired || p.retirementScope === 'ALL_CRICKET' || p.retirementScope === 'IPL_ONLY') {
    report.retired.push(`${p.name} (${p.id}): ${verified || p.retirementNotes || p.retirementScope}`);
    return false;
  }
  const reason = inactivityReason(p);
  if (reason) {
    report.inactive.push(`${p.name} (${p.id}): ${reason}`);
    return false;
  }
  return true;
});

// Stamp verified last-appearance metadata on survivors
const now = new Date().toISOString();
for (const p of players) {
  const rec = p.cricsheetId ? activity[p.cricsheetId] : undefined;
  if (rec) {
    p.lastVerifiedMatch = {
      matchDate: rec.last,
      tournament: rec.team,
      teams: rec.team,
      matchType: rec.last === rec.lastIpl ? 'IPL' : 'Franchise-T20',
    };
  }
  p.isRetired = false;
  p.professionalStatus = 'ACTIVE';
  p.iplStatus = 'ACTIVE';
  p.retirementScope = p.retirementScope === 'INTERNATIONAL_ONLY' ? 'INTERNATIONAL_ONLY' : 'NONE';
  p.auctionRegistrationStatus = 'REGISTERED';
  p.isAvailableForAuction = true;
  p.lastVerificationDate = now;
  p.verificationSource = 'Cricsheet last-appearance index (IPL, T20I, SMAT, BBL, CPL, SA20, ILT20, MLC, Blast, Hundred, LPL, BPL)';
}

// ------------------------------------------------------------
// 4. Write
// ------------------------------------------------------------
db.players = players;
db.provenance = {
  ...db.provenance,
  totalPlayers: players.length,
  activePlayerCount: players.length,
  retiredPlayerCount: 0,
  cleanedAt: now,
  cleaning: {
    pakistanRemoved: report.pakistan.length,
    duplicatesMerged: report.duplicates.length,
    retiredRemoved: report.retired.length,
    inactiveRemoved: report.inactive.length,
  },
};

const summary = Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.length]));
console.log('Cleaning summary:', summary, '→ remaining players:', players.length);
const countries: Record<string, number> = {};
players.forEach((p) => (countries[p.country] = (countries[p.country] || 0) + 1));
console.log('By country:', countries);

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
if (!DRY_RUN) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n');
  console.log(`Wrote ${DB_PATH}`);
} else {
  console.log('Dry run — database not written. Report:', REPORT_PATH);
}
