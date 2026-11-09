'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { simulateFullMatch } from '@/lib/engines/match-engine';
import { calculateSeasonAwards } from '@/lib/engines/tournament-engine';
import { Trophy, Play, Award, Sparkles, ArrowRight, Shield } from 'lucide-react';
import type { Fixture, MatchResult } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';

export function PlayoffsBracket() {
  const {
    playoffFixtures,
    franchises,
    playingXIs,
    humanFranchiseId,
    setPlayoffFixtures,
    setSeasonAwards,
    allPlayers,
    playerSeasonStats,
    setPhase,
    addSeasonSummary,
    currentSeason,
  } = useGameStore();

  const [champion, setChampion] = useState<string | null>(null);
  const humanTheme = getTeamTheme(humanFranchiseId);

  const q1 = playoffFixtures[0];
  const elim = playoffFixtures[1];
  const q2 = playoffFixtures[2];
  const finalMatch = playoffFixtures[3];

  const simulatePlayoffMatch = (fixture: Fixture): MatchResult | null => {
    const t1 = franchises.find((f) => f.id === fixture.team1Id);
    const t2 = franchises.find((f) => f.id === fixture.team2Id);
    const xi1 = t1 ? playingXIs[t1.id] : null;
    const xi2 = t2 ? playingXIs[t2.id] : null;

    if (!t1 || !t2 || !xi1 || !xi2) return null;

    const sim = simulateFullMatch(fixture, t1, t2, xi1, xi2, Math.random() * 1000000);
    return sim.matchResult;
  };

  const handleSimulateQ1 = () => {
    if (!q1 || q1.isCompleted) return;
    const res = simulatePlayoffMatch(q1);
    if (!res) return;

    const updatedQ1: Fixture = { ...q1, isCompleted: true, result: res };
    const updated = [...playoffFixtures];
    updated[0] = updatedQ1;

    if (elim && elim.isCompleted && elim.result) {
      const loserQ1 = res.winnerId === q1.team1Id ? q1.team2Id : q1.team1Id;
      const winnerElim = elim.result.winnerId!;
      const q2Fixture: Fixture = {
        id: 'playoff-q2',
        matchNumber: 73,
        team1Id: loserQ1,
        team2Id: winnerElim,
        venue: 'MA Chidambaram Stadium, Chennai',
        isCompleted: false,
        result: null,
        isPlayoff: true,
        playoffType: 'Qualifier2',
      };
      updated[2] = q2Fixture;
    }

    setPlayoffFixtures(updated);
  };

  const handleSimulateEliminator = () => {
    if (!elim || elim.isCompleted) return;
    const res = simulatePlayoffMatch(elim);
    if (!res) return;

    const updatedElim: Fixture = { ...elim, isCompleted: true, result: res };
    const updated = [...playoffFixtures];
    updated[1] = updatedElim;

    if (q1 && q1.isCompleted && q1.result) {
      const loserQ1 = q1.result.winnerId === q1.team1Id ? q1.team2Id : q1.team1Id;
      const winnerElim = res.winnerId!;
      const q2Fixture: Fixture = {
        id: 'playoff-q2',
        matchNumber: 73,
        team1Id: loserQ1,
        team2Id: winnerElim,
        venue: 'MA Chidambaram Stadium, Chennai',
        isCompleted: false,
        result: null,
        isPlayoff: true,
        playoffType: 'Qualifier2',
      };
      updated[2] = q2Fixture;
    }

    setPlayoffFixtures(updated);
  };

  const handleSimulateQ2 = () => {
    if (!q2 || q2.isCompleted) return;
    const res = simulatePlayoffMatch(q2);
    if (!res) return;

    const updatedQ2: Fixture = { ...q2, isCompleted: true, result: res };
    const updated = [...playoffFixtures];
    updated[2] = updatedQ2;

    if (q1 && q1.result) {
      const winnerQ1 = q1.result.winnerId!;
      const winnerQ2 = res.winnerId!;
      const finalFixture: Fixture = {
        id: 'playoff-final',
        matchNumber: 74,
        team1Id: winnerQ1,
        team2Id: winnerQ2,
        venue: 'Narendra Modi Stadium, Ahmedabad',
        isCompleted: false,
        result: null,
        isPlayoff: true,
        playoffType: 'Final',
      };
      updated[3] = finalFixture;
    }

    setPlayoffFixtures(updated);
  };

  const handleSimulateFinal = () => {
    if (!finalMatch || finalMatch.isCompleted) return;
    const res = simulatePlayoffMatch(finalMatch);
    if (!res) return;

    const updatedFinal: Fixture = { ...finalMatch, isCompleted: true, result: res };
    const updated = [...playoffFixtures];
    updated[3] = updatedFinal;
    setPlayoffFixtures(updated);

    const winner = res.winnerId!;
    setChampion(winner);

    const awards = calculateSeasonAwards(allPlayers, playerSeasonStats);
    setSeasonAwards(awards);

    const champTeam = franchises.find((f) => f.id === winner);
    const runnerTeam = franchises.find((f) => f.id === (winner === finalMatch.team1Id ? finalMatch.team2Id : finalMatch.team1Id));
    addSeasonSummary({
      year: currentSeason,
      championId: champTeam?.name || winner,
      runnerUpId: runnerTeam?.name || 'Runner Up',
      orangeCapPlayer: awards.find((a) => a.type === 'OrangeCap')?.playerName || 'Top Scorer',
      purpleCapPlayer: awards.find((a) => a.type === 'PurpleCap')?.playerName || 'Top Bowler',
      mvpPlayer: awards.find((a) => a.type === 'MVP')?.playerName || 'Tournament MVP',
      humanFranchisePosition: 1,
      humanFranchiseWins: 10,
      humanFranchiseLosses: 4,
    });
  };

  const handleProceedToAwards = () => {
    setPhase('SeasonReview');
  };

  const getTeam = (id?: string) => franchises.find((f) => f.id === id);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner (Neo-Box) */}
      <div className="neo-box p-5 rounded-2xl bg-zinc-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400 stroke-[2.5]" />
            <h2 className="text-xl font-black uppercase text-white tracking-tight">
              IPL 2026 PLAYOFFS BRACKET
            </h2>
          </div>
          <p className="text-xs text-zinc-300 font-medium mt-1">
            Top 4 battle through Qualifier 1, Eliminator, and Qualifier 2 to lift the IPL trophy.
          </p>
        </div>

        {champion && (
          <button
            onClick={handleProceedToAwards}
            className="neo-btn px-5 py-2.5 rounded-xl font-black text-xs uppercase bg-amber-400 text-black flex items-center gap-2 hover:bg-amber-300"
          >
            <span>VIEW SEASON AWARDS CEREMONY</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>

      {/* Champion Celebration Banner (if Final completed) */}
      {champion && (
        <div className="neo-box-lg bg-zinc-950 p-8 text-center rounded-3xl relative overflow-hidden border-2 border-black">
          <div className="neo-badge px-3 py-1 rounded bg-amber-400 text-black text-xs inline-block mb-3">
            🏆 IPL {currentSeason} CHAMPIONS
          </div>
          <div className="text-4xl sm:text-6xl font-black uppercase text-white my-2 tracking-tight">
            {getTeam(champion)?.name}
          </div>
          <p className="text-sm font-bold text-amber-300 max-w-md mx-auto mt-2">
            {finalMatch?.result?.winMargin} in a historic final at {finalMatch?.venue}!
          </p>
        </div>
      )}

      {/* Playoff Bracket Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Qualifier 1 */}
        {q1 && (
          <div className="neo-box p-5 rounded-2xl bg-zinc-950">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-3 pb-2 border-b-2 border-black">
              <span className="text-amber-400">QUALIFIER 1 (#1 VS #2)</span>
              <span>WINNER ADVANCES TO FINAL</span>
            </div>

            <div className="flex items-center justify-between my-4">
              <div className="font-black text-sm text-white">{getTeam(q1.team1Id)?.name}</div>
              <span className="neo-badge px-1.5 py-0.5 rounded bg-black text-zinc-400 text-[10px]">VS</span>
              <div className="font-black text-sm text-white">{getTeam(q1.team2Id)?.name}</div>
            </div>

            {q1.isCompleted && q1.result ? (
              <div className="neo-box-sm p-2.5 rounded-lg bg-black text-center text-xs font-black text-emerald-400">
                {q1.result.winMargin}
              </div>
            ) : (
              <button
                onClick={handleSimulateQ1}
                className="neo-btn w-full py-2.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase hover:bg-amber-300"
              >
                SIMULATE QUALIFIER 1
              </button>
            )}
          </div>
        )}

        {/* Eliminator */}
        {elim && (
          <div className="neo-box p-5 rounded-2xl bg-zinc-950">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-3 pb-2 border-b-2 border-black">
              <span className="text-amber-400">ELIMINATOR (#3 VS #4)</span>
              <span className="text-red-400">LOSER IS ELIMINATED</span>
            </div>

            <div className="flex items-center justify-between my-4">
              <div className="font-black text-sm text-white">{getTeam(elim.team1Id)?.name}</div>
              <span className="neo-badge px-1.5 py-0.5 rounded bg-black text-zinc-400 text-[10px]">VS</span>
              <div className="font-black text-sm text-white">{getTeam(elim.team2Id)?.name}</div>
            </div>

            {elim.isCompleted && elim.result ? (
              <div className="neo-box-sm p-2.5 rounded-lg bg-black text-center text-xs font-black text-emerald-400">
                {elim.result.winMargin}
              </div>
            ) : (
              <button
                onClick={handleSimulateEliminator}
                className="neo-btn w-full py-2.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase hover:bg-amber-300"
              >
                SIMULATE ELIMINATOR
              </button>
            )}
          </div>
        )}

        {/* Qualifier 2 */}
        {q2 ? (
          <div className="neo-box p-5 rounded-2xl bg-zinc-950">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-3 pb-2 border-b-2 border-black">
              <span className="text-amber-400">QUALIFIER 2</span>
              <span>LOSER Q1 VS WINNER ELIMINATOR</span>
            </div>

            <div className="flex items-center justify-between my-4">
              <div className="font-black text-sm text-white">{getTeam(q2.team1Id)?.name}</div>
              <span className="neo-badge px-1.5 py-0.5 rounded bg-black text-zinc-400 text-[10px]">VS</span>
              <div className="font-black text-sm text-white">{getTeam(q2.team2Id)?.name}</div>
            </div>

            {q2.isCompleted && q2.result ? (
              <div className="neo-box-sm p-2.5 rounded-lg bg-black text-center text-xs font-black text-emerald-400">
                {q2.result.winMargin}
              </div>
            ) : (
              <button
                onClick={handleSimulateQ2}
                className="neo-btn w-full py-2.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase hover:bg-amber-300"
              >
                SIMULATE QUALIFIER 2
              </button>
            )}
          </div>
        ) : (
          <div className="neo-box p-8 rounded-2xl bg-zinc-950 text-center text-xs text-zinc-400 font-bold flex items-center justify-center">
            Awaiting outcome of Qualifier 1 & Eliminator
          </div>
        )}

        {/* Grand Final */}
        {finalMatch ? (
          <div className="neo-box p-5 rounded-2xl bg-zinc-950">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-3 pb-2 border-b-2 border-black">
              <span className="text-amber-400">IPL GRAND FINAL</span>
              <span>WINNER Q1 VS WINNER Q2</span>
            </div>

            <div className="flex items-center justify-between my-4">
              <div className="font-black text-base text-white">{getTeam(finalMatch.team1Id)?.name}</div>
              <span className="text-sm">🏆</span>
              <div className="font-black text-base text-white">{getTeam(finalMatch.team2Id)?.name}</div>
            </div>

            {finalMatch.isCompleted && finalMatch.result ? (
              <div className="neo-box-sm p-2.5 rounded-lg bg-black text-center text-xs font-black text-emerald-400">
                {finalMatch.result.winMargin}
              </div>
            ) : (
              <button
                onClick={handleSimulateFinal}
                className="neo-btn w-full py-3.5 rounded-xl bg-amber-400 text-black font-black text-xs uppercase hover:bg-amber-300"
              >
                SIMULATE GRAND FINAL
              </button>
            )}
          </div>
        ) : (
          <div className="neo-box p-8 rounded-2xl bg-zinc-950 text-center text-xs text-zinc-400 font-bold flex items-center justify-center">
            Awaiting Qualifier 2 winner
          </div>
        )}
      </div>
    </div>
  );
}
