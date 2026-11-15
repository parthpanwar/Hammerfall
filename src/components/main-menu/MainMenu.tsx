'use client';

// ============================================================
// IPL DYNASTY — Title screen + New Franchise wizard (editorial, team-themed)
// Home → Mode → Franchise → League Rules → Retentions
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { FRANCHISES } from '@/lib/data/franchises';
import { GLOBAL_PLAYERS } from '@/lib/data/players';
import { ChevronRight, ChevronLeft, Play, Plus, FolderOpen, Database, Settings, RotateCcw, Trophy, Sliders, Calendar } from 'lucide-react';
import type { AuctionPace, AuctionType, CPUDifficulty, Player } from '@/lib/types/game';
import { auctionTypeFor, campaignLength, irlAuctionType, type CycleMode } from '@/lib/flow/season-flow';
import { getLeaguePurseForSeason } from '@/lib/engines/career/contract-engine';
import { contrast, getTeamTheme, getTeamWorld } from '@/lib/theme/team-themes';
import { formatPrice } from '@/lib/utils';
import { SettingsModal } from './SettingsModal';
import { CareerSavesModal } from './CareerSavesModal';
import { GlobalPlayerDatabase } from '@/components/scouting/GlobalPlayerDatabase';
import { listAllSaveSlots } from '@/lib/engines/career/save-manager';
import type { CareerSaveSlot } from '@/lib/types/career';
import { LineField, MButton, OvrBadge, Panel, RoleTag, OverseasTag, TeamCrest, worldVars, StatTile } from '@/components/mynba/primitives';

type View = 'home' | 'mode' | 'team' | 'rules';
type ModeId = 'career' | 'irl' | 'reset' | 'custom';

/** Every new game starts from the real IPL 2026 squads, heading into IPL 2027. */
const START_SEASON = 2027;

const MODES: { id: ModeId; name: string; tag: string; desc: string; bullets: string[]; icon: React.ElementType }[] = [
  {
    id: 'career',
    name: 'Franchise Career',
    tag: 'Own cycle',
    desc: 'Start your own 3-season cycle from today’s real squads: retain up to 6 before a mega auction, then two mini auctions.',
    bullets: ['Real IPL 2026 squads', 'Mega auction before IPL 2027', '3 seasons · 1 mega + 2 mini'],
    icon: Trophy,
  },
  {
    id: 'irl',
    name: 'Real IPL Timeline',
    tag: 'Follows IRL',
    desc: 'Mirror the real calendar. IPL 2027 is the last mini auction of the 2025–27 cycle; the mega auction comes before IPL 2028.',
    bullets: ['Release Day first — no retentions', 'Mega auction before IPL 2028', '4 seasons · IPL 2027–2030'],
    icon: Calendar,
  },
  {
    id: 'reset',
    name: 'Full Reset Draft',
    tag: 'Clean slate',
    desc: 'Every franchise releases its entire squad for a mega auction — then lives with what it built for two more seasons.',
    bullets: ['No retentions in year 1', 'Every star in the mega pool', '3 seasons · 1 mega + 2 mini'],
    icon: RotateCcw,
  },
  {
    id: 'custom',
    name: 'Custom Auction Lab',
    tag: 'Sandbox',
    desc: 'Tune the league purse and difficulty, then play your own three-season cycle under your own numbers.',
    bullets: ['Purse ₹80–150 Cr', 'Any difficulty', '3 seasons · 1 mega + 2 mini'],
    icon: Sliders,
  },
];

/** Season-by-season preview of a mode's auction calendar. */
function cyclePreview(mode: ModeId) {
  const settings = { auctionType: (mode === 'irl' ? 'Mini' : 'Mega') as AuctionType, startingSeason: START_SEASON, cycleMode: (mode === 'irl' ? 'irl' : 'custom') as CycleMode };
  const n = campaignLength(settings);
  return Array.from({ length: n }, (_, i) => {
    const season = START_SEASON + i;
    const type = auctionTypeFor(season, settings);
    const note =
      type === 'Mega'
        ? 'Retain up to 6, everyone else re-enters a deep auction pool.'
        : 'Squads stay together. Release a few, shop a small pool — trades matter most.';
    return { season, type, note };
  });
}

const PHASE_LABEL: Record<string, string> = {
  Retention: 'Retentions',
  Registration: 'Player Pool',
  Scouting: 'Scouting',
  ShortlistReveal: 'Auction Sets',
  Auction: 'Auction',
  SquadManagement: 'Squad & XI',
  Tournament: 'Regular Season',
  Standings: 'Regular Season',
  Playoffs: 'Playoffs',
  SeasonReview: 'Season Review',
  CareerDashboard: 'Dynasty Hub',
  CareerHistory: 'Dynasty Hub',
};

function rosterOf(franchiseId: string): Player[] {
  return GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId === franchiseId).sort(
    (a, b) => b.ratings.overall - a.ratings.overall
  );
}

/** Team OVR = average of the best 11 players currently under contract. */
function teamOvr(players: Player[]): number {
  const top = players.slice(0, 11);
  if (!top.length) return 0;
  return Math.round(top.reduce((s, p) => s + p.ratings.overall, 0) / top.length);
}

export function MainMenu() {
  const store = useGameStore();
  const { id: savedGameId, humanFranchiseId, lastActivePhase, currentSeason, initializeGame, resumeCareer, franchises } = store;

  const [view, setView] = useState<View>('home');
  const [mode, setMode] = useState<ModeId>('career');
  const [teamId, setTeamId] = useState<string>('mi');
  const [difficulty, setDifficulty] = useState<CPUDifficulty>('Normal');
  const [pace, setPace] = useState<AuctionPace>('Normal');
  const [purseCr, setPurseCr] = useState(120);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [showDb, setShowDb] = useState(false);
  const [hoverTeam, setHoverTeam] = useState<string | null>(null);
  const goto = (v: View) => {
    setHoverTeam(null);
    setView(v);
  };
  // MainMenu only renders client-side (after store hydration), so reading saves lazily is safe.
  const [slots, setSlots] = useState<{ slotNumber: number; metadata: CareerSaveSlot | null }[]>(() => listAllSaveSlots());

  const hasActiveCareer = Boolean(savedGameId && humanFranchiseId);
  const activeTeam = franchises.find((f) => f.id === humanFranchiseId);
  const savedCount = slots.filter((s) => s.metadata).length;

  const rosters = useMemo(() => Object.fromEntries(FRANCHISES.map((f) => [f.id, rosterOf(f.id)])), []);
  const spotlight = useMemo(
    () => [...GLOBAL_PLAYERS].sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, 8),
    []
  );
  const poolStats = useMemo(() => {
    const countries = new Set(GLOBAL_PLAYERS.map((p) => p.country));
    return {
      total: GLOBAL_PLAYERS.length,
      overseas: GLOBAL_PLAYERS.filter((p) => p.nationality === 'Overseas').length,
      countries: countries.size,
    };
  }, []);

  const startFranchise = () => {
    const purseLakhs = mode === 'custom' ? purseCr * 100 : getLeaguePurseForSeason(START_SEASON);
    const teams = FRANCHISES.map((f) => ({ ...f, totalPurse: purseLakhs, remainingPurse: purseLakhs }));
    initializeGame(
      {
        startingSeason: START_SEASON,
        cycleMode: mode === 'irl' ? 'irl' : 'custom',
        auctionType: mode === 'irl' ? irlAuctionType(START_SEASON) : 'Mega',
        rulesPreset: mode === 'custom' ? 'Custom' : 'Official',
        cpuDifficulty: difficulty,
        auctionPace: pace,
        matchSimMode: 'Detailed',
        allowCustomPurse: mode === 'custom',
        customPurse: mode === 'custom' ? purseLakhs : undefined,
        enableInjuries: false,
        enablePlayerDevelopment: true,
        seed: Math.floor(Math.random() * 1_000_000),
      },
      teamId,
      teams,
      GLOBAL_PLAYERS
    );

    if (mode === 'reset') {
      // Skip retentions: everyone is released into the pool.
      const s = useGameStore.getState();
      s.franchises.forEach((f) =>
        s.updateFranchise(f.id, { players: [], retainedPlayers: [], remainingPurse: f.totalPurse })
      );
      s.setRetentionDecisions([]);
      s.completeRetention();
      s.initializeRegistration();
    }
  };

  const steps: { id: View; label: string }[] = [
    { id: 'mode', label: 'Mode' },
    { id: 'team', label: 'Franchise' },
    { id: 'rules', label: 'League rules' },
  ];

  // The page takes on a franchise's world: the team you hover previews it,
  // the team you pick keeps it. The mode step stays in the neutral house world.
  const worldId =
    hoverTeam ??
    (view === 'home' ? (hasActiveCareer ? humanFranchiseId : null) : view === 'mode' ? null : teamId);

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--m-bg)] text-[var(--m-text)] transition-colors duration-500"
      style={worldVars(worldId)}
    >
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        auctionPace={pace}
        setAuctionPace={setPace}
      />
      <CareerSavesModal
        isOpen={showSaves}
        onClose={() => {
          setShowSaves(false);
          setSlots(listAllSaveSlots());
        }}
      />
      {showDb && <GlobalPlayerDatabase isOpen={showDb} onClose={() => setShowDb(false)} players={GLOBAL_PLAYERS} />}

      {/* Top bar */}
      <div className="border-b border-[var(--m-ink)] transition-colors duration-500">
        <div className="max-w-[1440px] mx-auto h-11 px-4 sm:px-6 flex items-center gap-5 text-sm">
          <button className="flex items-center gap-2 font-semibold" onClick={() => goto('home')}>
            <span className="w-5 h-5 rounded-full border border-[var(--m-ink)] grid place-items-center" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--m-accent)]" />
            </span>
            IPL Dynasty
          </button>
          <nav className="hidden sm:flex items-center gap-4 text-[var(--m-dim)]" aria-label="Main">
            <button className="hover:text-[var(--m-text)]" onClick={() => goto('mode')}>New franchise</button>
            <button className="hover:text-[var(--m-text)]" onClick={() => setShowSaves(true)}>Load</button>
            <button className="hover:text-[var(--m-text)]" onClick={() => setShowDb(true)}>Players</button>
            <button className="hover:text-[var(--m-text)]" onClick={() => setShowSettings(true)}>Settings</button>
          </nav>
          <span className="ml-auto text-[var(--m-faint)] hidden md:inline">IPL {START_SEASON} offseason</span>
        </div>
      </div>

      {view === 'home' ? (
        <HomeScreen
          hasActiveCareer={hasActiveCareer}
          activeLabel={
            activeTeam
              ? `${activeTeam.name} · Season ${currentSeason} · ${PHASE_LABEL[lastActivePhase || 'Retention'] || 'Offseason'}`
              : ''
          }
          savedCount={savedCount}
          spotlight={spotlight}
          poolStats={poolStats}
          worldSeed={worldId ?? 'house'}
          onHoverTeam={setHoverTeam}
          onPickTeam={(id) => {
            setTeamId(id);
            setHoverTeam(null);
            goto('mode');
          }}
          onContinue={resumeCareer}
          onNew={() => goto('mode')}
          onLoad={() => setShowSaves(true)}
          onDb={() => setShowDb(true)}
          onSettings={() => setShowSettings(true)}
        />
      ) : (
        <div className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-8 gap-7">
          {/* Wizard header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="m-label">New franchise</div>
              <h1 className="m-display text-5xl sm:text-6xl mt-1">
                {view === 'mode' ? 'Choose your mode.' : view === 'team' ? 'Pick a franchise.' : 'Set the league rules.'}
              </h1>
            </div>
            <ol className="flex items-center gap-2" aria-label="Setup steps">
              {steps.map((s, i) => {
                const idx = steps.findIndex((x) => x.id === view);
                const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full border ${
                        state === 'current'
                          ? 'bg-[var(--m-ink)] text-[var(--m-bg)] border-[var(--m-ink)]'
                          : state === 'done'
                          ? 'text-[var(--m-text)] border-[var(--m-ink)]'
                          : 'text-[var(--m-faint)] border-[var(--m-line-strong)]'
                      }`}
                    >
                      {i + 1}. {s.label}
                    </span>
                    {i < steps.length - 1 && <span className="w-4 h-px bg-[var(--m-ink)]" />}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex-1">
            {view === 'mode' && <ModeStep mode={mode} setMode={setMode} />}
            {view === 'team' && <TeamStep teamId={teamId} setTeamId={setTeamId} onHoverTeam={setHoverTeam} rosters={rosters} mode={mode} />}
            {view === 'rules' && (
              <RulesStep
                mode={mode}
                teamId={teamId}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                pace={pace}
                setPace={setPace}
                purseCr={purseCr}
                setPurseCr={setPurseCr}
                roster={rosters[teamId]}
              />
            )}
          </div>

          {/* Wizard footer */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[var(--m-bg)]/92 backdrop-blur border-t border-[var(--m-ink)] flex items-center justify-between gap-3 transition-colors duration-500">
            <MButton
              variant="ghost"
              onClick={() => goto(view === 'mode' ? 'home' : view === 'team' ? 'mode' : 'team')}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </MButton>
            <div className="hidden sm:flex items-center gap-3 text-sm text-[var(--m-dim)]">
              <TeamCrest franchiseId={teamId} size="xs" />
              <span>
                {MODES.find((m) => m.id === mode)?.name} · {getTeamTheme(teamId).name}
              </span>
            </div>
            {view !== 'rules' ? (
              <MButton variant="primary" size="lg" onClick={() => goto(view === 'mode' ? 'team' : 'rules')}>
                Continue <ChevronRight className="w-4 h-4" />
              </MButton>
            ) : (
              <MButton variant="team" size="lg" onClick={startFranchise}>
                {mode === 'reset' ? 'Start — go to player pool' : mode === 'irl' ? 'Start — Release Day' : 'Start — open retentions'}
                <ChevronRight className="w-4 h-4" />
              </MButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Team swatch tray — one "eye" per franchise (Peabody House's colour tray).
// Hovering a swatch previews that team's world across the page.
// ------------------------------------------------------------
function SwatchTray({
  selected,
  onHover,
  onPick,
  size = 'md',
}: {
  selected?: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  size?: 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9 sm:w-10 sm:h-10';
  return (
    <div
      className="inline-flex shrink-0 border-r border-[var(--m-ink)] rounded-r-full overflow-hidden"
      role="listbox"
      aria-label="Franchises"
      onMouseLeave={() => onHover(null)}
    >
      {FRANCHISES.map((f, i) => {
        const w = getTeamWorld(f.id);
        const active = selected === f.id;
        return (
          <button
            key={f.id}
            role="option"
            aria-selected={active}
            title={f.name}
            onMouseEnter={() => onHover(f.id)}
            onFocus={() => onHover(f.id)}
            onBlur={() => onHover(null)}
            onClick={() => onPick(f.id)}
            className={`group relative grid place-items-center p-1.5 sm:p-2 ${i > 0 ? 'border-l border-[var(--m-ink)]' : ''} ${active ? 'bg-[var(--m-ink)]' : 'hover:bg-[var(--m-raised)]'} transition-colors`}
          >
            <span
              className={`${dim} rounded-full grid place-items-center transition-transform duration-300 group-hover:scale-105`}
              style={{ background: w.accent, boxShadow: `inset 0 0 0 1px ${w.ink}, inset 0 0 0 4px ${w.accent2}, inset 0 0 0 5px ${w.ink}` }}
            >
              <span className="w-[38%] h-[38%] rounded-full grid place-items-center" style={{ background: w.ink }}>
                <span className="w-[30%] h-[30%] rounded-full translate-x-[35%] -translate-y-[35%]" style={{ background: w.paper }} />
              </span>
            </span>
            <span className={`absolute bottom-0.5 left-0 right-0 text-center text-[8px] font-semibold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'text-[var(--m-bg)] opacity-100' : ''}`}>
              {f.abbreviation}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------
// Home / title screen
// ------------------------------------------------------------
function HomeScreen({
  hasActiveCareer,
  activeLabel,
  savedCount,
  spotlight,
  poolStats,
  worldSeed,
  onHoverTeam,
  onPickTeam,
  onContinue,
  onNew,
  onLoad,
  onDb,
  onSettings,
}: {
  hasActiveCareer: boolean;
  activeLabel: string;
  savedCount: number;
  spotlight: Player[];
  poolStats: { total: number; overseas: number; countries: number };
  worldSeed: string;
  onHoverTeam: (id: string | null) => void;
  onPickTeam: (id: string) => void;
  onContinue: () => void;
  onNew: () => void;
  onLoad: () => void;
  onDb: () => void;
  onSettings: () => void;
}) {
  const items = [
    hasActiveCareer && { key: 'continue', label: 'Continue', sub: activeLabel, icon: Play, onClick: onContinue },
    { key: 'new', label: 'New franchise', sub: `Pick a team and start the IPL ${START_SEASON} offseason`, icon: Plus, onClick: onNew },
    { key: 'load', label: 'Load career', sub: savedCount ? `${savedCount} saved career${savedCount > 1 ? 's' : ''}` : 'No saved careers yet', icon: FolderOpen, onClick: onLoad },
    { key: 'db', label: 'Player database', sub: `${poolStats.total} active cricketers`, icon: Database, onClick: onDb },
    { key: 'settings', label: 'Settings', sub: 'Difficulty, auction pace & IPL rules', icon: Settings, onClick: onSettings },
  ].filter(Boolean) as { key: string; label: string; sub: string; icon: React.ElementType; onClick: () => void }[];

  const ticker = [
    `${poolStats.total} players registered from ${poolStats.countries} countries`,
    `${poolStats.overseas} overseas players chasing 80 overseas slots`,
    '10 franchises · 18–25 man squads · max 8 overseas',
    'Retention slabs: ₹18 Cr, ₹14 Cr, ₹11 Cr · uncapped ₹4 Cr',
    ...spotlight.slice(0, 5).map((p) => `${p.name} (${p.ratings.overall} OVR) headlines the marquee set`),
  ];

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] max-w-[1440px] w-full mx-auto">
        {/* Left: statement, team tray, menu */}
        <div className="flex flex-col lg:border-r border-[var(--m-ink)]">
          <div className="px-6 sm:px-10 pt-14 pb-10 m-rise">
            <h1 className="m-display text-[3.1rem] sm:text-[4.4rem] leading-[0.98] max-w-[13ch]">
              IPL Dynasty is a front office for the richest league in cricket.
            </h1>
            <p className="text-[var(--m-dim)] mt-6 max-w-md leading-relaxed">
              Retain your core, scout the pool, win the auction against nine CPU general managers — then live with
              every rupee for three seasons.
            </p>
          </div>

          <div className="border-y border-[var(--m-ink)] flex items-center overflow-x-auto">
            <SwatchTray selected={hasActiveCareer ? null : undefined} onHover={onHoverTeam} onPick={onPickTeam} />
            <span className="px-5 text-xs text-[var(--m-faint)] hidden 2xl:block">Hover a franchise to see its world — click to start with it</span>
          </div>

          <nav className="flex flex-col px-6 sm:px-10 py-8" aria-label="Main menu">
            {items.map((it, i) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.key}
                  onClick={it.onClick}
                  className="group m-rise text-left grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 border-t border-[var(--m-line)] last:border-b"
                  style={{ animationDelay: `${80 + i * 60}ms` }}
                >
                  <Icon className="w-5 h-5 text-[var(--m-faint)] group-hover:text-[var(--m-text)] transition-colors" strokeWidth={1.5} />
                  <span className="min-w-0">
                    <span className="block m-display text-[1.9rem] leading-none">{it.label}</span>
                    <span className="block text-xs truncate text-[var(--m-faint)] mt-1.5">{it.sub}</span>
                  </span>
                  <span className="m-arrow-link text-[var(--m-dim)] group-hover:text-[var(--m-text)]">
                    {it.key === 'continue' ? 'Resume' : 'Open'}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: line field + spotlight */}
        <div className="flex flex-col min-w-0">
          <div className="relative h-[300px] lg:h-[420px] border-b border-[var(--m-ink)] text-[var(--m-ink)] overflow-hidden">
            <LineField seed={worldSeed} lines={52} accentEvery={11} className="absolute inset-0 w-full h-full m-drift" />
          </div>
          <div className="grid grid-cols-3 gap-5 px-6 sm:px-8 pt-6">
            <StatTile label="Active players" value={poolStats.total} />
            <StatTile label="Overseas" value={poolStats.overseas} />
            <StatTile label="Nations" value={poolStats.countries} />
          </div>
          <div className="px-6 sm:px-8 pt-8 pb-10">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Marquee spotlight</span>
              <span className="text-xs text-[var(--m-faint)]">Top OVR</span>
            </div>
            <ul className="mt-3 border-t border-[var(--m-ink)]">
              {spotlight.map((p) => (
                <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-2 border-b border-[var(--m-line)]">
                  <OvrBadge ovr={p.ratings.overall} size="sm" />
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-[var(--m-faint)]">{p.country} · age {p.age}</div>
                  </div>
                  <RoleTag role={p.role} />
                  {p.currentFranchiseId ? <TeamCrest franchiseId={p.currentFranchiseId} size="xs" /> : <span className="m-chip">FA</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* News ticker */}
      <div className="border-t border-[var(--m-ink)] overflow-hidden" aria-hidden>
        <div className="flex items-center">
          <span className="shrink-0 px-4 py-2 bg-[var(--m-ink)] text-[var(--m-bg)] text-xs font-semibold">Auction wire</span>
          <div className="overflow-hidden flex-1">
            <div className="m-ticker-track py-2 pl-6 text-sm text-[var(--m-dim)]">
              {[...ticker, ...ticker].map((t, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--team-primary)] inline-block" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Wizard steps
// ------------------------------------------------------------
function ModeStep({ mode, setMode }: { mode: ModeId; setMode: (m: ModeId) => void }) {
  const cycle = cyclePreview(mode);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button key={m.id} data-active={active} onClick={() => setMode(m.id)} className="m-tile p-0 flex flex-col min-h-[320px]">
              <div className="relative h-28 overflow-hidden border-b border-[var(--m-ink)] text-[var(--m-ink)]">
                <LineField seed={m.id} lines={16} className="absolute inset-0 w-full h-full opacity-70" />
                <span className="absolute left-4 top-4 m-chip !bg-[var(--m-panel)] !text-[var(--m-text)] !border-[var(--m-ink)]">{m.tag}</span>
                <span className="absolute right-4 bottom-3 w-11 h-11 rounded-full grid place-items-center bg-[var(--m-panel)] border border-[var(--m-ink)]">
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="m-display text-[2rem] leading-none">{m.name}</div>
                <p className="text-sm text-[var(--m-dim)] mt-3 flex-1 leading-relaxed">{m.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="text-[13px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--m-accent)]" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
      <div>
        <div className="text-sm font-semibold mb-2">Your auction calendar</div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${cycle.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} border-t border-l border-[var(--m-ink)]`} aria-label="Campaign cycle">
          {cycle.map((c, i) => (
            <div key={c.season} className="border-r border-b border-[var(--m-ink)] px-4 py-4 bg-[var(--m-panel)]">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] text-[var(--m-faint)]">Year {i + 1}</span>
                <span className="m-display text-2xl">IPL {c.season}</span>
                <span className={`text-[11px] font-semibold ml-auto ${c.type === 'Mega' ? 'text-[var(--m-gold)]' : 'text-[var(--m-green)]'}`}>
                  {c.type} · {c.type === 'Mega' ? 'Nov' : 'Dec'} {c.season - 1}
                </span>
              </div>
              <p className="text-xs text-[var(--m-dim)] mt-1.5 leading-relaxed">{c.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamStep({
  teamId,
  setTeamId,
  onHoverTeam,
  rosters,
  mode,
}: {
  teamId: string;
  setTeamId: (id: string) => void;
  onHoverTeam: (id: string | null) => void;
  rosters: Record<string, Player[]>;
  mode: ModeId;
}) {
  const team = FRANCHISES.find((f) => f.id === teamId)!;
  const theme = getTeamTheme(teamId);
  const roster = rosters[teamId] || [];
  const ovr = teamOvr(roster);
  const avg = (k: 'batting' | 'bowling' | 'fielding') =>
    Math.round(roster.slice(0, 11).reduce((s, p) => s + p.ratings[k], 0) / Math.max(1, Math.min(11, roster.length)));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-6">
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-l border-[var(--m-ink)] content-start self-start"
        onMouseLeave={() => onHoverTeam(null)}
      >
        {FRANCHISES.map((f) => {
          const w = getTeamWorld(f.id);
          const r = rosters[f.id] || [];
          const active = f.id === teamId;
          return (
            <button
              key={f.id}
              onMouseEnter={() => onHoverTeam(f.id)}
              onFocus={() => onHoverTeam(f.id)}
              onBlur={() => onHoverTeam(null)}
              onClick={() => setTeamId(f.id)}
              aria-pressed={active}
              className="group relative flex flex-col items-start text-left border-r border-b border-[var(--m-ink)] p-4 min-h-[190px] transition-colors duration-300"
              style={{ background: active ? w.accent : w.paper, color: active ? (contrast(w.accent, '#ffffff') >= 3.2 ? '#fff' : w.ink) : w.ink }}
            >
              <span
                className="w-16 h-16 rounded-full grid place-items-center transition-transform duration-300 group-hover:scale-105"
                style={{ background: active ? w.paper : w.accent, boxShadow: `inset 0 0 0 1px ${w.ink}, inset 0 0 0 5px ${w.accent2}, inset 0 0 0 6px ${w.ink}` }}
              >
                <span className="text-[13px] font-semibold" style={{ color: active ? w.ink : contrast(w.accent, '#ffffff') >= 3.2 ? '#fff' : w.ink }}>
                  {f.abbreviation}
                </span>
              </span>
              <span className="mt-auto pt-4 block m-display text-[1.6rem] leading-none">{f.shortName}</span>
              <span className="flex items-center justify-between w-full mt-1.5 text-[11px] opacity-75">
                <span className="truncate">{f.city}</span>
                <span className="tabular-nums">OVR {teamOvr(r) || '—'}</span>
              </span>
              {active && <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-current">Selected</span>}
            </button>
          );
        })}
      </div>

      {/* Team detail */}
      <div className="m-panel overflow-hidden self-start xl:sticky xl:top-4 shadow-[8px_8px_0_var(--m-ink)]">
        <div className="relative h-36 border-b border-[var(--m-ink)] text-[var(--m-ink)]">
          <div className="absolute inset-0 overflow-hidden">
            <LineField seed={teamId} lines={22} accentEvery={5} className="w-full h-full m-drift" />
          </div>
          <TeamCrest franchiseId={teamId} size="lg" className="absolute left-5 -bottom-0 translate-y-1/2 z-10" />
        </div>
        <div className="px-5 pt-12 pb-5 border-b border-[var(--m-line)]">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="m-label">{team.city} · {team.homeStadium}</div>
              <div className="m-display text-[2.4rem] leading-none mt-1">{team.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="m-label">Team OVR</div>
              <div className="m-display text-5xl leading-none text-[var(--m-accent-ink)]">{ovr || '—'}</div>
            </div>
          </div>
          <p className="text-sm italic text-[var(--m-dim)] mt-3">“{theme.tagline}”</p>
        </div>
        <div className="px-5 pt-3 pb-4 grid grid-cols-3 gap-4 border-b border-[var(--m-line)]">
          <StatTile label="Batting" value={avg('batting') || '—'} />
          <StatTile label="Bowling" value={avg('bowling') || '—'} />
          <StatTile label="Fielding" value={avg('fielding') || '—'} />
        </div>
        <div className="px-5 pt-3 pb-1 flex items-center justify-between">
          <span className="m-label">{mode === 'reset' ? 'IPL 2026 squad (will be released)' : mode === 'irl' ? 'IPL 2026 squad · carried into 2027' : 'IPL 2026 squad · retention candidates'}</span>
          <span className="m-chip">{roster.length}</span>
        </div>
        <ul className="max-h-[320px] overflow-y-auto m-scroll px-3 pb-3">
          {roster.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-2 py-1.5 border-b border-[var(--m-line)] last:border-0">
              <OvrBadge ovr={p.ratings.overall} size="sm" />
              <span className="flex-1 min-w-0 truncate font-medium text-sm">{p.name}</span>
              {p.nationality === 'Overseas' && <OverseasTag />}
              <RoleTag role={p.role} />
            </li>
          ))}
          {roster.length === 0 && <li className="text-sm text-[var(--m-faint)] px-2 py-4">No contracted players.</li>}
        </ul>
      </div>
    </div>
  );
}

function RulesStep({
  mode,
  teamId,
  difficulty,
  setDifficulty,
  pace,
  setPace,
  purseCr,
  setPurseCr,
  roster,
}: {
  mode: ModeId;
  teamId: string;
  difficulty: CPUDifficulty;
  setDifficulty: (d: CPUDifficulty) => void;
  pace: AuctionPace;
  setPace: (p: AuctionPace) => void;
  purseCr: number;
  setPurseCr: (n: number) => void;
  roster: Player[];
}) {
  const DIFFS: { id: CPUDifficulty; desc: string }[] = [
    { id: 'Easy', desc: 'CPU GMs overpay rarely and fold early in bidding wars.' },
    { id: 'Normal', desc: 'Balanced valuations with realistic bidding wars.' },
    { id: 'Hard', desc: 'Sharper needs analysis; rivals target your shortlist.' },
    { id: 'Expert', desc: 'Ruthless, budget-perfect GMs. Every crore counts.' },
  ];
  const PACES: { id: AuctionPace; desc: string }[] = [
    { id: 'Normal', desc: '~1.3s per bid when auto-running' },
    { id: 'Fast', desc: '~0.7s per bid' },
    { id: 'Instant', desc: '~0.3s per bid' },
  ];
  const purse = mode === 'custom' ? purseCr * 100 : getLeaguePurseForSeason(START_SEASON);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
      <div className="space-y-4">
        <Panel title="CPU general managers">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DIFFS.map((d) => (
              <button key={d.id} data-active={difficulty === d.id} onClick={() => setDifficulty(d.id)} className="m-tile p-3" aria-pressed={difficulty === d.id}>
                <div className="m-display text-2xl">{d.id}</div>
                <div className="text-xs text-[var(--m-dim)] mt-1">{d.desc}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Auction pace">
          <div className="grid grid-cols-3 gap-2">
            {PACES.map((p) => (
              <button key={p.id} data-active={pace === p.id} onClick={() => setPace(p.id)} className="m-tile p-3" aria-pressed={pace === p.id}>
                <div className="m-display text-2xl">{p.id}</div>
                <div className="text-xs text-[var(--m-dim)] mt-1">{p.desc}</div>
              </button>
            ))}
          </div>
        </Panel>
        {mode === 'custom' && (
          <Panel title="League purse (all franchises)" right={<span className="font-display text-2xl">₹{purseCr} Cr</span>}>
            <input
              type="range"
              min={80}
              max={150}
              step={5}
              value={purseCr}
              onChange={(e) => setPurseCr(Number(e.target.value))}
              className="w-full accent-[var(--team-primary)]"
              aria-label="League purse in crores"
            />
            <div className="flex justify-between text-[11px] text-[var(--m-faint)] mt-1">
              <span>₹80 Cr</span>
              <span>Official ₹120 Cr</span>
              <span>₹150 Cr</span>
            </div>
          </Panel>
        )}
        <Panel title="Squad regulations">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile label="Squad size" value="18–25" />
            <StatTile label="Overseas cap" value="8" tone="gold" />
            <StatTile label={mode === 'irl' ? 'First window' : 'Max retentions'} value={mode === 'reset' ? '0' : mode === 'irl' ? 'Releases' : '6'} />
            <StatTile label="Purse" value={formatPrice(purse)} tone="green" />
          </div>
        </Panel>
      </div>

      <div className="m-panel overflow-hidden self-start shadow-[8px_8px_0_var(--m-ink)]">
        <div className="relative h-24 border-b border-[var(--m-ink)] text-[var(--m-ink)] overflow-hidden">
          <LineField seed={teamId} lines={14} accentEvery={4} className="absolute inset-0 w-full h-full" />
        </div>
        <div className="px-5 pt-4 flex items-center gap-3">
          <TeamCrest franchiseId={teamId} size="md" />
          <div>
            <div className="m-label">Your franchise</div>
            <div className="m-display text-3xl leading-none">{getTeamTheme(teamId).name}</div>
          </div>
        </div>
        <dl className="p-4 space-y-2 text-sm">
          {[
            ['Mode', MODES.find((m) => m.id === mode)?.name],
            ['CPU difficulty', difficulty],
            ['Auction pace', pace],
            ['Purse', formatPrice(purse)],
            ['Retention candidates', mode === 'reset' ? 'None — full reset' : `${roster.length} players`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-[var(--m-line)] pb-2 last:border-0">
              <dt className="text-[var(--m-dim)]">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="px-4 pb-4 text-xs text-[var(--m-faint)]">
          Next: {mode === 'reset' ? 'browse the full player pool, build a shortlist, then bid.' : mode === 'irl' ? 'choose who to release before the IPL 2027 mini auction (Dec 2026).' : 'decide which players to retain before the auction.'}
        </div>
      </div>
    </div>
  );
}
