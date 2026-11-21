// ============================================================
// IPL DYNASTY - Rookie intake generator
// Every off-season a new class registers for the auction: U19 wonderkids, hot
// prospects, ready-now domestic performers (the Shashank Singh / Ashutosh Sharma
// type) and a handful of overseas youngsters. Seeded per career, so every career
// gets its own class, and the same seed always gets the same one.
// ============================================================

import type { BattingHand, BowlingStyle, DevProfile, Player, PlayerRole } from '@/lib/types/game';
import { assignOfficialBasePrice } from '../registration/registration-engine';
import { hashString, mulberry32 } from './dev-rng';

// Regionally varied: north, west, south, east and north-east India.
const INDIAN_FIRST_NAMES = [
  'Aarav', 'Rohan', 'Dhruv', 'Ayush', 'Vihaan', 'Aditya', 'Harsh', 'Mayank', 'Pranav', 'Siddharth',
  'Kartik', 'Yash', 'Tanmay', 'Sameer', 'Nishant', 'Aryan', 'Samarth', 'Aniket', 'Vansh', 'Devansh',
  'Utkarsh', 'Rishi', 'Chirag', 'Tushar', 'Akshat', 'Shubham', 'Pratham', 'Manav', 'Atharva', 'Omkar',
  'Gurnoor', 'Harpreet', 'Jaskaran', 'Navdeep', 'Simran', 'Ishaan', 'Kunal', 'Lakshay', 'Parth', 'Raghav',
  'Karthik', 'Vignesh', 'Srinath', 'Harish', 'Arjun', 'Balaji', 'Praveen', 'Sai', 'Vishnu', 'Akhil',
  'Sourav', 'Debjit', 'Arnab', 'Subhankar', 'Ritwik', 'Abhishek', 'Bikash', 'Sudip', 'Lalit', 'Mohit',
  'Rehan', 'Faiz', 'Zaid', 'Imran', 'Tejas', 'Nikhil', 'Rakesh', 'Hemant', 'Jayant', 'Ankit',
];

const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Reddy', 'Kumar', 'Iyer', 'Nair', 'Chauhan', 'Pandey',
  'Yadav', 'Rathore', 'Deshmukh', 'Mishra', 'Gupta', 'Saxena', 'Mehta', 'Thakur', 'Bhardwaj', 'Pujari',
  'Gaikwad', 'Joshi', 'Bose', 'Chatterjee', 'Goswami', 'Rawat', 'Sinha', 'Tyagi', 'Pillai', 'Rao',
  'Sandhu', 'Gill', 'Dhillon', 'Brar', 'Malik', 'Kadam', 'Pawar', 'Shinde', 'Jadhav', 'Naik',
  'Menon', 'Krishnan', 'Subramanian', 'Gowda', 'Shetty', 'Hegde', 'Murthy', 'Varma', 'Naidu', 'Raju',
  'Das', 'Banerjee', 'Mukherjee', 'Ghosh', 'Mondal', 'Sahoo', 'Mohanty', 'Behera', 'Borah', 'Baruah',
  'Qureshi', 'Ansari', 'Khan', 'Bhatt', 'Rana', 'Negi', 'Bisht', 'Solanki', 'Parmar', 'Chaudhary',
];

const MIDDLE_INITIALS = 'ABCDGHJKMNPRSTV';

// Overseas youngsters: generic names, not real players.
const OVERSEAS_POOLS: { country: string; firstNames: string[]; lastNames: string[] }[] = [
  { country: 'Australia', firstNames: ['Cooper', 'Lachlan', 'Oliver', 'Jack', 'Callum', 'Bailey', 'Flynn', 'Declan', 'Hamish', 'Riley'], lastNames: ['Davies', 'Connolly', 'Webster', 'Macdonald', 'Bartlett', 'Kelly', 'Morris', 'Fraser', 'Gallagher', 'Thornton'] },
  { country: 'England', firstNames: ['Harry', 'George', 'Freddie', 'Archie', 'Tom', 'Dan', 'Finlay', 'Arthur', 'Ollie', 'Charlie'], lastNames: ['Potts', 'Baker', 'Hollins', 'Ashworth', 'Pemberton', 'Whitfield', 'Kendrick', 'Lister', 'Fairbairn', 'Ridley'] },
  { country: 'South Africa', firstNames: ['Dewald', 'Tristan', 'Corbin', 'Kwena', 'Andile', 'Wihan', 'Gerald', 'Ruan', 'Thabo', 'Jaco'], lastNames: ['Pretorius', 'Swanepoel', 'Coetzee', 'Potgieter', 'van Wyk', 'Nkosi', 'Botha', 'Dlamini', 'Steyn-Moller', 'Venter'] },
  { country: 'West Indies', firstNames: ['Kevlon', 'Teddy', 'Keacy', 'Rivaldo', 'Jordan', 'Ashmead', 'Kirk', 'Dominic', 'Tevin', 'Jaden'], lastNames: ['Forde', 'Carty', 'Nedd', 'Springer', 'Greaves', 'Alleyne', 'Boyce', 'Jeremiah', 'Prescod', 'Lashley'] },
  { country: 'New Zealand', firstNames: ['Finn', 'Ben', 'William', 'Zak', 'Nathan', 'Josh', 'Tim', 'Angus', 'Hugo', 'Ryan'], lastNames: ['Foulkes', 'Fisher', 'Foxcroft', 'Severin', 'McAlister', 'Tane', 'Halliday', 'Corbett', 'Whyte', 'Ngata'] },
  { country: 'Afghanistan', firstNames: ['Ijaz', 'Bilal', 'Wafiullah', 'Zubaid', 'Nasir', 'Faridoun', 'Naveed', 'Shafiq', 'Rahmat', 'Sediq'], lastNames: ['Ahmadzai', 'Tarakhil', 'Akbari', 'Dawoodzai', 'Safi', 'Stanikzai', 'Momand', 'Wardak', 'Popalzai', 'Sultani'] },
  { country: 'Sri Lanka', firstNames: ['Dunith', 'Pasindu', 'Kavindu', 'Sahan', 'Nuwan', 'Ravindu', 'Chamod', 'Lahiru', 'Isuru', 'Tharindu'], lastNames: ['Perera', 'Fernando', 'Jayasuriya', 'Rathnayake', 'Wickramasinghe', 'Bandara', 'Dissanayake', 'Senanayake', 'Gunasekara', 'Herath'] },
];

type Tier = 'Wonderkid' | 'Hot prospect' | 'Ready-now' | 'Standard' | 'Overseas';

interface TierSpec {
  age: [number, number];
  ovr: [number, number];
  pot: [number, number];
}

const TIERS: Record<Tier, TierSpec> = {
  Wonderkid: { age: [16, 19], ovr: [72, 78], pot: [88, 95] },
  'Hot prospect': { age: [18, 22], ovr: [70, 77], pot: [82, 89] },
  'Ready-now': { age: [22, 29], ovr: [74, 80], pot: [76, 84] },
  Standard: { age: [18, 24], ovr: [65, 72], pot: [72, 81] },
  Overseas: { age: [19, 24], ovr: [68, 76], pot: [76, 86] },
};

/** Class make-up. Counts are sampled within these ranges. */
export const ROOKIE_CLASS = {
  indian: 26,
  overseas: 8,
  wonderkids: [1, 2] as [number, number],
  hotProspects: [4, 6] as [number, number],
  readyNow: [7, 9] as [number, number],
};

const PACE: BowlingStyle[] = ['Right-arm Fast', 'Right-arm Medium Fast', 'Left-arm Fast', 'Left-arm Medium Fast', 'Right-arm Fast Medium'];
const SPIN: BowlingStyle[] = ['Right-arm Leg Break', 'Right-arm Off Break', 'Left-arm Orthodox', 'Left-arm Chinaman'];

/**
 * Generates the off-season rookie class (~34: 26 Indian, 8 overseas).
 * @param existingPlayers used to keep names unique across the league.
 */
export function generateRookieDraftClass(seasonYear: number, seed = 0, existingPlayers: Pick<Player, 'name'>[] = []): Player[] {
  const rng = mulberry32((hashString(`rookies:${seasonYear}`) ^ Math.imul(seed | 0, 2654435761)) >>> 0);
  const int = ([lo, hi]: [number, number]) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const taken = new Set(existingPlayers.map((p) => p.name.toLowerCase()));

  const uniqueName = (make: () => string): string => {
    for (let tries = 0; tries < 12; tries++) {
      const n = make();
      if (!taken.has(n.toLowerCase())) return (taken.add(n.toLowerCase()), n);
    }
    // Still clashing: add a middle initial.
    for (;;) {
      const [first, ...rest] = make().split(' ');
      const n = `${first} ${pick(MIDDLE_INITIALS.split(''))}. ${rest.join(' ')}`;
      if (!taken.has(n.toLowerCase())) return (taken.add(n.toLowerCase()), n);
    }
  };

  const tiers: Tier[] = [];
  const wk = int(ROOKIE_CLASS.wonderkids);
  const hot = int(ROOKIE_CLASS.hotProspects);
  const ready = int(ROOKIE_CLASS.readyNow);
  for (let i = 0; i < wk; i++) tiers.push('Wonderkid');
  for (let i = 0; i < hot; i++) tiers.push('Hot prospect');
  for (let i = 0; i < ready; i++) tiers.push('Ready-now');
  while (tiers.length < ROOKIE_CLASS.indian) tiers.push('Standard');
  for (let i = 0; i < ROOKIE_CLASS.overseas; i++) tiers.push('Overseas');

  return tiers.map((tier, i) => {
    const overseas = tier === 'Overseas';
    const pool = overseas ? pick(OVERSEAS_POOLS) : null;
    const name = uniqueName(() =>
      pool ? `${pick(pool.firstNames)} ${pick(pool.lastNames)}` : `${pick(INDIAN_FIRST_NAMES)} ${pick(INDIAN_LAST_NAMES)}`
    );
    const spec = TIERS[tier];
    const age = int(spec.age);
    const overall = int(spec.ovr);
    const potential = Math.max(overall + (age <= 19 ? 6 : age <= 21 ? 5 : age <= 23 ? 4 : 2), int(spec.pot));

    // Role: Batter 30% / Bowler 35% / All-Rounder 22% / Wicketkeeper 13%.
    const u = rng();
    const role: PlayerRole = u < 0.3 ? 'Batter' : u < 0.65 ? 'Bowler' : u < 0.87 ? 'All-Rounder' : 'Wicketkeeper';
    const battingHand: BattingHand = rng() < 0.3 ? 'Left' : 'Right';
    const bowls = role === 'Bowler' || role === 'All-Rounder';
    const spinner = bowls && rng() < 0.4;
    const bowlingStyle: BowlingStyle = bowls ? (spinner ? pick(SPIN) : pick(PACE)) : 'None';
    const pacer = bowls && !spinner;
    const isOpener = (role === 'Batter' && rng() < 0.45) || (role === 'Wicketkeeper' && rng() < 0.35);
    const preferredBattingPosition = isOpener
      ? 1 + Math.floor(rng() * 2)
      : role === 'Batter'
      ? 3 + Math.floor(rng() * 3)
      : role === 'Wicketkeeper'
      ? 4 + Math.floor(rng() * 3)
      : role === 'All-Rounder'
      ? 5 + Math.floor(rng() * 3)
      : 8 + Math.floor(rng() * 4);
    const isDeathBowler = pacer && rng() < 0.45;
    const isPowerplayBowler = pacer && !isDeathBowler ? rng() < 0.7 : pacer && rng() < 0.25;

    // Components consistent with overall for the role.
    const batPrimary = role === 'All-Rounder' && rng() < 0.5;
    const batting =
      role === 'Batter' || role === 'Wicketkeeper'
        ? overall + int([0, 2])
        : role === 'All-Rounder'
        ? overall - (batPrimary ? int([0, 3]) : int([4, 9]))
        : int([15, 42]);
    const bowling =
      role === 'Bowler'
        ? overall + int([0, 2])
        : role === 'All-Rounder'
        ? overall - (batPrimary ? int([4, 9]) : int([0, 3]))
        : int([10, 30]);
    const powerHitting = role === 'Bowler' ? int([30, 55]) : Math.min(95, overall - 8 + int([0, 18]));

    const devProfile: DevProfile =
      tier === 'Ready-now'
        ? rng() < 0.6 ? 'LateBloomer' : 'Standard'
        : tier === 'Wonderkid'
        ? rng() < 0.5 ? 'EarlyBloomer' : 'Standard'
        : (['EarlyBloomer', 'Standard', 'Standard', 'Standard', 'LateBloomer', 'Plateau'] as DevProfile[])[Math.floor(rng() * 6)];

    const note = scoutingLine(tier, role, seasonYear - 1, age, rng, int);

    const player: Player = {
      id: `gen_${seasonYear}_${i + 1}`,
      name,
      age,
      nationality: overseas ? 'Overseas' : 'Indian',
      country: pool?.country ?? 'India',
      status: 'Uncapped',
      currentFranchiseId: null,
      previousFranchises: [],
      role,
      battingHand,
      bowlingStyle,
      preferredBattingPosition,
      isOpener,
      isDeathBowler,
      isPowerplayBowler,
      isSpinner: spinner,
      stats: {
        matches: 0, innings: 0, runs: 0, ballsFaced: 0, battingAverage: 0, strikeRate: 0, fours: 0, sixes: 0,
        fifties: 0, hundreds: 0, highScore: 0, wickets: 0, oversBowled: 0, runsConceded: 0, bowlingAverage: 0,
        economyRate: 0, bestBowling: '0/0', catches: 0, playerOfMatch: 0,
      },
      ratings: {
        batting: Math.min(99, batting),
        bowling: Math.min(99, bowling),
        fielding: role === 'Wicketkeeper' ? int([74, 86]) : int([64, 82]),
        powerHitting,
        consistency: int([58, 74]),
        t20Adaptability: int([66, 80]),
        potential: Math.min(97, potential),
        overall,
      },
      devProfile,
      development: { season: seasonYear, trend: 'Steady', overallDelta: 0, potentialDelta: 0, note, matches: 0, perf: null },
      recentForm: 75,
      fitnessLevel: int([84, 95]),
      injuryRisk: int([8, 20]),
      basePrice: 20,
      currentContractValue: 0,
      estimatedMarketValue: 30,
      expectedDemand: tier === 'Wonderkid' ? 85 : tier === 'Hot prospect' || tier === 'Ready-now' ? 65 : 45,
      retentionCost: 400,
      isAvailableForAuction: true,
      isRetained: false,
      isSold: false,
      soldPrice: 0,
    };
    player.basePrice = assignOfficialBasePrice(player);
    if (tier === 'Wonderkid') player.basePrice = Math.max(30, player.basePrice);
    player.estimatedMarketValue = Math.round(player.basePrice * 1.5);
    return player;
  });
}

/** Domestic numbers for the scouting report. */
function scoutingLine(
  tier: Tier,
  role: PlayerRole,
  year: number,
  age: number,
  rng: () => number,
  int: (r: [number, number]) => number
): string {
  const bowler = role === 'Bowler' || (role === 'All-Rounder' && rng() < 0.5);
  if (tier === 'Wonderkid') {
    return bowler
      ? `U19 World Cup: ${int([11, 17])} wkts @ ${(5.2 + rng() * 1.4).toFixed(1)}; the scouts' pick of the tournament`
      : `U19 World Cup: ${int([280, 420])} runs at SR ${int([138, 165])}; the scouts' pick of the tournament`;
  }
  if (tier === 'Hot prospect') {
    return bowler
      ? `Cooch Behar & SMAT ${year}: ${int([18, 26])} wkts @ ${(6.3 + rng() * 1.2).toFixed(1)}`
      : `Cooch Behar & SMAT ${year}: ${int([420, 640])} runs at SR ${int([140, 162])}`;
  }
  if (tier === 'Ready-now') {
    return bowler
      ? `SMAT ${year}: ${int([17, 24])} wkts @ ${(6.4 + rng() * 1.0).toFixed(1)} at ${age}; IPL-ready now`
      : `SMAT ${year}: ${int([380, 520])} runs at SR ${int([160, 185])} at ${age}; IPL-ready now`;
  }
  if (tier === 'Overseas') {
    return bowler
      ? `Domestic T20s ${year}: ${int([12, 20])} wkts @ ${(7.0 + rng() * 1.2).toFixed(1)}`
      : `Domestic T20s ${year}: ${int([300, 460])} runs at SR ${int([135, 155])}`;
  }
  return bowler
    ? `Ranji & SMAT ${year}: ${int([10, 19])} wkts`
    : `Ranji & SMAT ${year}: ${int([300, 520])} runs`;
}
