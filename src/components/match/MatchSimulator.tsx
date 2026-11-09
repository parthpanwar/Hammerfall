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
      <div className="neo-box p-8 text-center text-zinc-400 font-bold bg-zinc-950 rounded-xl">
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

    for (const b of allBatsmen) {
      if (b.balls > 0) {
        updatePlayerSeasonStats(b.playerId, {
          runs: b.runs,
          ballsFaced: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          innings: 1,
          matches: 1,
        });
      }
    }

    for (const b of allBowlers) {
      if (b.overs > 0) {
        updatePlayerSeasonStats(b.playerId, {
          oversBowled: b.overs,
          wickets: b.wickets,
          runsConceded: b.runs,
        });
      }
    }

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

  // Eligible Bowlers for Next Over (overs < 4 and not current bowler)
  const eligibleBowlers = currentInnings.bowlers.filter(
    (b, idx) => b.overs < 4 && idx !== currentInnings.currentBowlerIndex
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Match Header / Banner */}
      <div className="neo-box-lg bg-zinc-950 p-6 rounded-3xl relative overflow-hidden border-2 border-black">
        <div className="flex flex-wrap items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-4 pb-3 border-b-2 border-black gap-2">
          <div className="flex items-center gap-2">
            <span className="neo-badge px-2.5 py-0.5 rounded bg-amber-400 text-black text-xs font-black">
              MATCH #{fixture.matchNumber}
            </span>
            <span>{fixture.venue}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-300 font-mono">PITCH: {session.pitchCondition}</span>
          </div>

          <div className="flex items-center gap-2">
            {fixture.isPlayoff && (
              <span className="neo-badge px-2.5 py-0.5 rounded bg-red-500 text-white text-xs font-black">
                {fixture.playoffType}
              </span>
            )}
            <div className="flex rounded-lg overflow-hidden border-2 border-black text-xs">
              <button
                onClick={() => setActiveTab('center')}
                className={`px-3 py-1 font-black ${
                  activeTab === 'center' ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                MATCH CENTER
              </button>
              <button
                onClick={() => setActiveTab('scorecard')}
                className={`px-3 py-1 font-black ${
                  activeTab === 'scorecard' ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                FULL SCORECARD
              </button>
            </div>
          </div>
        </div>

        {/* Live Scorecard Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Team 1 Score */}
          <div
            className="p-4 rounded-2xl border-2 border-black transition-all"
            style={{
              backgroundColor: session.battingFirstTeam.id === team1.id ? t1Theme.surface : '#09090b',
              borderColor: session.battingFirstTeam.id === team1.id ? t1Theme.accent : '#27272a',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{team1.name}</span>
                {session.toss.winnerId === team1.id && (
                  <span className="ml-2 text-[10px] font-black uppercase text-amber-400">(Toss)</span>
                )}
              </div>
              {session.battingFirstTeam.id === team1.id && session.currentInningsIndex === 1 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-black font-mono text-white mt-1">
              {session.battingFirstTeam.id === team1.id
                ? `${session.innings1.score.runs}/${session.innings1.score.wickets}`
                : `${session.innings2.score.runs}/${session.innings2.score.wickets}`}
            </div>
            <div className="text-xs text-zinc-400 font-mono mt-0.5">
              {session.battingFirstTeam.id === team1.id
                ? `Overs: ${session.innings1.score.overs}.${session.innings1.score.balls} / 20`
                : `Overs: ${session.innings2.score.overs}.${session.innings2.score.balls} / 20`}
            </div>
          </div>

          {/* Center Match Status & Win Probability */}
          <div className="text-center space-y-2">
            {session.isMatchCompleted ? (
              <div className="neo-box p-3 bg-amber-400 text-black rounded-xl">
                <div className="text-xs font-black uppercase tracking-wider">MATCH COMPLETED</div>
                <div className="text-sm font-black mt-0.5">{session.result?.winMargin}</div>
                <div className="text-[11px] font-bold text-zinc-900 mt-0.5">
                  Player of Match: <strong>{session.result?.playerOfMatch}</strong>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-amber-400">
                  INNINGS {session.currentInningsIndex} • OVER {currentInnings.currentOver + 1}
                </div>
                {session.currentInningsIndex === 2 && currentInnings.target && (
                  <div className="text-sm font-mono font-black text-zinc-200 mt-1">
                    Need{' '}
                    <span className="text-amber-400 font-bold">
                      {Math.max(0, currentInnings.target - currentInnings.score.runs)} runs
                    </span>{' '}
                    in{' '}
                    <span className="text-zinc-100">
                      {Math.max(0, 120 - (currentInnings.currentOver * 6 + currentInnings.legalBallsInOver))} balls
                    </span>
                  </div>
                )}
                <div className="text-xs font-mono text-zinc-400 mt-1">
                  CRR: {session.winProbability.currentRunRate}
                  {session.winProbability.requiredRunRate !== null && ` • RRR: ${session.winProbability.requiredRunRate}`}
                </div>

                {/* Win Probability Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-black font-mono text-zinc-400 mb-1">
                    <span>{battingTeam.shortName} {session.winProbability.battingTeamWinPct}%</span>
                    <span>{bowlingTeam.shortName} {session.winProbability.bowlingTeamWinPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex border border-black">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${session.winProbability.battingTeamWinPct}%` }}
                    />
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${session.winProbability.bowlingTeamWinPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Team 2 Score */}
          <div
            className="p-4 rounded-2xl border-2 border-black transition-all"
            style={{
              backgroundColor: session.battingFirstTeam.id === team2.id ? t2Theme.surface : '#09090b',
              borderColor: session.battingFirstTeam.id === team2.id ? t2Theme.accent : '#27272a',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{team2.name}</span>
                {session.toss.winnerId === team2.id && (
                  <span className="ml-2 text-[10px] font-black uppercase text-amber-400">(Toss)</span>
                )}
              </div>
              {session.battingFirstTeam.id === team2.id && session.currentInningsIndex === 1 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-black font-mono text-white mt-1">
              {session.battingFirstTeam.id === team2.id
                ? `${session.innings1.score.runs}/${session.innings1.score.wickets}`
                : `${session.innings2.score.runs}/${session.innings2.score.wickets}`}
            </div>
            <div className="text-xs text-zinc-400 font-mono mt-0.5">
              {session.battingFirstTeam.id === team2.id
                ? `Overs: ${session.innings1.score.overs}.${session.innings1.score.balls} / 20`
                : `Overs: ${session.innings2.score.overs}.${session.innings2.score.balls} / 20`}
            </div>
          </div>
        </div>

        {/* Toss Decision Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-400 font-medium">
          <span className="font-bold text-zinc-300">Toss: </span>
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
              <div className="neo-box bg-zinc-950 p-4 rounded-2xl border-2 border-black space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-black uppercase text-zinc-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" /> BATTING: {battingTeam.shortName}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Partnership: {currentInnings.currentPartnership.runs} ({currentInnings.currentPartnership.balls}b)
                  </span>
                </div>

                {/* Striker */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-black">▶</span>
                    <span className="font-bold text-white">{striker?.playerName || 'Batsman'}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">*{striker?.isOnStrike ? '(Strike)' : ''}</span>
                  </div>
                  <div className="font-mono font-bold text-zinc-200">
                    <span className="text-amber-400 font-black text-sm">{striker?.runs || 0}</span>
                    <span className="text-zinc-500 text-xs"> ({striker?.balls || 0})</span>
                    <span className="text-zinc-500 text-[10px] ml-2 font-normal">
                      4s:{striker?.fours || 0} 6s:{striker?.sixes || 0} SR:{striker?.strikeRate || 0}
                    </span>
                  </div>
                </div>

                {/* Non-Striker */}
                <div className="flex items-center justify-between text-xs opacity-75">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-600 font-black">▷</span>
                    <span className="font-medium text-zinc-300">{nonStriker?.playerName || 'Batsman'}</span>
                  </div>
                  <div className="font-mono text-zinc-300">
                    <span className="font-bold">{nonStriker?.runs || 0}</span>
                    <span className="text-zinc-500 text-xs"> ({nonStriker?.balls || 0})</span>
                    <span className="text-zinc-500 text-[10px] ml-2">
                      4s:{nonStriker?.fours || 0} 6s:{nonStriker?.sixes || 0} SR:{nonStriker?.strikeRate || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bowler Card */}
              <div className="neo-box bg-zinc-950 p-4 rounded-2xl border-2 border-black space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-black uppercase text-zinc-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400" /> BOWLING: {bowlingTeam.shortName}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Overs Left: {Math.max(0, 4 - (currentBowler?.overs || 0))}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{currentBowler?.playerName || 'Bowler'}</span>
                    {currentInnings.isFreeHitActive && (
                      <span className="ml-2 neo-badge px-1.5 py-0.2 rounded bg-amber-400 text-black text-[9px] font-black">
                        FREE HIT
                      </span>
                    )}
                  </div>
                  <div className="font-mono font-bold text-zinc-200">
                    <span className="text-blue-400 font-black text-sm">
                      {currentBowler?.wickets || 0}-{currentBowler?.runs || 0}
                    </span>
                    <span className="text-zinc-500 text-xs ml-1">
                      ({currentBowler?.overs || 0}.{currentInnings.legalBallsInOver} ov)
                    </span>
                    <span className="text-zinc-500 text-[10px] ml-2 font-normal">
                      Econ: {currentBowler?.economy || 0}
                    </span>
                  </div>
                </div>

                {/* Over Deliveries Rail */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                    THIS OVER / RECENT BALLS:
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {currentInnings.recentDeliveries.length === 0 ? (
                      <span className="text-xs font-mono text-zinc-600">Waiting for first ball...</span>
                    ) : (
                      currentInnings.recentDeliveries.slice(-10).map((b, idx) => (
                        <span
                          key={idx}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black border-2 border-black shadow-[1px_1px_0px_#000] ${
                            b.isWicket
                              ? 'bg-red-500 text-white'
                              : b.text === '6'
                              ? 'bg-purple-600 text-white'
                              : b.text === '4'
                              ? 'bg-amber-400 text-black'
                              : b.isExtra
                              ? 'bg-blue-500 text-white'
                              : b.text === '0'
                              ? 'bg-zinc-800 text-zinc-400'
                              : 'bg-zinc-700 text-white'
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
            <div className="neo-box bg-zinc-950 p-4 rounded-2xl border-2 border-black flex flex-col h-64 overflow-hidden">
              <div className="text-xs font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2 mb-2 flex items-center justify-between">
                <span>BALL-BY-BALL COMMENTARY</span>
                <span className="text-[10px] font-mono text-zinc-500">Live Audio / Text Feed</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs">
                {currentInnings.balls.length === 0 ? (
                  <div className="text-zinc-600 text-center py-10 font-bold">
                    Match ready to start. Select tactics and bowl delivery.
                  </div>
                ) : (
                  currentInnings.balls.map((ball, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border ${
                        ball.outcome === 'Wicket'
                          ? 'bg-red-950/40 border-red-800/80 text-red-200'
                          : ball.runs >= 4
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-black mb-0.5">
                        <span className="text-amber-400">
                          {ball.over}.{ball.ball}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                            ball.outcome === 'Wicket'
                              ? 'bg-red-500 text-white'
                              : ball.runs === 6
                              ? 'bg-purple-500 text-white'
                              : ball.runs === 4
                              ? 'bg-amber-400 text-black'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {ball.outcome === 'Wicket' ? 'WICKET' : `${ball.runs} RUNS`}
                        </span>
                      </div>
                      <div className="text-zinc-300 font-sans text-xs">{ball.commentary}</div>
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
            <div className="neo-box bg-zinc-950 p-5 rounded-2xl border-2 border-black space-y-5">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Zap className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                <h3 className="text-sm font-black uppercase text-white tracking-wide">
                  TACTICAL MATCH MANAGEMENT
                </h3>
              </div>

              {/* Batting Aggression Selector */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block mb-2">
                  BATTING AGGRESSION {isHumanBatting ? '(YOUR TEAM)' : '(CPU STRATEGY)'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-black">
                  {(['Anchor', 'Balanced', 'Attack', 'Blitz'] as BattingAggression[]).map((agg) => (
                    <button
                      key={agg}
                      onClick={() => setSelectedAggression(agg)}
                      className={`p-2 rounded-xl border-2 border-black transition-all text-center ${
                        selectedAggression === agg
                          ? 'bg-amber-400 text-black shadow-[2px_2px_0px_#000]'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {agg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bowling Strategy Selector */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block mb-2">
                  BOWLING TACTICS {isHumanBowling ? '(YOUR TEAM)' : '(CPU STRATEGY)'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-black">
                  {(['Stock', 'Yorker', 'Bouncer', 'SlowerBall', 'WideLine'] as BowlingStrategy[]).map((strat) => (
                    <button
                      key={strat}
                      onClick={() => setSelectedStrategy(strat)}
                      className={`p-2 rounded-xl border-2 border-black transition-all text-center ${
                        selectedStrategy === strat
                          ? 'bg-blue-500 text-white shadow-[2px_2px_0px_#000]'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {strat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Next Bowler (if eligible) */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block mb-2">
                  CHOOSE NEXT BOWLER
                </label>
                <select
                  value={selectedNextBowlerIdx ?? ''}
                  onChange={(e) => setSelectedNextBowlerIdx(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-zinc-900 border-2 border-black text-white text-xs font-bold p-2.5 rounded-xl outline-none focus:border-amber-400"
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
            <div className="neo-box bg-zinc-950 p-5 rounded-2xl border-2 border-black space-y-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                SIMULATION SPEED CONTROLS
              </div>

              <div className="space-y-2">
                <button
                  disabled={session.isMatchCompleted}
                  onClick={handleNextBall}
                  className="w-full neo-btn py-3 px-4 rounded-xl font-black text-xs uppercase bg-emerald-400 text-black flex items-center justify-center gap-2 hover:bg-emerald-300 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>BOWL NEXT BALL</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={session.isMatchCompleted}
                    onClick={handleNextOver}
                    className="neo-btn py-2.5 px-3 rounded-xl font-black text-xs uppercase bg-amber-400 text-black flex items-center justify-center gap-1.5 hover:bg-amber-300 disabled:opacity-50"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>NEXT OVER</span>
                  </button>

                  <button
                    disabled={session.isMatchCompleted}
                    onClick={handleFinishInnings}
                    className="neo-btn py-2.5 px-3 rounded-xl font-black text-xs uppercase bg-purple-500 text-white flex items-center justify-center gap-1.5 hover:bg-purple-400 disabled:opacity-50"
                  >
                    <span>FINISH INNINGS</span>
                  </button>
                </div>

                <button
                  disabled={session.isMatchCompleted}
                  onClick={handleInstantMatch}
                  className="w-full neo-btn py-2.5 px-4 rounded-xl font-black text-xs uppercase bg-zinc-800 text-zinc-200 border-2 border-black flex items-center justify-center gap-2 hover:bg-zinc-700 disabled:opacity-50"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>INSTANT SIMULATE MATCH</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Full Scorecard View */
        <div className="space-y-6">
          {/* Innings 1 Scorecard */}
          <div className="neo-box bg-zinc-950 p-6 rounded-3xl border-2 border-black space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="text-base font-black uppercase text-amber-400">
                1ST INNINGS: {session.innings1.battingTeamName}
              </h3>
              <span className="font-mono text-base font-black text-white">
                {session.innings1.score.runs}/{session.innings1.score.wickets} ({session.innings1.score.overs}.
                {session.innings1.score.balls} Overs)
              </span>
            </div>

            {/* Batting Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2">Batter</th>
                    <th className="py-2">Dismissal</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">B</th>
                    <th className="py-2 text-right">4s</th>
                    <th className="py-2 text-right">6s</th>
                    <th className="py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {session.innings1.batsmen.map((b) => (
                    <tr key={b.playerId}>
                      <td className="py-2 font-bold text-white">{b.playerName}</td>
                      <td className="py-2 text-zinc-500 text-[11px]">{b.dismissalText}</td>
                      <td className="py-2 text-right font-black text-amber-400">{b.runs}</td>
                      <td className="py-2 text-right text-zinc-400">{b.balls}</td>
                      <td className="py-2 text-right text-zinc-400">{b.fours}</td>
                      <td className="py-2 text-right text-zinc-400">{b.sixes}</td>
                      <td className="py-2 text-right text-zinc-400">{b.strikeRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bowling Table */}
            <div className="overflow-x-auto pt-4 border-t border-zinc-800">
              <div className="text-xs font-black uppercase text-blue-400 mb-2">Bowling Spell</div>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2">Bowler</th>
                    <th className="py-2 text-right">O</th>
                    <th className="py-2 text-right">M</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">W</th>
                    <th className="py-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {session.innings1.bowlers.map((bw) => (
                    <tr key={bw.playerId}>
                      <td className="py-2 font-bold text-white">{bw.playerName}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.overs}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.maidens}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.runs}</td>
                      <td className="py-2 text-right font-black text-blue-400">{bw.wickets}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.economy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Innings 2 Scorecard */}
          <div className="neo-box bg-zinc-950 p-6 rounded-3xl border-2 border-black space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="text-base font-black uppercase text-amber-400">
                2ND INNINGS: {session.innings2.battingTeamName}
              </h3>
              <span className="font-mono text-base font-black text-white">
                {session.innings2.score.runs}/{session.innings2.score.wickets} ({session.innings2.score.overs}.
                {session.innings2.score.balls} Overs)
              </span>
            </div>

            {/* Batting Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2">Batter</th>
                    <th className="py-2">Dismissal</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">B</th>
                    <th className="py-2 text-right">4s</th>
                    <th className="py-2 text-right">6s</th>
                    <th className="py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {session.innings2.batsmen.map((b) => (
                    <tr key={b.playerId}>
                      <td className="py-2 font-bold text-white">{b.playerName}</td>
                      <td className="py-2 text-zinc-500 text-[11px]">{b.dismissalText}</td>
                      <td className="py-2 text-right font-black text-amber-400">{b.runs}</td>
                      <td className="py-2 text-right text-zinc-400">{b.balls}</td>
                      <td className="py-2 text-right text-zinc-400">{b.fours}</td>
                      <td className="py-2 text-right text-zinc-400">{b.sixes}</td>
                      <td className="py-2 text-right text-zinc-400">{b.strikeRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bowling Table */}
            <div className="overflow-x-auto pt-4 border-t border-zinc-800">
              <div className="text-xs font-black uppercase text-blue-400 mb-2">Bowling Spell</div>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2">Bowler</th>
                    <th className="py-2 text-right">O</th>
                    <th className="py-2 text-right">M</th>
                    <th className="py-2 text-right">R</th>
                    <th className="py-2 text-right">W</th>
                    <th className="py-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {session.innings2.bowlers.map((bw) => (
                    <tr key={bw.playerId}>
                      <td className="py-2 font-bold text-white">{bw.playerName}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.overs}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.maidens}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.runs}</td>
                      <td className="py-2 text-right font-black text-blue-400">{bw.wickets}</td>
                      <td className="py-2 text-right text-zinc-400">{bw.economy}</td>
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
