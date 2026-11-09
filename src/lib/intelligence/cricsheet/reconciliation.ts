// ============================================================
// IPL DYNASTY - Player Identity Reconciliation Layer
// Resolves Cricsheet / external names and aliases to canonical player IDs.
// ============================================================

import { PLAYERS } from '../../data/players';

// Dictionary of known aliases, alternate spellings, and Cricsheet scorecard names
const PLAYER_NAME_ALIASES: Record<string, string> = {
  // Key Indian & Overseas stars
  'RG Sharma': 'rohit-sharma',
  'Rohit G Sharma': 'rohit-sharma',
  'JJ Bumrah': 'jasprit-bumrah',
  'Jasprit J Bumrah': 'jasprit-bumrah',
  'V Kohli': 'virat-kohli',
  'Virat Kohli': 'virat-kohli',
  'SA Yadav': 'suryakumar-yadav',
  'Suryakumar Yadav': 'suryakumar-yadav',
  'HH Pandya': 'hardik-pandya',
  'Hardik H Pandya': 'hardik-pandya',
  'MS Dhoni': 'ms-dhoni',
  'Mahendra Singh Dhoni': 'ms-dhoni',
  'RA Jadeja': 'ravindra-jadeja',
  'Ravindrasinh Jadeja': 'ravindra-jadeja',
  'RD Gaikwad': 'ruturaj-gaikwad',
  'Ruturaj Gaikwad': 'ruturaj-gaikwad',
  'H Klaasen': 'heinrich-klaasen',
  'Heinrich Klaasen': 'heinrich-klaasen',
  'TM Head': 'travis-head',
  'Travis M Head': 'travis-head',
  'PJ Cummins': 'pat-cummins',
  'Pat Cummins': 'pat-cummins',
  'MA Starc': 'mitchell-starc',
  'Mitchell Starc': 'mitchell-starc',
  'SS Iyer': 'shreyas-iyer',
  'Shreyas Iyer': 'shreyas-iyer',
  'SP Narine': 'sunil-narine',
  'Sunil Narine': 'sunil-narine',
  'AD Russell': 'andre-russell',
  'Andre Russell': 'andre-russell',
  'SV Samson': 'sanju-samson',
  'Sanju Samson': 'sanju-samson',
  'YBK Jaiswal': 'yashasvi-jaiswal',
  'Yashasvi Jaiswal': 'yashasvi-jaiswal',
  'RR Pant': 'rishabh-pant',
  'Rishabh Pant': 'rishabh-pant',
  'KL Rahul': 'kl-rahul',
  'K L Rahul': 'kl-rahul',
  'Shubman Gill': 'shubman-gill',
  'S Gill': 'shubman-gill',
  'Rashid Khan': 'rashid-khan',
  'R Khan': 'rashid-khan',
  'Mohammed Shami': 'mohammed-shami',
  'M Shami': 'mohammed-shami',
  'Mohammed Siraj': 'mohammed-siraj',
  'M Siraj': 'mohammed-siraj',
  'Arshdeep Singh': 'arshdeep-singh',
  'A Singh': 'arshdeep-singh',
  'Rinku Singh': 'rinku-singh',
  'R Singh': 'rinku-singh',
  'Varun Chakravarthy': 'varun-chakravarthy',
  'CV Varun': 'varun-chakravarthy',
  'Shivam Dube': 'shivam-dube',
  'S Dube': 'shivam-dube',
  'Matheesha Pathirana': 'matheesha-pathirana',
  'M Pathirana': 'matheesha-pathirana',
  'Tilak Varma': 'tilak-varma',
  'NT Tilak Varma': 'tilak-varma',
  'Abhishek Sharma': 'abhishek-sharma',
  'A Sharma': 'abhishek-sharma',
  'Nicholas Pooran': 'nicholas-pooran',
  'N Pooran': 'nicholas-pooran',
  'Riyan Parag': 'riyan-parag',
  'R Parag': 'riyan-parag',
  'Mayank Yadav': 'mayank-yadav',
  'M Yadav': 'mayank-yadav',
  'Harshit Rana': 'harshit-rana',
  'Nitish Kumar Reddy': 'nitish-kumar-reddy',
  'NK Reddy': 'nitish-kumar-reddy',
};

// Build fast lookup by normalized string
const canonicalPlayerMap = new Map<string, string>();
for (const p of PLAYERS) {
  canonicalPlayerMap.set(p.id.toLowerCase(), p.id);
  canonicalPlayerMap.set(p.name.toLowerCase(), p.id);
  const nameParts = p.name.split(' ');
  if (nameParts.length > 1) {
    const initials = nameParts[0][0] + ' ' + nameParts.slice(1).join(' ');
    canonicalPlayerMap.set(initials.toLowerCase(), p.id);
  }
}

/**
 * Reconciles an external player name or Cricsheet ID to the canonical player ID in IPL DYNASTY.
 * Returns null if not found, preserving strict statistical integrity.
 */
export function reconcilePlayerIdentity(externalIdentifier: string): string | null {
  if (!externalIdentifier) return null;
  const trimmed = externalIdentifier.trim();

  // 1. Direct Alias Check
  if (PLAYER_NAME_ALIASES[trimmed]) {
    return PLAYER_NAME_ALIASES[trimmed];
  }

  // 2. Normalized Lookup
  const lower = trimmed.toLowerCase();
  if (canonicalPlayerMap.has(lower)) {
    return canonicalPlayerMap.get(lower)!;
  }

  // 3. Slug match
  const slug = lower.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (canonicalPlayerMap.has(slug)) {
    return canonicalPlayerMap.get(slug)!;
  }

  return null;
}

