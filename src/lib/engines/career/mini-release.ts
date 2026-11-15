// ============================================================
// IPL DYNASTY - CPU releases before a mini auction
// Used when a campaign STARTS in a mini year (Real IPL cycle), where no season
// rollover has run the CPU's post-season releases yet. Mirrors real behaviour:
// teams trim a full 25-man squad to ~20, cut expensive under-performers, and
// keep enough purse to compete in a small auction.
// ============================================================

import type { Franchise, Player } from '@/lib/types/game';
import { isOverpaidContract } from '../auction/market-value';

export interface CpuReleasePlan {
  release: Player[];
  keptSalary: number;
}

const TARGET_SQUAD = 20;
const MIN_HEADROOM = 1000; // keep at least ₹10 Cr to spend
const MIN_SQUAD = 16;

export function planCpuMiniReleases(f: Franchise, salaryOf: (p: Player) => number, purse: number, season = 2027): CpuReleasePlan {
  // Value to the franchise: rating, youth runway, minus late-career decline.
  const worth = (p: Player) => p.ratings.overall + Math.max(0, 25 - p.age) * 0.6 - (p.age >= 35 ? 4 : 0);
  // Price per point of worth above replacement (₹20 L uncapped ≈ 60 OVR).
  const overpay = (p: Player) => salaryOf(p) / Math.max(1, worth(p) - 58);

  const release = new Set<string>();
  const kept = () => f.players.filter((p) => !release.has(p.id));
  const keptSalary = () => kept().reduce((t, p) => t + salaryOf(p), 0);

  // 1. Expensive contracts the player no longer justifies — veterans only; a young
  //    big-money signing is a bet the franchise just made and keeps.
  for (const p of f.players) {
    if (salaryOf(p) >= 600 && worth(p) < 74 && p.age >= 24) release.add(p.id);
  }
  // 1b. Contracts the market no longer supports (up to two, never the team's top three).
  const top3 = new Set([...f.players].sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, 3).map((p) => p.id));
  const overpaid = f.players
    .filter((p) => !top3.has(p.id) && !release.has(p.id) && isOverpaidContract(p, salaryOf(p), season))
    .sort((a, b) => salaryOf(b) - salaryOf(a))
    .slice(0, 2);
  overpaid.forEach((p) => release.add(p.id));
  // 2. Trim the weakest depth down to the target squad size.
  const byWorth = [...kept()].sort((a, b) => worth(a) - worth(b));
  for (const p of byWorth) {
    if (kept().length <= TARGET_SQUAD) break;
    release.add(p.id);
  }
  // 3. Make room in the purse by cutting the worst value-for-money contracts.
  const byOverpay = [...kept()].sort((a, b) => overpay(b) - overpay(a));
  for (const p of byOverpay) {
    if (purse - keptSalary() >= MIN_HEADROOM || kept().length <= MIN_SQUAD) break;
    if (worth(p) >= 86 || (p.age <= 23 && salaryOf(p) >= 600)) continue; // keep stars and fresh big-money youngsters
    release.add(p.id);
  }
  // Squads must never keep more than 8 overseas players.
  const overseas = kept().filter((p) => p.nationality === 'Overseas').sort((a, b) => worth(a) - worth(b));
  while (overseas.length > 8) release.add(overseas.shift()!.id);

  return { release: f.players.filter((p) => release.has(p.id)), keptSalary: keptSalary() };
}
