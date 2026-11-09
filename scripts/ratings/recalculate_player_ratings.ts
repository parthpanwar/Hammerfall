// ============================================================
// IPL DYNASTY - Recalculate Player Ratings Pipeline
// Evaluates all 1,250 players with the Advanced Opposition-Adjusted
// Player Rating Engine and updates global-player-database.json.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Player } from '../../src/lib/types/game';
import { applyOppositionRatingsToPlayer } from '../../src/lib/intelligence/ratings';

const DB_PATH = path.resolve(__dirname, '../../src/lib/data/global-player-database.json');

console.log('================================================================================');
console.log('RECALCULATING GLOBAL PLAYER RATINGS WITH OPPOSITION-ADJUSTED ENGINE');
console.log('================================================================================\n');

const rawData = fs.readFileSync(DB_PATH, 'utf-8');
const db = JSON.parse(rawData);
const players: Player[] = db.players;

console.log(`Loaded ${players.length} players from ${DB_PATH}`);

// --- Step 1: Pre-Audit ---
const before90Plus = players.filter((p) => p.ratings.overall >= 90);
console.log(`\n[PRE-AUDIT] Total players currently rated 90+: ${before90Plus.length}`);

// Sample of before 90+ players
console.log('\nTop 10 players before adjustment:');
before90Plus.slice(0, 10).forEach((p) => {
  console.log(`  • ${p.name} (${p.country}, ${p.role}): OVR ${p.ratings.overall} | ${p.stats.matches} matches | SR: ${p.stats.strikeRate}`);
});

// --- Step 2: Apply Opposition-Adjusted Engine to all players ---
console.log('\nRecalculating ratings with context difficulty, Bayesian stabilization, and recency...');

let updatedCount = 0;
for (const player of players) {
  applyOppositionRatingsToPlayer(player, 2026);

  // Recalibrate base price brackets for capped vs uncapped
  const isCapped = player.status === 'Capped';
  const ovr = player.ratings.overall;

  if (!isCapped) {
    if (ovr >= 78) player.basePrice = 40;
    else if (ovr >= 72) player.basePrice = 30;
    else player.basePrice = 20;
    // Uncapped base price ceiling of 50L
    player.basePrice = Math.min(50, player.basePrice);
  } else {
    if (ovr >= 88) player.basePrice = 200;
    else if (ovr >= 84) player.basePrice = 150;
    else if (ovr >= 80) player.basePrice = 100;
    else if (ovr >= 75) player.basePrice = 75;
    else player.basePrice = 50;
  }

  // Recalibrate market value based on opposition adjusted overall
  player.estimatedMarketValue = Math.round(player.basePrice * (1.2 + Math.max(0, ovr - 65) * 0.12));
  player.expectedDemand = Math.min(98, Math.max(35, ovr));

  updatedCount++;
}

console.log(`Successfully recalculated ${updatedCount} players.`);

// --- Step 3: Post-Audit ---
const after90Plus = players.filter((p) => p.ratings.overall >= 90);
console.log(`\n[POST-AUDIT] Total players now rated 90+: ${after90Plus.length}`);

// Sort post-audit 90+ by rating descending
after90Plus.sort((a, b) => b.ratings.overall - a.ratings.overall);

console.log('\nElite Superstars (90+ Rated After Opposition & Bayesian Calibration):');
after90Plus.forEach((p) => {
  console.log(
    `  ★ ${p.name.padEnd(24)} | ${p.country.padEnd(12)} | ${p.role.padEnd(12)} | OVR: ${p.ratings.overall} | Raw: ${p.ratings.rawPerformanceRating} | Conf: ${(p.ratings.ratingConfidence! * 100).toFixed(0)}% | Matches: ${p.stats.matches}`
  );
});

// Update database provenance
db.provenance = {
  ...db.provenance,
  ratingEngine: 'Opposition-Adjusted Context & Bayesian Engine v2026.5.0',
  ratingUpdatedAt: new Date().toISOString(),
  elitePlayerCount: after90Plus.length,
};

// Write updated database back to file
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
console.log(`\n✅ Successfully updated database saved to: ${DB_PATH}`);

