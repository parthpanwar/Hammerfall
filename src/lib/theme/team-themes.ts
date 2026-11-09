// ============================================================
// IPL DYNASTY - Neo-Brutalist Team Themes & Jersey Palettes
// ============================================================

export interface TeamTheme {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  primary: string;       // Main jersey base
  secondary: string;     // Jersey stripe / trim
  accent: string;        // Highlight / badge color
  surface: string;       // Dark tinted backdrop
  cardBg: string;        // Neo-brutalist card background
  cardHeaderBg: string;  // Punchy header strip background
  textLight: string;     // High contrast text on dark
  textDark: string;      // High contrast text on bright
  badgeBg: string;
  badgeText: string;
  shadowColor: string;   // Neo-brutalist hard shadow
  jerseyGradient: string; // Gradient representing team jersey
  tagline: string;
}

export const TEAM_THEMES: Record<string, TeamTheme> = {
  mi: {
    id: 'mi',
    name: 'Mumbai Indians',
    shortName: 'Mumbai',
    abbreviation: 'MI',
    primary: '#004BA0',
    secondary: '#D1AB3E',
    accent: '#00D4FF',
    surface: '#040d1a',
    cardBg: '#08172e',
    cardHeaderBg: '#004BA0',
    textLight: '#FFFFFF',
    textDark: '#040d1a',
    badgeBg: '#D1AB3E',
    badgeText: '#040d1a',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#004BA0] via-[#002B66] to-[#D1AB3E]',
    tagline: 'Duniya Hila Denge Hum',
  },
  csk: {
    id: 'csk',
    name: 'Chennai Super Kings',
    shortName: 'Chennai',
    abbreviation: 'CSK',
    primary: '#FDB913',
    secondary: '#003B7B',
    accent: '#FFA000',
    surface: '#141103',
    cardBg: '#1f1a07',
    cardHeaderBg: '#FDB913',
    textLight: '#FFFFFF',
    textDark: '#001a38',
    badgeBg: '#FDB913',
    badgeText: '#002B66',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#FDB913] via-[#FFA000] to-[#003B7B]',
    tagline: 'Whistle Podu Army',
  },
  rcb: {
    id: 'rcb',
    name: 'Royal Challengers Bengaluru',
    shortName: 'Bengaluru',
    abbreviation: 'RCB',
    primary: '#EC1C24',
    secondary: '#D4AF37',
    accent: '#FF4757',
    surface: '#120406',
    cardBg: '#1f080b',
    cardHeaderBg: '#EC1C24',
    textLight: '#FFFFFF',
    textDark: '#120406',
    badgeBg: '#D4AF37',
    badgeText: '#120406',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#EC1C24] via-[#1a1a1a] to-[#D4AF37]',
    tagline: 'Ee Sala Cup Namde',
  },
  kkr: {
    id: 'kkr',
    name: 'Kolkata Knight Riders',
    shortName: 'Kolkata',
    abbreviation: 'KKR',
    primary: '#3A225D',
    secondary: '#F2C53D',
    accent: '#9C27B0',
    surface: '#0f0717',
    cardBg: '#1b0e2b',
    cardHeaderBg: '#3A225D',
    textLight: '#FFFFFF',
    textDark: '#0f0717',
    badgeBg: '#F2C53D',
    badgeText: '#200e36',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#3A225D] via-[#24133b] to-[#F2C53D]',
    tagline: 'Korbo Lorbo Jeetbo',
  },
  srh: {
    id: 'srh',
    name: 'Sunrisers Hyderabad',
    shortName: 'Hyderabad',
    abbreviation: 'SRH',
    primary: '#FF822A',
    secondary: '#1A1A1A',
    accent: '#FFD700',
    surface: '#140802',
    cardBg: '#210d03',
    cardHeaderBg: '#FF822A',
    textLight: '#FFFFFF',
    textDark: '#140802',
    badgeBg: '#FF822A',
    badgeText: '#000000',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#FF822A] via-[#B83E00] to-[#1A1A1A]',
    tagline: 'Orange Army Rising',
  },
  rr: {
    id: 'rr',
    name: 'Rajasthan Royals',
    shortName: 'Rajasthan',
    abbreviation: 'RR',
    primary: '#EA1A85',
    secondary: '#254AA5',
    accent: '#FF70A6',
    surface: '#14030d',
    cardBg: '#240819',
    cardHeaderBg: '#EA1A85',
    textLight: '#FFFFFF',
    textDark: '#14030d',
    badgeBg: '#EA1A85',
    badgeText: '#FFFFFF',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#EA1A85] via-[#75114D] to-[#254AA5]',
    tagline: 'Halla Bol Royal Pride',
  },
  dc: {
    id: 'dc',
    name: 'Delhi Capitals',
    shortName: 'Delhi',
    abbreviation: 'DC',
    primary: '#004C93',
    secondary: '#EF1B23',
    accent: '#0099FF',
    surface: '#030d17',
    cardBg: '#07182e',
    cardHeaderBg: '#004C93',
    textLight: '#FFFFFF',
    textDark: '#030d17',
    badgeBg: '#EF1B23',
    badgeText: '#FFFFFF',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#004C93] via-[#052952] to-[#EF1B23]',
    tagline: 'Roar Macha DC',
  },
  pbks: {
    id: 'pbks',
    name: 'Punjab Kings',
    shortName: 'Punjab',
    abbreviation: 'PBKS',
    primary: '#ED1B24',
    secondary: '#DCDDDF',
    accent: '#F5A623',
    surface: '#140304',
    cardBg: '#240809',
    cardHeaderBg: '#ED1B24',
    textLight: '#FFFFFF',
    textDark: '#140304',
    badgeBg: '#DCDDDF',
    badgeText: '#ED1B24',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#ED1B24] via-[#850D13] to-[#DCDDDF]',
    tagline: 'Sadda Punjab Passion',
  },
  gt: {
    id: 'gt',
    name: 'Gujarat Titans',
    shortName: 'Gujarat',
    abbreviation: 'GT',
    primary: '#1C1C2B',
    secondary: '#BD9B60',
    accent: '#00E5FF',
    surface: '#0a0a12',
    cardBg: '#131321',
    cardHeaderBg: '#1C1C2B',
    textLight: '#FFFFFF',
    textDark: '#0a0a12',
    badgeBg: '#BD9B60',
    badgeText: '#0a0a12',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#1C1C2B] via-[#2A2B42] to-[#BD9B60]',
    tagline: 'Aava De Titans Spirit',
  },
  lsg: {
    id: 'lsg',
    name: 'Lucknow Super Giants',
    shortName: 'Lucknow',
    abbreviation: 'LSG',
    primary: '#003B7B',
    secondary: '#00A5E0',
    accent: '#FF9800',
    surface: '#040e1a',
    cardBg: '#081c33',
    cardHeaderBg: '#003B7B',
    textLight: '#FFFFFF',
    textDark: '#040e1a',
    badgeBg: '#00A5E0',
    badgeText: '#040e1a',
    shadowColor: '#000000',
    jerseyGradient: 'from-[#003B7B] via-[#006BB3] to-[#00A5E0]',
    tagline: 'Adab Se Harayenge',
  },
};

export const DEFAULT_THEME = TEAM_THEMES.mi;

export function getTeamTheme(franchiseId?: string | null): TeamTheme {
  if (!franchiseId) return DEFAULT_THEME;
  const key = franchiseId.toLowerCase();
  return TEAM_THEMES[key] || DEFAULT_THEME;
}

