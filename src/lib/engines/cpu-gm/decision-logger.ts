// ============================================================
// IPL DYNASTY - CPU Decision Logging & Explainability Engine
// Captures structured, explainable decision records for every CPU bid/pass.
// ============================================================

export interface StructuredDecisionLog {
  id: string;
  timestamp: number;
  lotIndex: number;
  playerId: string;
  playerName: string;
  role: string;
  ratingsOverall: number;
  basePriceLakhs: number;
  franchiseId: string;
  franchiseName: string;
  currentPriceLakhs: number;
  minNextBidLakhs: number;
  maxValuationLakhs: number;
  squadNeedScore: number;
  xiImprovement: number;
  depthImprovement: number;
  predictedPerformance: {
    runs: number;
    wickets: number;
    strikeRate: number;
    economy: number;
    impact: number;
  };
  marketValuation: {
    fairValue: number;
    priceFloor: number;
    priceCeiling: number;
    soldProbability?: number;
  };
  alternativesRemaining: number;
  budgetImpact: {
    remainingPurse: number;
    openSlots: number;
    budgetPerSlot: number;
  };
  personalityArchetype: string;
  cpuDifficulty: string;
  decision: 'BID' | 'PASS';
  reason: string;
  monteCarloForecast?: {
    buyRating: number;
    passRating: number;
    shouldBid: boolean;
  };
}

// Bounded ring buffer per auction session (keeps last 500 decisions)
const MAX_LOGS_PER_SESSION = 500;
const sessionDecisionLogs: Map<string, StructuredDecisionLog[]> = new Map();

/** Record a new CPU decision in the structured log. */
export function recordDecisionLog(sessionId: string, entry: Omit<StructuredDecisionLog, 'id' | 'timestamp'>) {
  let logs = sessionDecisionLogs.get(sessionId);
  if (!logs) {
    logs = [];
    sessionDecisionLogs.set(sessionId, logs);
  }

  const completeEntry: StructuredDecisionLog = {
    ...entry,
    id: `log-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
  };

  logs.push(completeEntry);
  if (logs.length > MAX_LOGS_PER_SESSION) {
    logs.shift(); // evict oldest
  }
}

/** Retrieve all logged decisions for an auction session. */
export function getSessionDecisionLogs(sessionId: string): StructuredDecisionLog[] {
  return sessionDecisionLogs.get(sessionId) || [];
}

/** Filter decision logs by franchise ID or player ID. */
export function filterDecisionLogs(
  sessionId: string,
  filters: { franchiseId?: string; playerId?: string; decision?: 'BID' | 'PASS' }
): StructuredDecisionLog[] {
  const logs = getSessionDecisionLogs(sessionId);
  return logs.filter((l) => {
    if (filters.franchiseId && l.franchiseId !== filters.franchiseId) return false;
    if (filters.playerId && l.playerId !== filters.playerId) return false;
    if (filters.decision && l.decision !== filters.decision) return false;
    return true;
  });
}

/** Clear logs for a session. */
export function clearSessionDecisionLogs(sessionId: string) {
  sessionDecisionLogs.delete(sessionId);
}

