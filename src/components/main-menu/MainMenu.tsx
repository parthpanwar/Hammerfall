'use client';

// ============================================================
// IPL DYNASTY — Title screen + New Franchise wizard (editorial, team-themed)
// Home → Mode → Franchise → League Rules → Retentions
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { FRANCHISES } from '@/lib/data/franchises';
import { GLOBAL_PLAYERS } from '@/lib/data/players';
import { ChevronRight, ChevronLeft, Play, Plus, FolderOpen, Database, Settings, RotateCcw, Trophy, Sliders, Calendar, Info, X } from 'lucide-react';
import { DIFFICULTY_GUIDE, difficultyGuide } from '@/lib/data/difficulty-guide';
import { TeamEyes } from '@/components/fx/TeamEyes';
import { IsoPyramid } from '@/components/fx/IsoPyramid';
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

type View = 'home' | 'menu' | 'mode' | 'team' | 'rules';
type ModeId = 'career' | 'irl' | 'reset' | 'custom';

/** Every new game starts from the real IPL 2026 squads, heading into IPL 2027. */
const START_SEASON = 2027;

const MODES: { id: ModeId; name: string; tag: string; desc: string; bullets: string[]; icon: React.ElementType }[] = [
  {
    id: 'career',
    name: 'Franchise Career',
    tag: 'Own cycle',
    desc: 'Two full auction cycles from today’s real squads: retain up to 6 before each mega auction, with two mini auctions after each.',
    bullets: ['Real IPL 2026 squads', 'Mega auctions before IPL 2027 and 2030', '6 seasons · 2 mega + 4 mini'],
    icon: Trophy,
  },
  {
    id: 'irl',
    name: 'Real IPL Timeline',
    tag: 'Follows IRL',
    desc: 'Mirror the real calendar. IPL 2027 is the last mini auction of the 2025–27 cycle; the mega auction comes before IPL 2028.',
    bullets: ['Release Day first — no retentions', 'Mega auctions before IPL 2028 and 2031', '7 seasons · IPL 2027–2033'],
    icon: Calendar,
  },
  {
    id: 'reset',
    name: 'Full Reset Draft',
    tag: 'Clean slate',
    desc: 'Every franchise releases its entire squad for a mega auction — then lives with what it built until the second mega auction three seasons later.',
    bullets: ['No retentions in year 1', 'Every star in the mega pool', '6 seasons · 2 mega + 4 mini'],
    icon: RotateCcw,
  },
  {
    id: 'custom',
    name: 'Custom Auction Lab',
    tag: 'Sandbox',
    desc: 'Tune the league purse and difficulty, then play two full auction cycles under your own numbers.',
    bullets: ['Purse ₹80–150 Cr', 'Any difficulty', '6 seasons · 2 mega + 4 mini'],
    icon: Sliders,
  },
];

/** A mode's auction calendar, grouped into cycles: each mega auction opens a cycle, minis follow. */
function cyclePreview(mode: ModeId) {
  const settings = { auctionType: (mode === 'irl' ? 'Mini' : 'Mega') as AuctionType, startingSeason: START_SEASON, cycleMode: (mode === 'irl' ? 'irl' : 'custom') as CycleMode };
  const n = campaignLength(settings);
  const cycles: { seasons: number[]; mega: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const season = START_SEASON + i;
    const mega = auctionTypeFor(season, settings) === 'Mega';
    if (mega || !cycles.length) cycles.push({ seasons: [season], mega });
    else cycles[cycles.length - 1].seasons.push(season);
  }
  return cycles.map((c) => {
    const first = c.seasons[0];
    const last = c.seasons[c.seasons.length - 1];
    const minis = c.mega ? c.seasons.length - 1 : c.seasons.length;
    const steps = [
      c.mega && `Mega auction (Nov ${first - 1}): retain up to 6, the rest go back in the pool`,
      minis > 0 &&
        (c.mega
          ? `Then ${minis} mini auction${minis > 1 ? 's' : ''}: squads stay, release a few and top up`
          : `${minis > 1 ? `${minis} mini auctions` : 'Mini auction'} (Dec ${first - 1}): squads stay, release a few and top up`),
    ].filter(Boolean) as string[];
    return {
      mega: c.mega,
      label: c.mega ? 'Mega cycle' : 'Current cycle ends',
      years: first === last ? `IPL ${first}` : `IPL ${first}–${String(last).slice(2)}`,
      seasons: c.seasons.length,
      steps,
    };
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
    (view === 'home' ? null : view === 'menu' ? (hasActiveCareer ? humanFranchiseId : null) : view === 'mode' ? null : teamId);

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

      {/* Top bar (the title screen stands alone) */}
      {view !== 'home' && (
      <div className="border-b border-[var(--m-ink)] transition-colors duration-500">
        <div className="max-w-[1440px] mx-auto h-11 px-4 sm:px-6 flex items-center gap-5 text-sm">
          <button className="flex items-center gap-2 font-semibold" onClick={() => goto('menu')}>
            <span className="w-5 h-5 rounded-full border border-[var(--m-ink)] grid place-items-center" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--m-accent)]" />
            </span>
            IPL Dynasty
          </button>
          <nav className={`${view === 'menu' ? 'hidden' : 'hidden sm:flex'} items-center gap-4 text-[var(--m-dim)]`} aria-label="Main">
            <button className="hover:text-[var(--m-text)]" onClick={() => goto('mode')}>New franchise</button>
            <button className="hover:text-[var(--m-text)]" onClick={() => setShowSaves(true)}>Load</button>
            <button className="hover:text-[var(--m-text)]" onClick={() => setShowDb(true)}>Players</button>
            <button className="hover:text-[var(--m-text)]" onClick={() => setShowSettings(true)}>Settings</button>
          </nav>
          <span className="ml-auto text-[var(--m-faint)] hidden md:inline">IPL {START_SEASON} offseason</span>
        </div>
      </div>
      )}

      {view === 'home' ? (
        <HomeScreen onBegin={() => goto('menu')} />
      ) : view === 'menu' ? (
        <MenuScreen
          hasActiveCareer={hasActiveCareer}
          activeLabel={
            activeTeam
              ? `${activeTeam.name} · Season ${currentSeason} · ${PHASE_LABEL[lastActivePhase || 'Retention'] || 'Offseason'}`
              : ''
          }
          savedCount={savedCount}
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

          <div className="flex-1 m-rise" key={view}>
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
              onClick={() => goto(view === 'mode' ? 'menu' : view === 'team' ? 'mode' : 'team')}
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
// Title screen: one statement, one button. Fits the viewport, never scrolls.
// ------------------------------------------------------------
function HomeScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute inset-0 text-[var(--m-ink)] opacity-[0.22]" aria-hidden>
        <LineField seed="house" lines={48} accentEvery={9} className="w-full h-full m-drift" />
      </div>
      <TeamEyes className="absolute top-6 sm:top-8 left-0 right-0 text-left" />
      <div className="relative flex flex-col items-center">
        <span className="m-rise m-label tracking-[0.3em]">IPL {START_SEASON} · Offseason</span>
        <h1 className="m-rise m-display text-[4.5rem] sm:text-[8rem] leading-[0.9] mt-5" style={{ animationDelay: '80ms' }}>
          IPL Dynasty
        </h1>
        <p className="m-rise text-[var(--m-dim)] mt-6 max-w-md leading-relaxed text-lg" style={{ animationDelay: '160ms' }}>
          Ten franchises. One auction room. Build the squad, then live with every rupee.
        </p>
        <MButton
          variant="primary"
          size="xl"
          onClick={onBegin}
          className="group m-rise mt-12 min-w-[220px] justify-center"
          style={{ animationDelay: '260ms' }}
          autoFocus
        >
          Begin <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
        </MButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Menu: shown after Begin.
// ------------------------------------------------------------
function MenuScreen({
  hasActiveCareer,
  activeLabel,
  savedCount,
  onContinue,
  onNew,
  onLoad,
  onDb,
  onSettings,
}: {
  hasActiveCareer: boolean;
  activeLabel: string;
  savedCount: number;
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
  ].filter(Boolean) as { key: string; label: string; sub: string; icon: React.ElementType; onClick: () => void }[];

  return (
    <div className="flex-1 flex items-center justify-center gap-16 xl:gap-28 px-6 py-10">
      <div className="hidden lg:block w-[300px] m-rise" aria-hidden>
        <IsoPyramid mode="idle" className="w-full h-auto overflow-visible" />
        <div className="mx-auto mt-3 h-3 w-3/4 rounded-[50%] bg-[var(--m-ink)] opacity-10 blur-[2px]" />
        <div className="text-center text-xs text-[var(--m-faint)] mt-4">Ten franchises. One dynasty.</div>
      </div>
      <div className="w-full max-w-lg">
        <nav className="flex flex-col" aria-label="Main menu">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                onClick={it.onClick}
                className="group m-rise text-left grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-4 py-5 border-t border-[var(--m-line)] last:border-b"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Icon className="w-5 h-5 text-[var(--m-faint)] group-hover:text-[var(--m-text)] transition-colors" strokeWidth={1.5} />
                <span className="min-w-0">
                  <span className="block m-display text-[2rem] leading-none">{it.label}</span>
                  <span className="block text-xs truncate text-[var(--m-faint)] mt-1.5">{it.sub}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-[var(--m-dim)] group-hover:text-[var(--m-text)] group-hover:translate-x-0.5 transition" />
              </button>
            );
          })}
        </nav>
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-[var(--m-dim)]">
          <button className="inline-flex items-center gap-1.5 hover:text-[var(--m-text)]" onClick={onDb}>
            <Database className="w-4 h-4" strokeWidth={1.5} /> Player database
          </button>
          <button className="inline-flex items-center gap-1.5 hover:text-[var(--m-text)]" onClick={onSettings}>
            <Settings className="w-4 h-4" strokeWidth={1.5} /> Settings
          </button>
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
                  <Icon className="w-5 h-5 fx-wiggle-on-hover" strokeWidth={1.5} />
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
        <div className="text-sm font-semibold mb-2">Your auction calendar · {cycle.reduce((n, c) => n + c.seasons, 0)} seasons</div>
        <div className={`grid grid-cols-1 ${cycle.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} border-t border-l border-[var(--m-ink)]`} aria-label="Campaign cycles">
          {cycle.map((c, i) => (
            <div key={c.years} className="border-r border-b border-[var(--m-ink)] px-5 py-4 bg-[var(--m-panel)]">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] text-[var(--m-faint)]">{c.mega ? `Cycle ${i + 1}` : c.label}</span>
                <span className="m-display text-2xl">{c.years}</span>
                <span className="text-[11px] text-[var(--m-dim)] ml-auto">
                  {c.seasons} season{c.seasons > 1 ? 's' : ''}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {c.steps.map((st) => (
                  <li key={st} className="text-xs text-[var(--m-dim)] flex gap-2 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--m-accent)] shrink-0" /> {st}
                  </li>
                ))}
              </ul>
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

/** Difficulty tiles, each with an (i) button that explains the level with an example. */
export function DifficultyPicker({ value, onChange }: { value: CPUDifficulty; onChange: (d: CPUDifficulty) => void }) {
  const [infoFor, setInfoFor] = useState<CPUDifficulty | null>(null);
  const info = infoFor ? difficultyGuide(infoFor) : null;
  React.useEffect(() => {
    if (!infoFor) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInfoFor(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoFor]);
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {DIFFICULTY_GUIDE.map((d) => (
          <div key={d.id} className="relative">
            <button
              data-active={value === d.id}
              onClick={() => onChange(d.id)}
              className="m-tile p-3 pr-9 w-full h-full text-left"
              aria-pressed={value === d.id}
            >
              <div className="m-display text-2xl">{d.id}</div>
              <div className="text-xs text-[var(--m-dim)] mt-1">{d.short}</div>
            </button>
            <button
              onClick={() => setInfoFor(infoFor === d.id ? null : d.id)}
              aria-expanded={infoFor === d.id}
              aria-controls="difficulty-info"
              aria-label={`What does ${d.id} mean?`}
              title={`What does ${d.id} mean?`}
              className={`absolute top-2 right-2 w-6 h-6 rounded-full border grid place-items-center transition-colors ${
                infoFor === d.id
                  ? 'bg-[var(--m-ink)] text-[var(--m-bg)] border-[var(--m-ink)]'
                  : 'border-[var(--m-line-strong)] text-[var(--m-dim)] hover:text-[var(--m-text)] hover:border-[var(--m-ink)]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {info && (
        <div id="difficulty-info" role="region" aria-label={`${info.id} difficulty`} className="m-rise mt-3 border border-[var(--m-ink)] bg-[var(--m-raised)] rounded-md px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="m-display text-2xl">{info.id}</div>
            <button className="text-xs text-[var(--m-dim)] hover:text-[var(--m-text)] inline-flex items-center gap-1" onClick={() => setInfoFor(null)}>
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>
          <dl className="mt-2 grid gap-2 text-sm">
            {([
              ['Auction', info.auction],
              ['Trades', info.trades],
              ['Retentions', info.retentions],
            ] as const).map(([k, v]) => (
              <div key={k} className="grid sm:grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-[var(--m-dim)] leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm border-t border-[var(--m-line)] pt-3">
            <span className="font-semibold">Example: </span>
            <span className="text-[var(--m-dim)]">{info.example}</span>
          </p>
        </div>
      )}
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
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
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
