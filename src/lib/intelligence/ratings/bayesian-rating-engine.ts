// ============================================================
// IPL DYNASTY - Bayesian Rating Stabilization Engine
// Prevents small-sample rating distortions via Empirical Bayes
// shrinkage and sample-size reliability weighting.
// Role-specific priors and continuous confidence scaling.
// ============================================================

import type { PlayerRole } from '../../types/game';

export interface BayesianRatingPrior {
  role: PlayerRole;
  mean: number;       // Prior expected rating (e.g. 68 for full member capped, 60 for uncapped)
  variance: number;   // Prior variance
  pseudoMatches: number; // K parameter (sample weight of the prior)
}

/**
 * Calibrated role-specific priors for T20 cricket.
 * Established full member players shrink toward higher baselines than untested domestic uncapped.
 */
export const ROLE_PRIORS: Record<PlayerRole, { capped: BayesianRatingPrior; uncapped: BayesianRatingPrior; associate: BayesianRatingPrior }> = {
  'Batter': {
    capped: { role: 'Batter', mean: 72, variance: 36, pseudoMatches: 22 },
    uncapped: { role: 'Batter', mean: 62, variance: 25, pseudoMatches: 26 },
    associate: { role: 'Batter', mean: 58, variance: 25, pseudoMatches: 28 },
  },
  'Bowler': {
    capped: { role: 'Bowler', mean: 72, variance: 36, pseudoMatches: 24 },
    uncapped: { role: 'Bowler', mean: 62, variance: 25, pseudoMatches: 28 },
    associate: { role: 'Bowler', mean: 58, variance: 25, pseudoMatches: 30 },
  },
  'All-Rounder': {
    capped: { role: 'All-Rounder', mean: 71, variance: 30, pseudoMatches: 22 },
    uncapped: { role: 'All-Rounder', mean: 62, variance: 25, pseudoMatches: 26 },
    associate: { role: 'All-Rounder', mean: 58, variance: 25, pseudoMatches: 28 },
  },
  'Wicketkeeper': {
    capped: { role: 'Wicketkeeper', mean: 71, variance: 32, pseudoMatches: 20 },
    uncapped: { role: 'Wicketkeeper', mean: 62, variance: 25, pseudoMatches: 24 },
    associate: { role: 'Wicketkeeper', mean: 58, variance: 25, pseudoMatches: 26 },
  },
};

export interface BayesianStabilizationResult {
  observedRating: number;
  priorRating: number;
  reliability: number;        // 0.0 to 1.0 (rating confidence)
  effectiveSampleSize: number;// N_eff
  stabilizedRating: number;   // Bayesian shrunken rating
  uncertaintyBand: number;    // +/- standard deviation of rating
}

/**
 * Applies empirical Bayes shrinkage to regularize observed performance.
 *
 * Formula:
 * Reliability = N_eff / (N_eff + K_pseudo)
 * StabilizedRating = Reliability * ObservedRating + (1 - Reliability) * PriorRating
 */
export function applyBayesianStabilization(
  observedRating: number,
  effectiveSampleSize: number,
  role: PlayerRole,
  isCapped: boolean = true,
  isAssociate: boolean = false
): BayesianStabilizationResult {
  const priors = ROLE_PRIORS[role] || ROLE_PRIORS['Batter'];
  const prior = isAssociate
    ? priors.associate
    : isCapped
      ? priors.capped
      : priors.uncapped;

  const N = Math.max(0, effectiveSampleSize);
  const K = prior.pseudoMatches;

  // Reliability R ranges from 0.0 (zero data) to ~0.95+ for 100+ matches
  const reliability = Math.min(0.98, Math.max(0.05, N / (N + K)));

  // Bayesian shrinkage
  const stabilizedRating = Math.round(reliability * observedRating + (1.0 - reliability) * prior.mean);

  // Posterior uncertainty: decreases as N increases
  const uncertaintyBand = Math.round(Math.sqrt(prior.variance / (1.0 + N / K)) * 10) / 10;

  return {
    observedRating,
    priorRating: prior.mean,
    reliability: Math.round(reliability * 1000) / 1000,
    effectiveSampleSize: Math.round(N * 10) / 10,
    stabilizedRating,
    uncertaintyBand,
  };
}

