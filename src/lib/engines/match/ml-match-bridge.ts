// ============================================================
// IPL DYNASTY - ML Match Intelligence Bridge
// Translates Cricsheet ball-by-ball models, ML projections,
// and Player Intelligence dossiers into dynamic match attributes.
// ============================================================

import type { Player } from '@/lib/types/game';
import { generatePlayerIntelligenceDossier } from '@/lib/intelligence/valuation/player-intelligence';
import type { PlayerIntelligenceDossier } from '@/lib/intelligence/types';

export interface PlayerMatchAttributes {
  playerId: string;
  name: string;
  role: string;
  isSpinner: boolean;
  isPacer: boolean;
  
  // Batting attributes (ML-calibrated)
  expectedStrikeRate: number;      // e.g. 142.5
  boundaryTendency: number;        // 0.08 to 0.28 (prob of 4/6 per ball)
  dotBallTendency: number;         // 0.20 to 0.45
  dismissalResistance: number;     // 0 to 100 (higher = harder to get out)
  powerplayBattingRating: number;  // 0 to 100
  middleBattingRating: number;     // 0 to 100
  deathBattingRating: number;      // 0 to 100
  vsPaceRating: number;            // 0 to 100
  vsSpinRating: number;            // 0 to 100
  powerHittingSkill: number;       // 0 to 100

  // Bowling attributes (ML-calibrated)
  expectedEconomy: number;         // e.g. 7.45
  wicketTakingAbility: number;     // 0 to 100
  dotBallForcingRate: number;      // 0.25 to 0.55
  powerplayBowlingRating: number;  // 0 to 100
  middleBowlingRating: number;     // 0 to 100
  deathBowlingRating: number;      // 0 to 100
  controlConsistency: number;      // 0 to 100 (reduces wides / extras)

  // Confidence & Uncertainty
  confidenceLevel: number;         // 0 to 100%
  uncertaintyStdDev: number;
}

// In-memory cache for match attribute dossiers
const dossierMatchCache: Map<string, PlayerMatchAttributes> = new Map();

/**
 * Extracts ML and Cricsheet calibrated match performance attributes for a player.
 */
export function getPlayerMatchAttributes(player: Player, seasonYear: number = 2026): PlayerMatchAttributes {
  const cacheKey = `${player.id}-${seasonYear}`;
  const cached = dossierMatchCache.get(cacheKey);
  if (cached) return cached;

  const dossier: PlayerIntelligenceDossier = generatePlayerIntelligenceDossier(player, seasonYear);
  const proj = dossier.projection;

  // Determine bowler style
  const isSpinner = player.isSpinner ||
    player.bowlingStyle.includes('Spin') ||
    player.bowlingStyle.includes('Break') ||
    player.bowlingStyle.includes('Orthodox') ||
    player.bowlingStyle.includes('Chinaman');
  const isPacer = !isSpinner && player.bowlingStyle !== 'None';

  // Batting strike rate: blend ML projection with player rating
  const baseSR = proj.projectedBattingStrikeRate > 0 ? proj.projectedBattingStrikeRate : 125 + (player.ratings.batting - 60) * 0.8;
  const expectedStrikeRate = Math.max(90, Math.min(220, baseSR));

  // Boundary tendency: real T20 league average is ~0.13 (13%)
  const pwr = player.ratings.powerHitting || 60;
  const boundaryTendency = Math.max(0.08, Math.min(0.20, 0.115 + (expectedStrikeRate - 130) * 0.0007 + (pwr - 60) * 0.0006));

  // Dot ball tendency: real T20 league average is ~0.37 (37%)
  const consistency = player.ratings.consistency || 65;
  const dotBallTendency = Math.max(0.30, Math.min(0.48, 0.380 - (expectedStrikeRate - 130) * 0.0006 - (consistency - 65) * 0.0005));

  // Dismissal resistance based on batting average and consistency
  const battingOvr = player.ratings.batting;
  const dismissalResistance = Math.max(30, Math.min(99, battingOvr * 0.7 + consistency * 0.3));

  // Phase Ratings
  const ppBat = dossier.phaseStrengths?.powerplay || (player.isOpener ? battingOvr + 8 : battingOvr);
  const midBat = dossier.phaseStrengths?.middle || battingOvr;
  const deathBat = dossier.phaseStrengths?.death || (pwr >= 80 ? pwr + 5 : pwr);

  // Affinities vs Pace and vs Spin
  const vsPaceRating = dossier.bowlingTypeAffinities?.vsPaceRating || battingOvr;
  const vsSpinRating = dossier.bowlingTypeAffinities?.vsSpinRating || battingOvr;

  // Bowling Economy and Wicket Taking
  const baseEcon = proj.projectedEconomyRate > 0 ? proj.projectedEconomyRate : 9.5 - (player.ratings.bowling - 50) * 0.06;
  const expectedEconomy = Math.max(5.5, Math.min(12.0, baseEcon));

  const bowlOvr = player.ratings.bowling;
  const wicketTakingAbility = Math.max(20, Math.min(99, proj.projectedWickets > 0 ? Math.min(99, 45 + proj.projectedWickets * 3.2) : bowlOvr));

  const dotBallForcingRate = Math.max(0.25, Math.min(0.55, 0.50 - (expectedEconomy - 7.0) * 0.04));
  const ppBowl = player.isPowerplayBowler ? bowlOvr + 8 : bowlOvr - 4;
  const midBowl = isSpinner ? bowlOvr + 6 : bowlOvr;
  const deathBowl = player.isDeathBowler ? bowlOvr + 10 : bowlOvr - 8;

  const matchAttrs: PlayerMatchAttributes = {
    playerId: player.id,
    name: player.name,
    role: player.role,
    isSpinner,
    isPacer,
    expectedStrikeRate,
    boundaryTendency,
    dotBallTendency,
    dismissalResistance,
    powerplayBattingRating: Math.round(ppBat),
    middleBattingRating: Math.round(midBat),
    deathBattingRating: Math.round(deathBat),
    vsPaceRating: Math.round(vsPaceRating),
    vsSpinRating: Math.round(vsSpinRating),
    powerHittingSkill: pwr,
    expectedEconomy,
    wicketTakingAbility: Math.round(wicketTakingAbility),
    dotBallForcingRate,
    powerplayBowlingRating: Math.round(ppBowl),
    middleBowlingRating: Math.round(midBowl),
    deathBowlingRating: Math.round(deathBowl),
    controlConsistency: consistency,
    confidenceLevel: dossier.confidenceLevel,
    uncertaintyStdDev: proj.uncertaintyStdDev || 5.0,
  };

  dossierMatchCache.set(cacheKey, matchAttrs);
  return matchAttrs;
}

/** Clear match intelligence cache */
export function clearMatchIntelligenceCache() {
  dossierMatchCache.clear();
}
