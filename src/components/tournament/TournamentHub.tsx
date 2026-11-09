'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { StandingsTable } from '@/components/standings/StandingsTable';
import { MatchSimulator } from '@/components/match/MatchSimulator';
import {
  calculateStandings,
  generatePlayoffFixtures,
} from '@/lib/engines/tournament-engine';
import { simulateFullMatch } from '@/lib/engines/match-engine';
import { Calendar, Play, FastForward, Trophy, ArrowRight, Shield, Award } from 'lucide-react';
import type { Fixture, MatchResult } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';

export function TournamentHub() {
  const {
    fixtures,
    franchises,
    playingXIs,
    humanFranchiseId,
    updateFixture,
    setStandings,
    setPlayoffFixtures,
    setPhase,
    updatePlayerSeasonStats,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'hub' | 'match' | 'schedule'>('hub');
  const [selectedMatchForSim, setSelectedMatchForSim] = useState<Fixture | null>(null);

  const humanTheme = getTeamTheme(humanFranchiseId);

  const nextUnplayedFixture = fixtures.find((f) => !f.isCompleted);
  const humanNextFixture = fixtures.find(
    (f) => !f.isCompleted && (f.team1Id === humanFranchiseId || f.team2Id === humanFranchiseId)
  );

  const completedCount = fixtures.filter((f) => f.isCompleted).length;
  const isRegularSeasonDone = completedCount >= fixtures.length && fixtures.length > 0;

  const handleMatchCompleted = (result: MatchResult) => {
    const fIdx = fixtures.findIndex((f) => f.id === result.matchId);
    if (fIdx !== -1) {
      updateFixture(fIdx, {
        isCompleted: true,
        result,
      });

      const updatedFixtures = [...fixtures];
      updatedFixtures[fIdx] = { ...updatedFixtures[fIdx], isCompleted: true, result };
      const newStandings = calculateStandings(franchises, updatedFixtures);
      setStandings(newStandings);
    }

    setActiveTab('hub');
    setSelectedMatchForSim(null);
  };

  const runSilentSim = (fixture: Fixture, updatedFixturesList: Fixture[]) => {
    const t1 = franchises.find((f) => f.id === fixture.team1Id);
    const t2 = franchises.find((f) => f.id === fixture.team2Id);
    const xi1 = t1 ? playingXIs[t1.id] : null;
    const xi2 = t2 ? playingXIs[t2.id] : null;

    if (!t1 || !t2 || !xi1 || !xi2) return;

    const sim = simulateFullMatch(fixture, t1, t2, xi1, xi2, Math.random() * 1000000);
    const fIdx = updatedFixturesList.findIndex((f) => f.id === fixture.id);
    if (fIdx !== -1) {
      updatedFixturesList[fIdx] = {
        ...fixture,
        isCompleted: true,
        result: sim.matchResult,
      };

      for (const b of [...sim.innings1.batsmen, ...sim.innings2.batsmen]) {
        if (b.balls > 0) {
          updatePlayerSeasonStats(b.playerId, {
            runs: b.runs,
            ballsFaced: b.balls,
            fours: b.fours,
            sixes: b.sixes,
          });
        }
      }
      for (const b of [...sim.innings1.bowlers, ...sim.innings2.bowlers]) {
        if (b.overs > 0) {
          updatePlayerSeasonStats(b.playerId, {
            oversBowled: b.overs,
            wickets: b.wickets,
            runsConceded: b.runs,
          });
        }
      }
    }
  };

  const handleSimulateToHumanMatch = () => {
    const updated = [...fixtures];
    for (const f of updated) {
      if (f.isCompleted) continue;
      if (f.team1Id === humanFranchiseId || f.team2Id === humanFranchiseId) {
        break;
      }
      runSilentSim(f, updated);
    }

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].isCompleted && !fixtures[i].isCompleted) {
        updateFixture(i, { isCompleted: true, result: updated[i].result });
      }
    }

    const newStandings = calculateStandings(franchises, updated);
    setStandings(newStandings);
  };

  const handleSimulateAllSeason = () => {
    const updated = [...fixtures];
    for (const f of updated) {
      if (f.isCompleted) continue;
      runSilentSim(f, updated);
    }

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].isCompleted && !fixtures[i].isCompleted) {
        updateFixture(i, { isCompleted: true, result: updated[i].result });
      }
    }

    const newStandings = calculateStandings(franchises, updated);
    setStandings(newStandings);
  };

  const handleEnterPlayoffs = () => {
    const standings = calculateStandings(franchises, fixtures);
    const playoffFixtures = generatePlayoffFixtures(standings);
    setPlayoffFixtures(playoffFixtures);
    setPhase('Playoffs');
  };

  if (activeTab === 'match' && selectedMatchForSim) {
    return (
      <div className="space-y-4">
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <button
            onClick={() => setActiveTab('hub')}
            className="neo-btn px-4 py-1.5 rounded-lg text-xs uppercase font-black bg-zinc-800 text-zinc-300 hover:text-white"
          >
            ← BACK TO TOURNAMENT HUB
          </button>
        </div>
        <MatchSimulator
          fixture={selectedMatchForSim}
          onMatchComplete={handleMatchCompleted}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Tournament Progress & Fast Simulation (Neo-Box) */}
      <div
        className="neo-box p-5 rounded-2xl relative overflow-hidden"
        style={{
          backgroundColor: humanTheme.cardBg,
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]"
              style={{
                backgroundColor: humanTheme.primary,
                color: humanTheme.textLight,
              }}
            >
              <Calendar className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase text-white tracking-tight">
                  IPL TOURNAMENT HUB
                </h2>
                <span className="neo-badge px-2.5 py-0.5 rounded bg-amber-400 text-black text-xs font-black">
                  {completedCount} / {fixtures.length} MATCHES
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-medium mt-0.5">
                14 League games per franchise. Top 4 teams qualify for the championship playoffs bracket.
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {!isRegularSeasonDone ? (
              <>
                {humanNextFixture && humanNextFixture.id !== nextUnplayedFixture?.id && (
                  <button
                    onClick={handleSimulateToHumanMatch}
                    className="neo-btn px-3.5 py-2 rounded-xl text-xs uppercase font-black bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5"
                  >
                    <FastForward className="w-3.5 h-3.5 text-amber-400" />
                    SIM TO YOUR NEXT MATCH
                  </button>
                )}

                <button
                  onClick={handleSimulateAllSeason}
                  className="neo-btn px-3.5 py-2 rounded-xl text-xs uppercase font-black bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  SIMULATE ENTIRE LEAGUE
                </button>
              </>
            ) : (
              <button
                onClick={handleEnterPlayoffs}
                className="neo-btn px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2"
                style={{
                  backgroundColor: humanTheme.primary,
                  color: humanTheme.textLight,
                }}
              >
                <Trophy className="w-4 h-4 fill-current" />
                <span>ENTER IPL PLAYOFFS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spotlight: Next Scheduled Match */}
      {nextUnplayedFixture && !isRegularSeasonDone && (
        <div className="neo-box p-5 rounded-2xl bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-3 pb-2 border-b-2 border-black">
            <span className="text-amber-400">NEXT UPCOMING MATCH</span>
            <span>MATCH #{nextUnplayedFixture.matchNumber} • {nextUnplayedFixture.venue}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Team 1 */}
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_#000]"
                  style={{
                    backgroundColor: franchises.find((f) => f.id === nextUnplayedFixture.team1Id)?.colors.primary,
                    color: franchises.find((f) => f.id === nextUnplayedFixture.team1Id)?.colors.text,
                  }}
                >
                  {franchises.find((f) => f.id === nextUnplayedFixture.team1Id)?.abbreviation}
                </span>
                <span className="font-black text-sm text-white">
                  {franchises.find((f) => f.id === nextUnplayedFixture.team1Id)?.name}
                </span>
              </div>

              <span className="neo-badge px-2 py-0.5 rounded bg-black text-zinc-400 text-xs font-black">
                VS
              </span>

              {/* Team 2 */}
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_#000]"
                  style={{
                    backgroundColor: franchises.find((f) => f.id === nextUnplayedFixture.team2Id)?.colors.primary,
                    color: franchises.find((f) => f.id === nextUnplayedFixture.team2Id)?.colors.text,
                  }}
                >
                  {franchises.find((f) => f.id === nextUnplayedFixture.team2Id)?.abbreviation}
                </span>
                <span className="font-black text-sm text-white">
                  {franchises.find((f) => f.id === nextUnplayedFixture.team2Id)?.name}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedMatchForSim(nextUnplayedFixture);
                setActiveTab('match');
              }}
              className="neo-btn px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-amber-400 text-black hover:bg-amber-300"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>PLAY / SIMULATE MATCH</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Standings (Left) & Upcoming Schedule List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Points Table (7 cols) */}
        <div className="lg:col-span-7">
          <StandingsTable />
        </div>

        {/* Fixtures Schedule List (5 cols) */}
        <div className="lg:col-span-5 neo-box p-5 rounded-2xl bg-zinc-950 flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-black">
            <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400 stroke-[2.5]" /> FIXTURES & RESULTS
            </h3>
            <span className="neo-badge px-2 py-0.5 rounded bg-black text-zinc-400 text-[10px]">
              70 MATCHES
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 flex-1">
            {fixtures.slice(0, 30).map((f) => {
              const t1 = franchises.find((fr) => fr.id === f.team1Id);
              const t2 = franchises.find((fr) => fr.id === f.team2Id);
              const isHuman = f.team1Id === humanFranchiseId || f.team2Id === humanFranchiseId;

              return (
                <div
                  key={f.id}
                  className={`neo-box-sm p-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                    isHuman
                      ? 'bg-zinc-900 border-amber-400/80 ring-1 ring-amber-400'
                      : 'bg-zinc-950 hover:bg-zinc-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-black text-white">
                      <span>{t1?.shortName}</span>
                      <span className="text-zinc-500 text-[10px]">vs</span>
                      <span>{t2?.shortName}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-bold mt-0.5">
                      Match #{f.matchNumber}
                    </div>
                  </div>

                  <div className="text-right">
                    {f.isCompleted && f.result ? (
                      <div>
                        <span className="text-emerald-400 font-black block text-[11px]">
                          {f.result.winnerId === t1?.id ? t1?.shortName : t2?.shortName} Won
                        </span>
                        <span className="text-[9px] text-zinc-400 font-bold">
                          {f.result.team1Score.runs}/{f.result.team1Score.wickets} vs {f.result.team2Score.runs}/{f.result.team2Score.wickets}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedMatchForSim(f);
                          setActiveTab('match');
                        }}
                        className="neo-btn text-[10px] py-1 px-2.5 rounded-lg bg-zinc-800 text-amber-400 font-black uppercase hover:bg-zinc-700"
                      >
                        SIM
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
