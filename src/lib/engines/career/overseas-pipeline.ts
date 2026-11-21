// ============================================================
// IPL DYNASTY - The overseas pipeline
// Two hand-picked lists that shape the overseas market across a career:
//  - Stalwarts: the overseas players every franchise is built around (Buttler,
//    Head, Rashid, Narine…). They hold their level while they keep producing
//    and play on longer, instead of sliding with the generic age curve.
//  - Rising stars: young internationals who grow into those shoes (Brook,
//    Stubbs, Brevis, Maphaka…). Their hidden ceiling is guaranteed, so over a
//    cycle or two they replace the stalwarts as the tier-1 overseas buys.
// Everyone else's ceiling is drawn per career (see hiddenCeiling).
// ============================================================

/** Tier-1 overseas T20 cricketers who anchor franchises. */
export const OVERSEAS_STALWARTS = new Set([
  'jos-buttler',
  'travis-head',
  'pat-cummins',
  'rashid-khan',
  'kagiso-rabada',
  'phil-salt',
  'tim-david',
  'josh-hazlewood',
  'sunil-narine',
  'cameron-green',
  'nicholas-pooran',
  'heinrich-klaasen',
]);

/**
 * Young or still-emerging internationals and the level they grow into.
 * The value is the hidden ceiling: where they top out with steady cricket.
 */
export const OVERSEAS_RISING_STARS: Record<string, number> = {
  // Batters and keepers
  'hc-brook': 90,
  'jg-bethell': 88,
  'tristan-stubbs': 87,
  'dewald-brevis': 90,
  'finn-allen': 84,
  'lhuan-dre-pretorius': 87,
  'jake-fraser-mcgurk': 85,
  'rahmanullah-gurbaz': 85,
  // Bowlers
  'kwena-maphaka': 88,
  'am-ghazanfar': 86,
  'noor-ahmad': 91,
  'matheesha-pathirana': 89,
  'gerald-coetzee': 86,
  'shamar-joseph': 85,
  'dilshan-madushanka': 84,
  // All-rounders
  'marco-jansen': 88,
  'azmatullah-omarzai': 84,
  'c-connolly': 86,
  'mitchell-owen': 85,
  'rachin-ravindra': 85,
  'will-jacks': 84,
};

export const isStalwart = (id: string) => OVERSEAS_STALWARTS.has(id);
export const risingStarCeiling = (id: string): number | undefined => OVERSEAS_RISING_STARS[id];
