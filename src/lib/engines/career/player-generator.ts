// ============================================================
// IPL DYNASTY - Future Player Pool & Rookie Draft Generator
// Generates realistic, balanced domestic and international rookies
// to replenish rosters over 10+ seasons without rating inflation.
// ============================================================

import type { Player, PlayerRole, BattingHand, BowlingStyle, PlayerNationality } from '@/lib/types/game';

// First names pool for Indian rookies
const INDIAN_FIRST_NAMES = [
  'Aarav', 'Rohan', 'Dhruv', 'Ayush', 'Vihaan', 'Aditya', 'Harsh', 'Mayank', 'Pranav', 'Siddharth',
  'Kartik', 'Yash', 'Tanmay', 'Sameer', 'Nishant', 'Aryan', 'Samarth', 'Aniket', 'Vansh', 'Devansh',
  'Utkarsh', 'Rishi', 'Chirag', 'Tushar', 'Akshat', 'Shubham', 'Pratham', 'Manav', 'Atharva', 'Omkar',
];

// Last names pool for Indian rookies
const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Reddy', 'Kumar', 'Iyer', 'Nair', 'Chauhan', 'Pandey',
  'Yadav', 'Rathore', 'Deshmukh', 'Mishra', 'Gupta', 'Saxena', 'Mehta', 'Thakur', 'Bhardwaj', 'Pujari',
  'Gaikwad', 'Joshi', 'Bose', 'Chatterjee', 'Goswami', 'Rawat', 'Sinha', 'Tyagi', 'Pillai', 'Rao',
];

// Overseas rookie profiles by country
const OVERSEAS_POOLS: { country: string; firstNames: string[]; lastNames: string[] }[] = [
  {
    country: 'Australia',
    firstNames: ['Cooper', 'Lachlan', 'Oliver', 'Jack', 'Callum', 'Bailey', 'Flynn', 'Declan', 'Beau', 'Zac'],
    lastNames: ['Davies', 'Connolly', 'O’Neill', 'Edwards', 'Webster', 'Macdonald', 'Bartlett', 'Kelly', 'Sutherland', 'Morris'],
  },
  {
    country: 'England',
    firstNames: ['Harry', 'George', 'Freddie', 'Archie', 'Tom', 'Dan', 'Sam', 'Finlay', 'Arthur', 'Will'],
    lastNames: ['Hain', 'Potts', 'Smith', 'Mousley', 'Rehan', 'Baker', 'Luxton', 'Carse', 'Bethell', 'Hull'],
  },
  {
    country: 'South Africa',
    firstNames: ['Dewald', 'Tristan', 'Corbin', 'Kwena', 'Matthew', 'Andile', 'Wihan', 'Lhuan-dre', 'Gerald', 'Marco'],
    lastNames: ['Bosch', 'Simelane', 'Breetzke', 'Maphaka', 'Pretorius', 'de Swardt', 'Swanepoel', 'Coetzee', 'Linde', 'Potgieter'],
  },
  {
    country: 'West Indies',
    firstNames: ['Alick', 'Kevlon', 'Matthew', 'Teddy', 'Keacy', 'Rivaldo', 'Jordan', 'Ashmead', 'Kirk', 'Shamar'],
    lastNames: ['Athanaze', 'Anderson', 'Forde', 'Bishop', 'Carty', 'Clarke', 'Johnson', 'Nedd', 'McKenzie', 'Springer'],
  },
  {
    country: 'New Zealand',
    firstNames: ['Rachin', 'Finn', 'Ben', 'Adithya', 'William', 'Zak', 'Kristian', 'Nathan', 'Josh', 'Tim'],
    lastNames: ['Sears', 'Ashok', 'O’Rourke', 'Foulkes', 'Clarke', 'Fisher', 'Foxcroft', 'Robinson', 'Severin', 'Smith'],
  },
  {
    country: 'Afghanistan',
    firstNames: ['Noor', 'Allah', 'Ijaz', 'Nangeyalia', 'Bilal', 'Wafiullah', 'Zubaid', 'Nasir', 'Faridoun', 'Naveed'],
    lastNames: ['Ghaznafar', 'Ahmad', 'Kharote', 'Sami', 'Tarakhil', 'Akbari', 'Khan', 'Dawoodzai', 'Zadran', 'Mangal'],
  },
];

/**
 * Generates a batch of new rookie players for the upcoming draft class.
 */
export function generateRookieDraftClass(seasonYear: number, classSize: number = 24): Player[] {
  const rookies: Player[] = [];

  const roles: PlayerRole[] = ['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
  const battingHands: BattingHand[] = ['Right', 'Left'];
  const pacerBowlingStyles: BowlingStyle[] = [
    'Right-arm Fast',
    'Right-arm Medium Fast',
    'Left-arm Fast',
    'Left-arm Medium Fast',
  ];
  const spinnerBowlingStyles: BowlingStyle[] = [
    'Right-arm Leg Break',
    'Right-arm Off Break',
    'Left-arm Orthodox',
    'Left-arm Chinaman',
  ];

  for (let i = 0; i < classSize; i++) {
    // 70% Indian, 30% Overseas
    const isIndian = i < Math.round(classSize * 0.7);
    const nationality: PlayerNationality = isIndian ? 'Indian' : 'Overseas';

    let country = 'India';
    let name = '';

    if (isIndian) {
      const fn = INDIAN_FIRST_NAMES[(seasonYear * 17 + i * 7) % INDIAN_FIRST_NAMES.length];
      const ln = INDIAN_LAST_NAMES[(seasonYear * 23 + i * 11) % INDIAN_LAST_NAMES.length];
      name = `${fn} ${ln}`;
    } else {
      const overseasNation = OVERSEAS_POOLS[(seasonYear + i) % OVERSEAS_POOLS.length];
      country = overseasNation.country;
      const fn = overseasNation.firstNames[(seasonYear * 13 + i * 5) % overseasNation.firstNames.length];
      const ln = overseasNation.lastNames[(seasonYear * 19 + i * 9) % overseasNation.lastNames.length];
      name = `${fn} ${ln}`;
    }

    const age = 18 + ((seasonYear + i * 3) % 5); // 18 - 22 years old
    const role = roles[(seasonYear + i) % roles.length];
    const battingHand = battingHands[(i * 3) % battingHands.length];

    let bowlingStyle: BowlingStyle = 'None';
    let isSpinner = false;
    let isPacer = false;

    if (role === 'Bowler' || role === 'All-Rounder') {
      const willSpin = (i % 2 === 0);
      if (willSpin) {
        bowlingStyle = spinnerBowlingStyles[(seasonYear + i) % spinnerBowlingStyles.length];
        isSpinner = true;
      } else {
        bowlingStyle = pacerBowlingStyles[(seasonYear + i) % pacerBowlingStyles.length];
        isPacer = true;
      }
    }

    // Ability and Potential tiers:
    // 70% Standard prospects: 65-70 OVR, 74-80 POT
    // 25% High potential prospects: 71-75 OVR, 82-87 POT
    // 5% Generational prodigy: 76-78 OVR, 89-94 POT
    let overall = 66 + ((i * 7) % 6);
    let potential = 75 + ((i * 5) % 6);

    const isProdigy = i === 1; // Exactly 1 prodigy per draft class
    const isHighPotential = i === 4 || i === 8 || i === 12 || i === 16;

    if (isProdigy) {
      overall = 76;
      potential = 91;
    } else if (isHighPotential) {
      overall = 72;
      potential = 84;
    }

    const batRating = role === 'Batter' || role === 'Wicketkeeper' ? overall + 4 : role === 'All-Rounder' ? overall - 2 : 40;
    const bowlRating = role === 'Bowler' ? overall + 4 : role === 'All-Rounder' ? overall - 2 : 30;
    const pwr = 55 + ((i * 11) % 25);
    const consistency = 60 + ((i * 7) % 15);

    const basePrice = isProdigy || isHighPotential ? 30 : 20;

    const rookiePlayer: Player = {
      id: `gen_${seasonYear}_${i + 1}`,
      name,
      age,
      nationality,
      country,
      status: 'Uncapped',
      currentFranchiseId: null,
      previousFranchises: [],
      role,
      battingHand,
      bowlingStyle,
      preferredBattingPosition: role === 'Batter' ? 3 : role === 'Wicketkeeper' ? 4 : role === 'All-Rounder' ? 6 : 9,
      isOpener: role === 'Batter' && i % 3 === 0,
      isDeathBowler: isPacer && i % 2 === 0,
      isPowerplayBowler: isPacer && i % 2 === 1,
      isSpinner,
      stats: {
        matches: 0,
        innings: 0,
        runs: 0,
        ballsFaced: 0,
        battingAverage: 0,
        strikeRate: 0,
        fours: 0,
        sixes: 0,
        fifties: 0,
        hundreds: 0,
        highScore: 0,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        bowlingAverage: 0,
        economyRate: 0,
        bestBowling: '0/0',
        catches: 0,
        playerOfMatch: 0,
      },
      ratings: {
        batting: batRating,
        bowling: bowlRating,
        fielding: 70,
        powerHitting: pwr,
        consistency,
        t20Adaptability: 70,
        potential,
        overall,
      },
      recentForm: 75,
      fitnessLevel: 90, // Youth fitness is high
      injuryRisk: 15,
      basePrice,
      currentContractValue: 0,
      estimatedMarketValue: Math.round(basePrice * 1.5),
      expectedDemand: isProdigy ? 85 : 55,
      retentionCost: 400,
      isAvailableForAuction: true,
      isRetained: false,
      isSold: false,
      soldPrice: 0,
    };

    rookies.push(rookiePlayer);
  }

  return rookies;
}

