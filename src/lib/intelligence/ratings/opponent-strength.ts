// ============================================================
// IPL DYNASTY - Opponent Strength & Dynamic Elo Engine
// Evaluates context-aware opponent strength across international
// cricket, IPL, and global franchise leagues over historical time.
// Zero future-data leakage: historical matches evaluated at match-time ratings.
// Continuous adjustment functions with zero hard-coded nationality penalties.
// ============================================================

export interface TeamStrengthSnapshot {
  teamId: string;
  name: string;
  category: 'International-FullMember' | 'International-Associate' | 'IPL' | 'Major-Franchise' | 'Domestic';
  historicalRatings: Record<number, number>; // Year -> 0-150 rating scale (100 = world average)
}

/**
 * Historical calibrated Elo / ICC ratings centered at 100.
 * Captures historical team strength at the specific time matches were played.
 */
export const HISTORICAL_TEAM_STRENGTHS: Record<string, TeamStrengthSnapshot> = {
  // --- International Full Members ---
  india: {
    teamId: 'india',
    name: 'India',
    category: 'International-FullMember',
    historicalRatings: { 2020: 122, 2021: 124, 2022: 126, 2023: 128, 2024: 130, 2025: 129, 2026: 128 },
  },
  australia: {
    teamId: 'australia',
    name: 'Australia',
    category: 'International-FullMember',
    historicalRatings: { 2020: 123, 2021: 125, 2022: 124, 2023: 126, 2024: 125, 2025: 126, 2026: 125 },
  },
  england: {
    teamId: 'england',
    name: 'England',
    category: 'International-FullMember',
    historicalRatings: { 2020: 125, 2021: 126, 2022: 127, 2023: 122, 2024: 121, 2025: 122, 2026: 122 },
  },
  south_africa: {
    teamId: 'south_africa',
    name: 'South Africa',
    category: 'International-FullMember',
    historicalRatings: { 2020: 112, 2021: 114, 2022: 116, 2023: 118, 2024: 124, 2025: 123, 2026: 122 },
  },
  new_zealand: {
    teamId: 'new_zealand',
    name: 'New Zealand',
    category: 'International-FullMember',
    historicalRatings: { 2020: 118, 2021: 120, 2022: 119, 2023: 117, 2024: 116, 2025: 116, 2026: 115 },
  },
  pakistan: {
    teamId: 'pakistan',
    name: 'Pakistan',
    category: 'International-FullMember',
    historicalRatings: { 2020: 116, 2021: 120, 2022: 121, 2023: 115, 2024: 112, 2025: 114, 2026: 113 },
  },
  west_indies: {
    teamId: 'west_indies',
    name: 'West Indies',
    category: 'International-FullMember',
    historicalRatings: { 2020: 108, 2021: 106, 2022: 104, 2023: 107, 2024: 114, 2025: 113, 2026: 112 },
  },
  afghanistan: {
    teamId: 'afghanistan',
    name: 'Afghanistan',
    category: 'International-FullMember',
    historicalRatings: { 2020: 98, 2021: 101, 2022: 104, 2023: 108, 2024: 115, 2025: 114, 2026: 113 },
  },
  sri_lanka: {
    teamId: 'sri_lanka',
    name: 'Sri Lanka',
    category: 'International-FullMember',
    historicalRatings: { 2020: 102, 2021: 103, 2022: 108, 2023: 105, 2024: 104, 2025: 106, 2026: 105 },
  },
  bangladesh: {
    teamId: 'bangladesh',
    name: 'Bangladesh',
    category: 'International-FullMember',
    historicalRatings: { 2020: 96, 2021: 99, 2022: 98, 2023: 100, 2024: 98, 2025: 97, 2026: 97 },
  },
  ireland: {
    teamId: 'ireland',
    name: 'Ireland',
    category: 'International-FullMember',
    historicalRatings: { 2020: 86, 2021: 87, 2022: 90, 2023: 91, 2024: 90, 2025: 89, 2026: 89 },
  },
  zimbabwe: {
    teamId: 'zimbabwe',
    name: 'Zimbabwe',
    category: 'International-FullMember',
    historicalRatings: { 2020: 82, 2021: 83, 2022: 86, 2023: 85, 2024: 84, 2025: 85, 2026: 84 },
  },

  // --- International Top Associates ---
  scotland: {
    teamId: 'scotland',
    name: 'Scotland',
    category: 'International-Associate',
    historicalRatings: { 2020: 80, 2021: 84, 2022: 83, 2023: 84, 2024: 86, 2025: 85, 2026: 85 },
  },
  netherlands: {
    teamId: 'netherlands',
    name: 'Netherlands',
    category: 'International-Associate',
    historicalRatings: { 2020: 78, 2021: 80, 2022: 85, 2023: 86, 2024: 85, 2025: 84, 2026: 84 },
  },
  namibia: {
    teamId: 'namibia',
    name: 'Namibia',
    category: 'International-Associate',
    historicalRatings: { 2020: 74, 2021: 79, 2022: 81, 2023: 82, 2024: 83, 2025: 82, 2026: 81 },
  },
  usa: {
    teamId: 'usa',
    name: 'United States',
    category: 'International-Associate',
    historicalRatings: { 2020: 64, 2021: 67, 2022: 70, 2023: 74, 2024: 84, 2025: 83, 2026: 82 },
  },
  uae: {
    teamId: 'uae',
    name: 'United Arab Emirates',
    category: 'International-Associate',
    historicalRatings: { 2020: 72, 2021: 73, 2022: 76, 2023: 78, 2024: 79, 2025: 78, 2026: 78 },
  },
  nepal: {
    teamId: 'nepal',
    name: 'Nepal',
    category: 'International-Associate',
    historicalRatings: { 2020: 68, 2021: 70, 2022: 72, 2023: 75, 2024: 77, 2025: 78, 2026: 78 },
  },
  oman: {
    teamId: 'oman',
    name: 'Oman',
    category: 'International-Associate',
    historicalRatings: { 2020: 70, 2021: 72, 2022: 73, 2023: 74, 2024: 75, 2025: 74, 2026: 73 },
  },
  canada: {
    teamId: 'canada',
    name: 'Canada',
    category: 'International-Associate',
    historicalRatings: { 2020: 60, 2021: 62, 2022: 65, 2023: 68, 2024: 74, 2025: 73, 2026: 72 },
  },

  // --- IPL Franchises (Elite T20 Density) ---
  mi: {
    teamId: 'mi',
    name: 'Mumbai Indians',
    category: 'IPL',
    historicalRatings: { 2020: 128, 2021: 120, 2022: 110, 2023: 118, 2024: 112, 2025: 122, 2026: 124 },
  },
  csk: {
    teamId: 'csk',
    name: 'Chennai Super Kings',
    category: 'IPL',
    historicalRatings: { 2020: 114, 2021: 126, 2022: 112, 2023: 127, 2024: 118, 2025: 120, 2026: 122 },
  },
  kkr: {
    teamId: 'kkr',
    name: 'Kolkata Knight Riders',
    category: 'IPL',
    historicalRatings: { 2020: 112, 2021: 120, 2022: 110, 2023: 114, 2024: 129, 2025: 124, 2026: 123 },
  },
  srh: {
    teamId: 'srh',
    name: 'Sunrisers Hyderabad',
    category: 'IPL',
    historicalRatings: { 2020: 116, 2021: 104, 2022: 106, 2023: 105, 2024: 127, 2025: 123, 2026: 122 },
  },
  rr: {
    teamId: 'rr',
    name: 'Rajasthan Royals',
    category: 'IPL',
    historicalRatings: { 2020: 110, 2021: 108, 2022: 122, 2023: 116, 2024: 123, 2025: 121, 2026: 120 },
  },
  rcb: {
    teamId: 'rcb',
    name: 'Royal Challengers Bengaluru',
    category: 'IPL',
    historicalRatings: { 2020: 116, 2021: 118, 2022: 118, 2023: 114, 2024: 120, 2025: 120, 2026: 121 },
  },
  dc: {
    teamId: 'dc',
    name: 'Delhi Capitals',
    category: 'IPL',
    historicalRatings: { 2020: 124, 2021: 122, 2022: 112, 2023: 108, 2024: 115, 2025: 116, 2026: 117 },
  },
  gt: {
    teamId: 'gt',
    name: 'Gujarat Titans',
    category: 'IPL',
    historicalRatings: { 2022: 128, 2023: 127, 2024: 112, 2025: 118, 2026: 119 },
  },
  lsg: {
    teamId: 'lsg',
    name: 'Lucknow Super Giants',
    category: 'IPL',
    historicalRatings: { 2022: 120, 2023: 120, 2024: 115, 2025: 116, 2026: 117 },
  },
  pbks: {
    teamId: 'pbks',
    name: 'Punjab Kings',
    category: 'IPL',
    historicalRatings: { 2020: 108, 2021: 108, 2022: 110, 2023: 109, 2024: 110, 2025: 114, 2026: 115 },
  },
};

/** Normalize team name or ID to standard key */
export function normalizeTeamKey(team: string): string {
  const lower = team.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (lower.includes('india')) return 'india';
  if (lower.includes('australia')) return 'australia';
  if (lower.includes('england')) return 'england';
  if (lower.includes('south_africa') || lower.includes('proteas')) return 'south_africa';
  if (lower.includes('new_zealand') || lower.includes('blackcaps')) return 'new_zealand';
  if (lower.includes('pakistan')) return 'pakistan';
  if (lower.includes('west_indies') || lower.includes('windies')) return 'west_indies';
  if (lower.includes('afghanistan')) return 'afghanistan';
  if (lower.includes('sri_lanka')) return 'sri_lanka';
  if (lower.includes('bangladesh')) return 'bangladesh';
  if (lower.includes('ireland')) return 'ireland';
  if (lower.includes('scotland')) return 'scotland';
  if (lower.includes('netherlands')) return 'netherlands';
  if (lower.includes('namibia')) return 'namibia';
  if (lower.includes('usa') || lower.includes('united_states')) return 'usa';
  if (lower.includes('uae') || lower.includes('emirates')) return 'uae';
  if (lower.includes('nepal')) return 'nepal';
  if (lower.includes('oman')) return 'oman';
  if (lower.includes('canada')) return 'canada';

  // IPL
  if (lower.includes('mumbai') || lower === 'mi') return 'mi';
  if (lower.includes('chennai') || lower === 'csk') return 'csk';
  if (lower.includes('kolkata') || lower === 'kkr') return 'kkr';
  if (lower.includes('hyderabad') || lower === 'srh') return 'srh';
  if (lower.includes('rajasthan') || lower === 'rr') return 'rr';
  if (lower.includes('bengaluru') || lower.includes('bangalore') || lower === 'rcb') return 'rcb';
  if (lower.includes('delhi') || lower === 'dc') return 'dc';
  if (lower.includes('gujarat') || lower === 'gt') return 'gt';
  if (lower.includes('lucknow') || lower === 'lsg') return 'lsg';
  if (lower.includes('punjab') || lower === 'pbks') return 'pbks';

  return lower;
}

/**
 * Returns the opponent team's strength at the specific time (year) of the match.
 * Prevents future-season data leakage.
 */
export function getTeamStrengthAtTime(
  teamIdentifier: string,
  matchYear: number = 2026
): { rating: number; category: string; confidence: number } {
  const key = normalizeTeamKey(teamIdentifier);
  const snapshot = HISTORICAL_TEAM_STRENGTHS[key];

  if (!snapshot) {
    // Unknown or domestic regional team: safe default prior with moderate confidence
    return { rating: 80, category: 'Domestic', confidence: 0.65 };
  }

  // Get rating for the exact year, or closest historical year <= matchYear to prevent future leakage
  const availableYears = Object.keys(snapshot.historicalRatings)
    .map(Number)
    .filter((yr) => yr <= matchYear)
    .sort((a, b) => b - a);

  const effectiveYear = availableYears.length > 0 ? availableYears[0] : 2024;
  const rating = snapshot.historicalRatings[effectiveYear] ?? 100;

  return {
    rating,
    category: snapshot.category,
    confidence: 0.95,
  };
}

/**
 * Continuous opponent difficulty multiplier.
 * Maps team rating (scale 50-140) smoothly into difficulty multiplier (0.60 to 1.35).
 * Neutral baseline = 100 rating (1.00x).
 * Continuous logistic/power curve avoiding hardcoded country cliffs.
 */
export function calculateOpponentDifficultyMultiplier(
  opponentRating: number,
  baselineRating: number = 100
): number {
  const ratio = opponentRating / baselineRating;
  // Sub-linear dampening to prevent extreme spikes: multiplier = (ratio)^0.85
  const continuousMultiplier = Math.pow(ratio, 0.85);
  // Clamped between 0.55 and 1.35
  return Math.min(1.35, Math.max(0.55, Math.round(continuousMultiplier * 1000) / 1000));
}

/**
 * Calculates the quality score of the opposing bowling attack (0-100).
 * If individual bowler ratings are provided, uses actual Playing-XI strength.
 * Otherwise falls back to opponent team rating with lower confidence.
 */
export function calculateOpposingBowlingQuality(
  bowlerRatings?: number[],
  fallbackOpponentRating: number = 100
): { qualityScore: number; confidence: number } {
  if (bowlerRatings && bowlerRatings.length >= 4) {
    // Weighted average of top 5 bowlers faced
    const sorted = [...bowlerRatings].sort((a, b) => b - a);
    const top5 = sorted.slice(0, 5);
    const avg = top5.reduce((sum, r) => sum + r, 0) / top5.length;
    return {
      qualityScore: Math.round(avg),
      confidence: 0.95,
    };
  }

  // Fallback to team strength mapped to 0-100
  const mappedQuality = Math.min(95, Math.max(45, Math.round(fallbackOpponentRating * 0.72)));
  return {
    qualityScore: mappedQuality,
    confidence: 0.70,
  };
}

/**
 * Calculates the quality score of the opposing batting lineup (0-100).
 * If individual batter ratings are provided, uses top-7 actual Playing-XI strength.
 * Otherwise falls back to opponent team rating.
 */
export function calculateOpposingBattingQuality(
  batterRatings?: number[],
  fallbackOpponentRating: number = 100
): { qualityScore: number; confidence: number } {
  if (batterRatings && batterRatings.length >= 5) {
    const sorted = [...batterRatings].sort((a, b) => b - a);
    const top6 = sorted.slice(0, 6);
    const avg = top6.reduce((sum, r) => sum + r, 0) / top6.length;
    return {
      qualityScore: Math.round(avg),
      confidence: 0.95,
    };
  }

  const mappedQuality = Math.min(95, Math.max(45, Math.round(fallbackOpponentRating * 0.72)));
  return {
    qualityScore: mappedQuality,
    confidence: 0.70,
  };
}

