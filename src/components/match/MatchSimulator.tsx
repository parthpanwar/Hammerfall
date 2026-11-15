'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import {
  createLiveMatchSession,
  simulateLiveDelivery,
  simulateLiveOver,
  simulateLiveInnings,
  LiveMatchSession,
} from '@/lib/engines/match-engine';
import { BattingAggression, BowlingStrategy } from '@/lib/engines/match/tactics';
import {
  Trophy,
  Play,
  FastForward,
  Award,
  Zap,
  Shield,
  Activity,
  Flame,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { Fixture, MatchResult } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';

interface MatchSimulatorProps {
  fixture: Fixture;
  onMatchComplete: (result: MatchResult) => void;
}

export function MatchSimulator({ fixture, onMatchComplete }: MatchSimulatorProps) {
  const {
    franchises,
    playingXIs,
    humanFranchiseId,
    updatePlayerSeasonStats,
  } = useGameStore();

  const team1 = franchises.find((f) => f.id === fixture.team1Id);
  const team2 = franchises.find((f) => f.id === fixture.team2Id);

  const team1XI = team1 ? playingXIs[team1.id] : null;
  const team2XI = team2 ? playingXIs[team2.id] : null;

  const [session, setSession] = useState<LiveMatchSession | null>(null);
  const [activeTab, setActiveTab] = useState<'center' | 'scorecard'>('center');
  const [selectedAggression, setSelectedAggression] = useState<BattingAggression>('Balanced');
  const [selectedStrategy, setSelectedStrategy] = useState<BowlingStrategy>('Stock');
  const [selectedNextBowlerIdx, setSelectedNextBowlerIdx] = useState<number | undefined>(undefined);

  const commentaryEndRef = useRef<HTMLDivElement>(null);

  // Initialize live match session
  useEffect(() => {
    if (team1 && team2 && team1XI && team2XI && !session) {
      const live = createLiveMatchSession(fixture, team1, team2, team1XI, team2XI, Date.now());
      setSession(live);
    }
  }, [fixture, team1, team2, team1XI, team2XI]);

  // Auto-scroll commentary feed to latest
  useEffect(() => {
    if (activeTab === 'center') {
      commentaryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.innings1.balls.length, session?.innings2.balls.length, activeTab]);

  if (!team1 || !team2 || !team1XI || !team2XI || !session) {
    return (
      <div className="terminal-card p-8 text-center text-[var(--m-dim)] font-bold rounded-xl">
        Initializing IPL Match Center...
      </div>
    );
  }

  const t1Theme = getTeamTheme(team1.id);
  const t2Theme = getTeamTheme(team2.id);

  const currentInnings = session.currentInningsIndex === 1 ? session.innings1 : session.innings2;
  const battingTeam = session.currentInningsIndex === 1 ? session.battingFirstTeam : session.bowlingFirstTeam;
  const bowlingTeam = session.currentInningsIndex === 1 ? session.bowlingFirstTeam : session.battingFirstTeam;

  const striker = currentInnings.batsmen[currentInnings.strikerIndex];
  const nonStriker = currentInnings.batsmen[currentInnings.nonStrikerIndex];
  const currentBowler = currentInnings.bowlers[currentInnings.currentBowlerIndex];

  // Helper to persist match completion
  const recordMatchOutcome = (finalSession: LiveMatchSession) => {
    if (!finalSession.result) return;

    // Update Player Season Stats
    const allBatsmen = [...finalSession.innings1.batsmen, ...finalSession.innings2.batsmen];
    const allBowlers = [...finalSession.innings1.bowlers, ...finalSession.innings2.bowlers];

    // Every player in both XIs gets exactly one appearance, batted or not.
    const appeared = new Set([...finalSession.team1XI.players, ...finalSession.team2XI.players]);
    const counted = new Set<string>();
    const appearance = (id: string) => {
      if (counted.has(id)) return 0;
      counted.add(id);
      return 1;
    };

    for (const b of allBatsmen) {
      if (b.balls > 0) {
        updatePlayerSeasonStats(b.playerId, {
          runs: b.runs,
          ballsFaced: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          innings: 1,
          matches: appearance(b.playerId),
        });
      }
    }

    for (const b of allBowlers) {
      if (b.overs > 0) {
        updatePlayerSeasonStats(b.playerId, {
          oversBowled: b.overs,
          wickets: b.wickets,
          runsConceded: b.runs,
          matches: appearance(b.playerId),
        });
      }
    }
    for (const id of appeared) if (!counted.has(id)) updatePlayerSeasonStats(id, { matches: appearance(id) });

    onMatchComplete(finalSession.result);
  };

  // Human Controls
  const handleNextBall = () => {
    if (session.isMatchCompleted) return;
    const cloned = { ...session };
    const { isMatchOver } = simulateLiveDelivery(cloned, {
      battingAggression: selectedAggression,
      bowlingStrategy: selectedStrategy,
      bowlerIndex: selectedNextBowlerIdx,
    });
    setSession({ ...cloned });
    setSelectedNextBowlerIdx(undefined);

    if (isMatchOver) {
      recordMatchOutcome(cloned);
    }
  };

  const handleNextOver = () => {
    if (session.isMatchCompleted) return;
    const cloned = { ...session };
    const isMatchOver = simulateLiveOver(cloned, {
      battingAggression: selectedAggression,
      bowlingStrategy: selectedStrategy,
      bowlerIndex: selectedNextBowlerIdx,
    });
    setSession({ ...cloned });
    setSelectedNextBowlerIdx(undefined);

    if (isMatchOver) {
      recordMatchOutcome(cloned);
    }
  };

  const handleFinishInnings = () => {
    if (session.isMatchCompleted) return;
    const cloned = { ...session };
    const isMatchOver = simulateLiveInnings(cloned);
    setSession({ ...cloned });
    setSelectedNextBowlerIdx(undefined);

    if (isMatchOver) {
      recordMatchOutcome(cloned);
    }
  };

  const handleInstantMatch = () => {
    if (session.isMatchCompleted) return;
    const cloned = { ...session };
    while (!cloned.isMatchCompleted) {
      simulateLiveDelivery(cloned);
    }
    setSession({ ...cloned });

    recordMatchOutcome(cloned);
  };

  const isHumanBatting = battingTeam.id === humanFranchiseId;
  const isHumanBowling = bowlingTeam.id === humanFranchiseId;

  // Eligible Bowlers for Next Over
  const eligibleBowlers = currentInnings.bowlers.filter(
    (b, idx) => b.overs < 4 && idx !== currentInnings.currentBowlerIndex
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Match Header / Banner */}
      <div className="terminal-card p-6 rounded-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--m-dim)] mb-4 pb-3 border-b border-[var(--m-line)] gap-2">
          <div className="flex items-center gap-2">
            <span className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30 font-bold">
              MATCH #{fixture.matchNumber}
            </span>
            <span className="text-[var(--m-text)] font-bold">{fixture.venue}</span>
            <span className="text-[var(--m-dim)]/50">•</span>
            <span className="text-[var(--m-dim)] font-mono">PITCH: {session.pitchCondition}</span>
          </div>

          <div className="flex items-center gap-2">
            {fixture.isPlayoff && (
              <span className="telemetry-badge-sm bg-[var(--m-red)]/15 text-[var(--m-red)] border border-[var(--m-red)]/30">
                {fixture.playoffType}
              </span>
            )}
            <div className="flex rounded-lg overflow-hidden border border-[var(--m-line)] text-xs">
              <button
                onClick={() => setActiveTab('center')}
                className={`px-3 py-1 font-bold transition-colors ${
                  activeTab === 'center'
                    ? 'bg-[var(--m-raised)] text-[var(--m-text)]'
                    : 'bg-[var(--m-panel)] text-[var(--m-dim)] hover:text-[var(--m-text)]'
                }`}
              >
                Match Center
              </button>
              <button
                onClick={() => setActiveTab('scorecard')}
                className={`px-3 py-1 font-bold transition-colors ${
                  activeTab === 'scorecard'
                    ? 'bg-[var(--m-raised)] text-[var(--m-text)]'
                    : 'bg-[var(--m-panel)] text-[var(--m-dim)] hover:text-[var(--m-text)]'
                }`}
              >
                Full Scorecard
              </button>
            </div>
          </div>
        </div>

        {/* Live Scorecard Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Team 1 Score */}
          <div
            className="p-4 rounded-xl border border-[var(--m-line)] transition-all bg-[var(--m-panel)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--m-text)]">{team1.name}</span>
                {session.toss.winnerId === team1.id && (
                  <span className="ml-2 text-[10px] font-bold uppercase text-[var(--m-gold)]">(Toss)</span>
                )}
              </div>
              {session.battingFirstTeam.id === team1.id && session.currentInningsIndex === 1 && (
                <span className="w-2 h-2 rounded-full bg-[var(--m-green)] animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-bold font-mono text-[var(--m-text)] mt-1 tabular-nums">
              {session.battingFirstTeam.id === team1.id
                ? `${session.innings1.score.runs}/${session.innings1.score.wickets}`
                : `${session.innings2.score.runs}/${session.innings2.score.wickets}`}
            </div>
            <div className="text-xs text-[var(--m-dim)] font-mono mt-0.5">
              {session.battingFirstTeam.id === team1.id
                ? `Overs: ${session.innings1.score.overs}.${session.innings1.score.balls} / 20`
                : `Overs: ${session.innings2.score.overs}.${session.innings2.score.balls} / 20`}
            </div>
          </div>

          {/* Center Match Status & Win Probability */}
          <div className="text-center space-y-2">
            {session.isMatchCompleted ? (
              <div className="p-3 bg-[var(--m-green)]/15 border border-[var(--m-green)]/30 text-[var(--m-green)] rounded-xl">
                <div className="text-xs font-bold uppercase tracking-wider">Match Completed</div>
                <div className="text-sm font-bold text-[var(--m-text)] mt-0.5">{session.result?.winMargin}</div>
                <div className="text-[11px] text-[var(--m-dim)] mt-0.5">
                  Player of Match: <strong className="text-[var(--m-text)]">{session.result?.playerOfMatch}</strong>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--m-gold)]">
                  Innings {session.currentInningsIndex} • Over {currentInnings.currentOver + 1}
                </div>
                {session.currentInningsIndex === 2 && currentInnings.target && (
                  <div className="text-sm font-mono font-bold text-[var(--m-text)] mt-1">
                    Need{' '}
                    <span className="text-[var(--m-gold)]">
                      {Math.max(0, currentInnings.target - currentInnings.score.runs)} runs
                    </span>{' '}
                    in{' '}
                    <span className="text-[var(--m-text)]">
                      {Math.max(0, 120 - (currentInnings.currentOver * 6 + currentInnings.legalBallsInOver))} balls
                    </span>
                  </div>
                )}
                <div className="text-xs font-mono text-[var(--m-dim)] mt-1">
                  CRR: {session.winProbability.currentRunRate}
                  {session.winProbability.requiredRunRate !== null && ` • RRR: ${session.winProbability.requiredRunRate}`}
                </div>

                {/* Win Probability Bar (F1 telemetry style) */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-bold font-mono text-[var(--m-dim)] mb-1">
                    <span>{battingTeam.shortName} {session.winProbability.battingTeamWinPct}%</span>
                    <span>{bowlingTeam.shortName} {session.winProbability.bowlingTeamWinPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--m-panel)] rounded-full overflow-hidden flex border border-[var(--m-line)]">
                    <div
                      className="h-full bg-[var(--m-accent-ink)] transition-all duration-300"
                      style={{ width: `${session.winProbability.battingTeamWinPct}%` }}
                    />
                    <div
                      className="h-full bg-[var(--m-gold)] transition-all duration-300"
                      style={{ width: `${session.winProbability.bowlingTeamWinPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Team 2 Score */}
          <div
            className="p-4 rounded-xl border border-[var(--m-line)] transition-all bg-[var(--m-panel)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--m-text)]">{team2.name}</span>
                {session.toss.winnerId === team2.id && (
                  <span className="ml-2 text-[10px] font-bold uppercase text-[var(--m-gold)]">(Toss)</span>
                )}
              </div>
              {session.battingFirstTeam.id === team2.id && session.currentInningsIndex === 1 && (
                <span className="w-2 h-2 rounded-full bg-[var(--m-green)] animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-bold font-mono text-[var(--m-text)] mt-1 tabular-nums">
              {session.battingFirstTeam.id === team2.id
                ? `${session.innings1.score.runs}/${session.innings1.score.wickets}`
                : `${session.innings2.score.runs}/${session.innings2.score.wickets}`}
            </div>
            <div className="text-xs text-[var(--m-dim)] font-mono mt-0.5">
              {session.battingFirstTeam.id === team2.id
                ? `Overs: ${session.innings1.score.overs}.${session.innings1.score.balls} / 20`
                : `Overs: ${session.innings2.score.overs}.${session.innings2.score.balls} / 20`}
            </div>
          </div>
        </div>

        {/* Toss Decision Bar */}
        <div className="mt-4 pt-3 border-t border-[var(--m-line)] text-xs text-[var(--m-dim)] font-medium">
          <span className="font-bold text-[var(--m-text)]">Toss: </span>
          {session.toss.reason}
        </div>
      </div>

      {activeTab === 'center' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Live Field Action, Active Batsmen/Bowler, Commentary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Striker, Non-Striker & Current Bowler Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Batters Card */}
              <div className="terminal-card p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--m-line)] pb-2">
                  <span className="text-xs font-bold uppercase text-[var(--m-text)] flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[var(--m-gold)]" /> Batting: {battingTeam.shortName}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--m-dim)]">
                    Partnership: {currentInnings.currentPartnership.runs} ({currentInnings.currentPartnership.balls}b)
                  </span>
                </div>

                {/* Striker */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--m-green)] font-bold">▶</span>
                    <span className="font-bold text-[var(--m-text)]">{striker?.playerName || 'Batsman'}</span>
                    <span className="text-[10px] text-[var(--m-dim)] font-mono">*{striker?.isOnStrike ? '(Strike)' : ''}</span>
                  </div>
                  <div className="font-mono font-bold text-[var(--m-text)]">
                    <span className="text-[var(--m-gold)] text-sm tabular-nums">{striker?.runs || 0}</span>
                    <span className="text-[var(--m-dim)] text-xs"> ({striker?.balls || 0})</span>
                    <span className="text-[var(--m-dim)] text-[10px] ml-2 font-normal">
                      4s:{striker?.fours || 0} 6s:{striker?.sixes || 0} SR:{striker?.strikeRate || 0}
                    </span>
                  </div>
                </div>

                {/* Non-Striker */}
                <div className="flex items-center justify-between text-xs opacity-75">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--m-dim)] font-bold">▷</span>
                    <span className="font-medium text-[var(--m-text)]">{nonStriker?.playerName || 'Batsman'}</span>
                  </div>
                  <div className="font-mono text-[var(--m-text)]">
                    <span className="font-bold tabular-nums">{nonStriker?.runs || 0}</span>
                    <span className="text-[var(--m-dim)] text-xs"> ({nonStriker?.balls || 0})</span>
                    <span className="text-[var(--m-dim)] text-[10px] ml-2 font-normal">
                      4s:{nonStriker?.fours || 0} 6s:{nonStriker?.sixes || 0} SR:{nonStriker?.strikeRate || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bowler Card */}
              <div className="terminal-card p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--m-line)] pb-2">
                  <span className="text-xs font-bold uppercase text-[var(--m-text)] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[var(--m-accent-ink)]" /> Bowling: {bowlingTeam.shortName}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--m-dim)]">
                    Overs Left: {Math.max(0, 4 - (currentBowler?.overs || 0))}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[var(--m-text)]">{currentBowler?.playerName || 'Bowler'}</span>
                    {currentInnings.isFreeHitActive && (
                      <span className="ml-2 telemetry-badge-sm bg-[var(--m-gold)]/20 text-[var(--m-gold)] border border-[var(--m-gold)]/40 text-[9px]">
                        FREE HIT
                      </span>
                    )}
                  </div>
                  <div className="font-mono font-bold text-[var(--m-text)]">
                    <span className="text-[var(--m-accent-ink)] text-sm tabular-nums">
                      {currentBowler?.wickets || 0}-{currentBowler?.runs || 0}
                    </span>
                    <span className="text-[var(--m-dim)] text-xs ml-1">
                      ({currentBowler?.overs || 0}.{currentInnings.legalBallsInOver} ov)
                    </span>
                    <span className="text-[var(--m-dim)] text-[10px] ml-2 font-normal">
                      Econ: {currentBowler?.economy || 0}
                    </span>
                  </div>
                </div>

                {/* Over Deliveries Rail */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--m-dim)] mb-1">
                    THIS OVER / RECENT BALLS:
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {currentInnings.recentDeliveries.length === 0 ? (
                      <span className="text-xs font-mono text-[var(--m-dim)]/60">Waiting for first ball...</span>
                    ) : (
                      currentInnings.recentDeliveries.slice(-10).map((b, idx) => (
                        <span
                          key={idx}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold border ${
                            b.isWicket
                              ? 'bg-[var(--m-red)]/20 text-[var(--m-red)] border-[var(--m-red)]/40'
                              : b.text === '6'
                              ? 'bg-[var(--m-green)]/20 text-[var(--m-green)] border-[var(--m-green)]/40'
                              : b.text === '4'
                              ? 'bg-[var(--m-gold)]/20 text-[var(--m-gold)] border-[var(--m-gold)]/40'
                              : b.isExtra
                              ? 'bg-[var(--m-accent-ink)]/20 text-[var(--m-accent-ink)] border-[var(--m-accent-ink)]/40'
                              : b.text === '0'
                              ? 'bg-[var(--m-raised)] text-[var(--m-dim)] border-[var(--m-line)]'
                              : 'bg-[var(--m-raised)] text-[var(--m-text)] border-[var(--m-line)]'
                          }`}
                        >
                          {b.text}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Commentary Feed */}
            <div className="terminal-card p-4 rounded-xl flex flex-col h-64 overflow-hidden">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--m-text)] border-b border-[var(--m-line)] pb-2 mb-2 flex items-center justify-between">
                <span>Ball-by-Ball Telemetry Feed</span>
                <span className="text-[10px] font-mono text-[var(--m-dim)]">Live Match Engine</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs">
                {currentInnings.balls.length === 0 ? (
                  <div className="text-[var(--m-dim)]/60 text-center py-10 font-medium">
                    Match ready to start. Select tactics and bowl delivery.
                  </div>
                ) : (
                  currentInnings.balls.map((ball, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border ${
                        ball.outcome === 'Wicket'
                          ? 'bg-[var(--m-red)]/10 border-[var(--m-red)]/30 text-[var(--m-red)]'
                          : ball.runs >= 4
                          ? 'bg-[var(--m-gold)]/10 border-[var(--m-gold)]/30 text-[var(--m-gold)]'
                          : 'bg-[var(--m-raised)] border-[var(--m-line)] text-[var(--m-text)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold mb-0.5">
                        <span className="text-[var(--m-accent-ink)]">
                          {ball.over}.{ball.ball}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                            ball.outcome === 'Wicket'
                              ? 'bg-[var(--m-red)] text-white'
                              : ball.runs === 6
                              ? 'bg-[var(--m-green)] text-white'
                              : ball.runs === 4
                              ? 'bg-[var(--m-gold)] text-white font-extrabold'
                              : 'bg-[var(--m-panel)] text-[var(--m-dim)]'
                          }`}
                        >
                          {ball.outcome === 'Wicket' ? 'WICKET' : `${ball.runs} RUNS`}
                        </span>
                      </div>
                      <div className="text-[var(--m-text)] font-sans text-xs">{ball.commentary}</div>
                    </div>
                  ))
                )}
                <div ref={commentaryEndRef} />
              </div>
            </div>
          </div>

          {/* Right Col: Tactical Controls & Simulation Action Bar */}
          <div className="space-y-6">
            {/* Tactical Management Box */}
            <div className="terminal-card p-5 rounded-xl space-y-5">
              <div className="flex items-center gap-2 border-b border-[var(--m-line)] pb-2">
                <Zap className="w-4 h-4 text-[var(--m-gold)]" />
                <h3 className="text-sm font-bold uppercase text-[var(--m-text)] tracking-wide font-heading">
                  Tactical Match Management
                </h3>
              </div>

              {/* Batting Aggression Selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--m-dim)] block mb-2">
                  Batting Aggression {isHumanBatting ? '(Your Team)' : '(CPU Strategy)'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  {(['Anchor', 'Balanced', 'Attack', 'Blitz'] as BattingAggression[]).map((agg) => (
                    <button
                      key={agg}
                      onClick={() => setSelectedAggression(agg)}
                      className={`p-2 rounded-lg border transition-all text-center ${
                        selectedAggression === agg
                          ? 'bg-[var(--m-raised)] text-[var(--m-gold)] border-[var(--m-gold)]'
                          : 'bg-[var(--m-panel)] text-[var(--m-dim)] border-[var(--m-line)] hover:text-[var(--m-text)]'
                      }`}
                    >
                      {agg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bowling Strategy Selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--m-dim)] block mb-2">
                  Bowling Tactics {isHumanBowling ? '(Your Team)' : '(CPU Strategy)'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  {(['Stock', 'Yorker', 'Bouncer', 'SlowerBall', 'WideLine'] as BowlingStrategy[]).map((strat) => (
                    <button
                      key={strat}
                      onClick={() => setSelectedStrategy(strat)}
                      className={`p-2 rounded-lg border transition-all text-center ${
                        selectedStrategy === strat
                          ? 'bg-[var(--m-raised)] text-[var(--m-accent-ink)] border-[var(--m-accent-ink)]'
                          : 'bg-[var(--m-panel)] text-[var(--m-dim)] border-[var(--m-line)] hover:text-[var(--m-text)]'
                      }`}
                    >
                      {strat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Next Bowler */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--m-dim)] block mb-2">
                  Choose Next Bowler
                </label>
                <select
                  value={selectedNextBowlerIdx ?? ''}
                  onChange={(e) => setSelectedNextBowlerIdx(e.target.value ? Number(e.target.value) : undefined)}
                  className="terminal-input w-full p-2.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  <option value="">CPU Recommended Rotation</option>
                  {eligibleBowlers.map((b) => {
                    const originalIdx = currentInnings.bowlers.findIndex((cb) => cb.playerId === b.playerId);
                    return (
                      <option key={b.playerId} value={originalIdx}>
                        {b.playerName} ({b.overs}/4 ov • {b.wickets}-{b.runs} • Econ {b.economy})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Simulation Action Controls */}
            <div className="terminal-card p-5 rounded-xl space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--m-dim)] border-b border-[var(--m-line)] pb-2">
                Simulation Speed Controls
              </div>

              <div className="space-y-2">
                <button
                  disabled={session.isMatchCompleted}
                  onClick={handleNextBall}
                  className="w-full sports-btn py-3 px-4 rounded-lg font-bold text-xs uppercase bg-[var(--m-green)] text-white flex items-center justify-center gap-2 hover:bg-[var(--m-green)]/90 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Bowl Next Ball</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={session.isMatchCompleted}
                    onClick={handleNextOver}
                    className="sports-btn py-2.5 px-3 rounded-lg font-bold text-xs uppercase bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-gold)] flex items-center justify-center gap-1.5 hover:bg-[var(--m-line)] disabled:opacity-50"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Next Over</span>
                  </button>

                  <button
                    disabled={session.isMatchCompleted}
                    onClick={handleFinishInnings}
                    className="sports-btn py-2.5 px-3 rounded-lg font-bold text-xs uppercase bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-accent-ink)] flex items-center justify-center gap-1.5 hover:bg-[var(--m-line)] disabled:opacity-50"
                  >
                    <span>Finish Innings</span>
                  </button>
                </div>

                <button
                  disabled={session.isMatchCompleted}
                  onClick={handleInstantMatch}
                  className="w-full sports-btn py-2.5 px-4 rounded-lg font-bold text-xs uppercase bg-[var(--m-panel)] text-[var(--m-dim)] border border-[var(--m-line)] flex items-center justify-center gap-2 hover:text-[var(--m-text)] hover:bg-[var(--m-raised)] disabled:opacity-50"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Instant Simulate Match</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Full Scorecard View */
        <div className="space-y-6">
          {/* Innings 1 Scorecard */}
          <div className="terminal-card p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--m-line)] pb-3">
              <h3 className="text-base font-bold uppercase text-[var(--m-gold)] font-heading">
                1st Innings: {session.innings1.battingTeamName}
              </h3>
              <span className="font-mono text-base font-bold text-[var(--m-text)] tabular-nums">
                {session.innings1.score.runs}/{session.innings1.score.wickets} ({session.innings1.score.overs}.
                {session.innings1.score.balls} Overs)
              </span>
            </div>

            {/* Batting Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)]">
                    <th className="py-2">Batter</th>
                    <th className="py-2">Dismissal</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">B</th>
                    <th className="py-2 text-right">4s</th>
                    <th className="py-2 text-right">6s</th>
                    <th className="py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--m-line)]/50 text-[var(--m-text)]">
                  {session.innings1.batsmen.map((b) => (
                    <tr key={b.playerId}>
                      <td className="py-2 font-bold">{b.playerName}</td>
                      <td className="py-2 text-[var(--m-dim)] text-[11px]">{b.dismissalText}</td>
                      <td className="py-2 text-right font-bold text-[var(--m-gold)] tabular-nums">{b.runs}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.balls}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.fours}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.sixes}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.strikeRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bowling Table */}
            <div className="overflow-x-auto pt-4 border-t border-[var(--m-line)]">
              <div className="text-xs font-bold uppercase text-[var(--m-accent-ink)] mb-2">Bowling Spell</div>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)]">
                    <th className="py-2">Bowler</th>
                    <th className="py-2 text-right">O</th>
                    <th className="py-2 text-right">M</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">W</th>
                    <th className="py-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--m-line)]/50 text-[var(--m-text)]">
                  {session.innings1.bowlers.map((bw) => (
                    <tr key={bw.playerId}>
                      <td className="py-2 font-bold">{bw.playerName}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.overs}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.maidens}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.runs}</td>
                      <td className="py-2 text-right font-bold text-[var(--m-green)] tabular-nums">{bw.wickets}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.economy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Innings 2 Scorecard */}
          <div className="terminal-card p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--m-line)] pb-3">
              <h3 className="text-base font-bold uppercase text-[var(--m-gold)] font-heading">
                2nd Innings: {session.innings2.battingTeamName}
              </h3>
              <span className="font-mono text-base font-bold text-[var(--m-text)] tabular-nums">
                {session.innings2.score.runs}/{session.innings2.score.wickets} ({session.innings2.score.overs}.
                {session.innings2.score.balls} Overs)
              </span>
            </div>

            {/* Batting Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)]">
                    <th className="py-2">Batter</th>
                    <th className="py-2">Dismissal</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">B</th>
                    <th className="py-2 text-right">4s</th>
                    <th className="py-2 text-right">6s</th>
                    <th className="py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--m-line)]/50 text-[var(--m-text)]">
                  {session.innings2.batsmen.map((b) => (
                    <tr key={b.playerId}>
                      <td className="py-2 font-bold">{b.playerName}</td>
                      <td className="py-2 text-[var(--m-dim)] text-[11px]">{b.dismissalText}</td>
                      <td className="py-2 text-right font-bold text-[var(--m-gold)] tabular-nums">{b.runs}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.balls}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.fours}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.sixes}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{b.strikeRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bowling Table */}
            <div className="overflow-x-auto pt-4 border-t border-[var(--m-line)]">
              <div className="text-xs font-bold uppercase text-[var(--m-accent-ink)] mb-2">Bowling Spell</div>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)]">
                    <th className="py-2">Bowler</th>
                    <th className="py-2 text-right">O</th>
                    <th className="py-2 text-right">M</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">W</th>
                    <th className="py-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--m-line)]/50 text-[var(--m-text)]">
                  {session.innings2.bowlers.map((bw) => (
                    <tr key={bw.playerId}>
                      <td className="py-2 font-bold">{bw.playerName}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.overs}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.maidens}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.runs}</td>
                      <td className="py-2 text-right font-bold text-[var(--m-green)] tabular-nums">{bw.wickets}</td>
                      <td className="py-2 text-right text-[var(--m-dim)] tabular-nums">{bw.economy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
