// ============================================================
// IPL DYNASTY 3.0 — NBA 2K × F1 Team Themes & Jersey Palettes
// ============================================================

export interface TeamTheme {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  primary: string;        // Main franchise brand color
  secondary: string;      // Jersey trim / stripe color
  accent: string;         // Telemetry highlight color
  surface: string;        // Deep carbon surface
  cardBg: string;         // Secondary terminal container
  elevatedBg: string;     // Elevated terminal card
  cardHeaderBg: string;   // Clean brand accent strip
  textLight: string;      // Clean white text
  textDark: string;       // Legible text
  badgeBg: string;
  badgeText: string;
  borderColor: string;    // Subtle hairline border
  shadowColor: string;    // Sleek black shadow
  jerseyGradient: string; // F1 livery gradient
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
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#004BA0',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(0, 75, 160, 0.35)',
    badgeText: '#00D4FF',
    borderColor: '#28303C',
    shadowColor: 'rgba(0, 75, 160, 0.25)',
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
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#FDB913',
    textLight: '#F4F6FA',
    textDark: '#0B0E13',
    badgeBg: 'rgba(253, 185, 19, 0.25)',
    badgeText: '#FDB913',
    borderColor: '#28303C',
    shadowColor: 'rgba(253, 185, 19, 0.25)',
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
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#EC1C24',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(236, 28, 36, 0.25)',
    badgeText: '#FF4757',
    borderColor: '#28303C',
    shadowColor: 'rgba(236, 28, 36, 0.25)',
    jerseyGradient: 'from-[#EC1C24] via-[#1a1a1a] to-[#D4AF37]',
    tagline: 'Play Bold',
  },
  kkr: {
    id: 'kkr',
    name: 'Kolkata Knight Riders',
    shortName: 'Kolkata',
    abbreviation: 'KKR',
    primary: '#3A225D',
    secondary: '#F2C53D',
    accent: '#9C27B0',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#3A225D',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(156, 39, 176, 0.25)',
    badgeText: '#F2C53D',
    borderColor: '#28303C',
    shadowColor: 'rgba(156, 39, 176, 0.25)',
    jerseyGradient: 'from-[#3A225D] via-[#24133b] to-[#F2C53D]',
    tagline: 'Korbo Lorbo Jeetbo',
  },
  srh: {
    id: 'srh',
    name: 'Sunrisers Hyderabad',
    shortName: 'Hyderabad',
    abbreviation: 'SRH',
    primary: '#F26522',
    secondary: '#1A1A1A',
    accent: '#FF8A50',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#F26522',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(242, 101, 34, 0.25)',
    badgeText: '#FF8A50',
    borderColor: '#28303C',
    shadowColor: 'rgba(242, 101, 34, 0.25)',
    jerseyGradient: 'from-[#F26522] via-[#d44809] to-[#1A1A1A]',
    tagline: 'Orange Army Rising',
  },
  rr: {
    id: 'rr',
    name: 'Rajasthan Royals',
    shortName: 'Rajasthan',
    abbreviation: 'RR',
    primary: '#EA1A85',
    secondary: '#254AA5',
    accent: '#FF69B4',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#EA1A85',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(234, 26, 133, 0.25)',
    badgeText: '#FF69B4',
    borderColor: '#28303C',
    shadowColor: 'rgba(234, 26, 133, 0.25)',
    jerseyGradient: 'from-[#EA1A85] via-[#a30b57] to-[#254AA5]',
    tagline: 'Halla Bol Royals',
  },
  dc: {
    id: 'dc',
    name: 'Delhi Capitals',
    shortName: 'Delhi',
    abbreviation: 'DC',
    primary: '#004C97',
    secondary: '#DC2626',
    accent: '#38BDF8',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#004C97',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(0, 76, 151, 0.25)',
    badgeText: '#38BDF8',
    borderColor: '#28303C',
    shadowColor: 'rgba(0, 76, 151, 0.25)',
    jerseyGradient: 'from-[#004C97] via-[#002B56] to-[#DC2626]',
    tagline: 'Roar Macha Dilli',
  },
  pbks: {
    id: 'pbks',
    name: 'Punjab Kings',
    shortName: 'Punjab',
    abbreviation: 'PBKS',
    primary: '#DD1F2D',
    secondary: '#D4AF37',
    accent: '#F87171',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#DD1F2D',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(221, 31, 45, 0.25)',
    badgeText: '#F87171',
    borderColor: '#28303C',
    shadowColor: 'rgba(221, 31, 45, 0.25)',
    jerseyGradient: 'from-[#DD1F2D] via-[#9e111c] to-[#D4AF37]',
    tagline: 'Sadda Punjab Pride',
  },
  gt: {
    id: 'gt',
    name: 'Gujarat Titans',
    shortName: 'Gujarat',
    abbreviation: 'GT',
    primary: '#1B2133',
    secondary: '#C6A55C',
    accent: '#38BDF8',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#1B2133',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(198, 165, 92, 0.25)',
    badgeText: '#C6A55C',
    borderColor: '#28303C',
    shadowColor: 'rgba(198, 165, 92, 0.25)',
    jerseyGradient: 'from-[#1B2133] via-[#0d101a] to-[#C6A55C]',
    tagline: 'Aava De Titans',
  },
  lsg: {
    id: 'lsg',
    name: 'Lucknow Super Giants',
    shortName: 'Lucknow',
    abbreviation: 'LSG',
    primary: '#0057E7',
    secondary: '#FF4D4D',
    accent: '#00D4FF',
    surface: '#0B0E13',
    cardBg: '#11151C',
    elevatedBg: '#191F29',
    cardHeaderBg: '#0057E7',
    textLight: '#F4F6FA',
    textDark: '#F4F6FA',
    badgeBg: 'rgba(0, 87, 231, 0.25)',
    badgeText: '#00D4FF',
    borderColor: '#28303C',
    shadowColor: 'rgba(0, 87, 231, 0.25)',
    jerseyGradient: 'from-[#0057E7] via-[#00348c] to-[#FF4D4D]',
    tagline: 'Ab Apni Baari Hai',
  },
};

/** Get the team theme or fallback to MI */
export function getTeamTheme(franchiseId: string | null | undefined): TeamTheme {
  if (!franchiseId) return TEAM_THEMES.mi;
  const key = franchiseId.toLowerCase();
  return TEAM_THEMES[key] || TEAM_THEMES.mi;
}

// ============================================================
// Team "worlds" — editorial light themes (Peabody House-inspired).
// Every franchise gets its own paper, ink and accent pair, so the whole
// game re-skins in that team's colours the moment you pick it.
// ============================================================

export interface TeamWorld {
  paper: string;   // page background
  ink: string;     // text and hairlines
  accent: string;  // signature fill (jersey colour)
  accent2: string; // secondary fill (trim colour)
  accentInk?: string; // accent as text, when the fill is too light to read
}

export const HOUSE_WORLD: TeamWorld = { paper: '#FAF6F3', ink: '#26211E', accent: '#C8553D', accent2: '#3E6E8E' };

export const TEAM_WORLDS: Record<string, TeamWorld> = {
  mi: { paper: '#F1F4F9', ink: '#0B1F44', accent: '#004BA0', accent2: '#C9A13A' },
  csk: { paper: '#FBF5E1', ink: '#13264F', accent: '#F9B819', accent2: '#D9731A', accentInk: '#A35A00' },
  rcb: { paper: '#F7F2EF', ink: '#1B1414', accent: '#D4161E', accent2: '#B8902F' },
  kkr: { paper: '#F4F0F9', ink: '#24123F', accent: '#4B2A80', accent2: '#D4A52A' },
  srh: { paper: '#FCF2EA', ink: '#1E1916', accent: '#EE5A14', accent2: '#F4B400' },
  rr: { paper: '#FCF0F6', ink: '#1A2455', accent: '#E2157E', accent2: '#2849A6' },
  dc: { paper: '#F0F3FA', ink: '#0E1D4A', accent: '#D3222B', accent2: '#1A4DA8' },
  pbks: { paper: '#FBF1EF', ink: '#3B0E12', accent: '#D81E2C', accent2: '#C29B3A' },
  gt: { paper: '#EFF1F4', ink: '#1A2134', accent: '#B48D46', accent2: '#4A8BC2' },
  lsg: { paper: '#EEF4F8', ink: '#0A1E46', accent: '#0A5BD9', accent2: '#F0562A' },
};

export function getTeamWorld(franchiseId: string | null | undefined): TeamWorld {
  if (!franchiseId) return HOUSE_WORLD;
  return TEAM_WORLDS[franchiseId.toLowerCase()] ?? HOUSE_WORLD;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

/** Mix `b` into `a` by t (0 = a, 1 = b), returning hex. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

function luminance(hex: string): number {
  const ch = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** A version of `color` darkened toward `ink` until it reads as text on `paper`. */
export function readableOn(color: string, paper: string, ink: string, min = 3.6): string {
  let c = color;
  for (let t = 0.1; contrast(c, paper) < min && t <= 1; t += 0.1) c = mixHex(color, ink, t);
  return c;
}

/** Every design token for a team world, as CSS custom properties. */
export function worldTokens(franchiseId: string | null | undefined): Record<string, string> {
  const w = getTeamWorld(franchiseId);
  const on = (c: string) => (contrast(c, '#ffffff') >= 3.2 ? '#ffffff' : w.ink);
  return {
    '--m-bg': w.paper,
    '--m-panel': mixHex(w.paper, '#ffffff', 0.55),
    '--m-panel-2': mixHex(w.paper, '#ffffff', 0.55),
    '--m-raised': mixHex(w.paper, w.ink, 0.05),
    '--m-line': mixHex(w.paper, w.ink, 0.15),
    '--m-line-strong': mixHex(w.paper, w.ink, 0.32),
    '--m-text': w.ink,
    '--m-ink': w.ink,
    '--m-dim': mixHex(w.paper, w.ink, 0.72),
    '--m-faint': mixHex(w.paper, w.ink, 0.52),
    '--m-accent': w.accent,
    '--m-on-accent': on(w.accent),
    '--m-accent-ink': w.accentInk ?? readableOn(w.accent, w.paper, w.ink),
    '--m-accent-2': w.accent2,
    '--m-accent-2-ink': readableOn(w.accent2, w.paper, w.ink),
    '--m-gold': readableOn('#B07A00', w.paper, w.ink, 3.4),
    '--m-green': readableOn('#1C7A4F', w.paper, w.ink, 3.4),
    '--m-red': readableOn('#C0303A', w.paper, w.ink, 3.4),
    '--m-cyan': readableOn('#1F6FA0', w.paper, w.ink, 3.4),
    '--m-purple': readableOn('#6B4BC4', w.paper, w.ink, 3.4),
    '--m-orange': readableOn('#C2561A', w.paper, w.ink, 3.4),
    '--team-primary': w.accent,
    '--team-secondary': w.accent2,
    '--team-on-primary': on(w.accent),
    '--team-ink': w.accentInk ?? readableOn(w.accent, w.paper, w.ink),
  };
}
