// ============================================================
// IPL DYNASTY - Competition Strength Normalization Engine
// Calibrates relative quality across IPL, major franchise leagues,
// international T20 cricket, and domestic tournaments.
// Smoothly fuses competition level and opponent strength to
// eliminate redundant double-penalties or double-counting.
// ============================================================

import { calculateOpponentDifficultyMultiplier } from './opponent-strength';

export type CompetitionTier =
  | 'IPL'                          // Premier global benchmark (highest concentration of talent)
  | 'International-FullMember'     // Top 10 ICC international T20 matches
  | 'Major-Franchise-Tier1'        // SA20, Big Bash League, PSL, The Hundred
  | 'Major-Franchise-Tier2'        // CPL, BPL, Super Smash, MLC
  | 'Domestic-FullMember'          // Syed Mushtaq Ali Trophy, Vitality Blast
  | 'International-AssociateVsFull'// Associate nations playing against Full Members (e.g. World Cup)
  | 'International-Associate'      // Pure Associate vs Associate matches
  | 'Developmental';               // Regional domestic / emerging leagues

export interface CompetitionBenchmark {
  tier: CompetitionTier;
  name: string;
  baselineDifficulty: number;   // 0.50 to 1.30 (1.0 = world standard)
  talentDensityIndex: number;   // 0 to 100
  sampleConfidenceFloor: number;// minimum shrinkage threshold
}

export const COMPETITION_BENCHMARKS: Record<CompetitionTier, CompetitionBenchmark> = {
  'IPL': {
    tier: 'IPL',
    name: 'Indian Premier League',
    baselineDifficulty: 1.18,
    talentDensityIndex: 96,
    sampleConfidenceFloor: 0.85,
  },
  'International-FullMember': {
    tier: 'International-FullMember',
    name: 'T20 International (Full Member vs Full Member)',
    baselineDifficulty: 1.10,
    talentDensityIndex: 90,
    sampleConfidenceFloor: 0.80,
  },
  'Major-Franchise-Tier1': {
    tier: 'Major-Franchise-Tier1',
    name: 'Major Franchise T20 (SA20, BBL, PSL, The Hundred)',
    baselineDifficulty: 1.04,
    talentDensityIndex: 82,
    sampleConfidenceFloor: 0.75,
  },
  'Major-Franchise-Tier2': {
    tier: 'Major-Franchise-Tier2',
    name: 'Secondary Franchise T20 (CPL, BPL, Super Smash, MLC)',
    baselineDifficulty: 0.94,
    talentDensityIndex: 72,
    sampleConfidenceFloor: 0.70,
  },
  'Domestic-FullMember': {
    tier: 'Domestic-FullMember',
    name: 'Domestic Full Member T20 (Syed Mushtaq Ali, Vitality Blast)',
    baselineDifficulty: 0.88,
    talentDensityIndex: 68,
    sampleConfidenceFloor: 0.65,
  },
  'International-AssociateVsFull': {
    tier: 'International-AssociateVsFull',
    name: 'T20 International (Associate vs Full Member)',
    baselineDifficulty: 0.92,
    talentDensityIndex: 70,
    sampleConfidenceFloor: 0.60,
  },
  'International-Associate': {
    tier: 'International-Associate',
    name: 'T20 International (Associate vs Associate)',
    baselineDifficulty: 0.74,
    talentDensityIndex: 52,
    sampleConfidenceFloor: 0.50,
  },
  'Developmental': {
    tier: 'Developmental',
    name: 'Developmental & Regional T20',
    baselineDifficulty: 0.62,
    talentDensityIndex: 40,
    sampleConfidenceFloor: 0.40,
  },
};

/**
 * Derives competition tier from league name, tournament code, or match tags.
 */
export function classifyCompetitionTier(
  tournamentName?: string,
  isInternational?: boolean,
  opponentCategory?: string
): CompetitionTier {
  if (!tournamentName && !isInternational) return 'Domestic-FullMember';

  const t = (tournamentName || '').toLowerCase();

  // 1. IPL check
  if (t.includes('indian premier league') || t.includes('ipl')) {
    return 'IPL';
  }

  // 2. Major Franchise Tier 1
  if (
    t.includes('sa20') ||
    t.includes('big bash') ||
    t.includes('bbl') ||
    t.includes('pakistan super league') ||
    t.includes('psl') ||
    t.includes('the hundred')
  ) {
    return 'Major-Franchise-Tier1';
  }

  // 3. Major Franchise Tier 2
  if (
    t.includes('caribbean premier league') ||
    t.includes('cpl') ||
    t.includes('bangladesh premier league') ||
    t.includes('bpl') ||
    t.includes('super smash') ||
    t.includes('major league cricket') ||
    t.includes('mlc') ||
    t.includes('lanka premier league') ||
    t.includes('lpl')
  ) {
    return 'Major-Franchise-Tier2';
  }

  // 4. Domestic Full Member
  if (
    t.includes('syed mushtaq ali') ||
    t.includes('smat') ||
    t.includes('vitality blast') ||
    t.includes('t20 blast') ||
    t.includes('csa t20')
  ) {
    return 'Domestic-FullMember';
  }

  // 5. International matches
  if (isInternational || t.includes('t20i') || t.includes('world cup')) {
    if (opponentCategory === 'International-FullMember') {
      return 'International-FullMember';
    }
    if (opponentCategory === 'International-Associate') {
      return 'International-Associate';
    }
    return 'International-FullMember';
  }

  return 'Domestic-FullMember';
}

/**
 * Fused Context Difficulty Calculator.
 * Prevents double-counting by combining competition tier baseline
 * and opponent strength into a single unified difficulty coefficient.
 *
 * Formula:
 * D_context = 0.55 * CompDifficulty + 0.45 * OpponentDifficulty
 * Clamped strictly between 0.55 and 1.35.
 */
export function calculateUnifiedContextDifficulty(
  compTier: CompetitionTier,
  opponentRating: number
): {
  contextDifficulty: number;
  compBaseline: number;
  oppDifficulty: number;
  effectiveReliabilityFactor: number;
} {
  const benchmark = COMPETITION_BENCHMARKS[compTier] || COMPETITION_BENCHMARKS['Domestic-FullMember'];
  const oppDifficulty = calculateOpponentDifficultyMultiplier(opponentRating, 100);

  // Unified blend: 55% competition environment + 45% specific opponent strength
  const rawDifficulty = benchmark.baselineDifficulty * 0.55 + oppDifficulty * 0.45;
  const contextDifficulty = Math.min(1.35, Math.max(0.55, Math.round(rawDifficulty * 1000) / 1000));

  return {
    contextDifficulty,
    compBaseline: benchmark.baselineDifficulty,
    oppDifficulty,
    effectiveReliabilityFactor: benchmark.sampleConfidenceFloor,
  };
}

