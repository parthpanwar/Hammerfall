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
import { Play, FastForward, Trophy } from 'lucide-react';
import { MButton, PageHeader, Panel, TeamCrest } from '@/components/mynba/primitives';
import type { Fixture, MatchResult } from '@/lib/types/game';

export function TournamentHub() {
  const {
    fixtures,
    franchises,
    humanFranchiseId,
    updateFixture,
    setStandings,
    setPlayoffFixtures,
    setPhase,
    updatePlayerSeasonStats,
    recordMatchForm,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'hub' | 'match'>('hub');
  const [fixtureFilter, setFixtureFilter] = useState<'mine' | 'all'>('mine');
  const [selectedMatchForSim, setSelectedMatchForSim] = useState<Fixture | null>(null);


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
    // Read the live store: form and CPU XIs change after every match of a batch sim.
    const live = useGameStore.getState();
    const t1 = live.franchises.find((f) => f.id === fixture.team1Id);
    const t2 = live.franchises.find((f) => f.id === fixture.team2Id);
    const xi1 = t1 ? live.playingXIs[t1.id] : null;
    const xi2 = t2 ? live.playingXIs[t2.id] : null;

    if (!t1 || !t2 || !xi1 || !xi2) return;

    const sim = simulateFullMatch(fixture, t1, t2, xi1, xi2, Math.random() * 1000000);
    const fIdx = updatedFixturesList.findIndex((f) => f.id === fixture.id);
    if (fIdx !== -1) {
      updatedFixturesList[fIdx] = {
        ...fixture,
        isCompleted: true,
        result: sim.matchResult,
      };

      // Every player in both XIs gets exactly one appearance, batted or not.
      const counted = new Set<string>();
      const appearance = (id: string) => {
        if (counted.has(id)) return 0;
        counted.add(id);
        return 1;
      };
      for (const b of [...sim.innings1.batsmen, ...sim.innings2.batsmen]) {
        if (b.balls > 0) {
          updatePlayerSeasonStats(b.playerId, {
            runs: b.runs,
            ballsFaced: b.balls,
            fours: b.fours,
            sixes: b.sixes,
            matches: appearance(b.playerId),
          });
        }
      }
      for (const b of [...sim.innings1.bowlers, ...sim.innings2.bowlers]) {
        if (b.overs > 0) {
          updatePlayerSeasonStats(b.playerId, {
            oversBowled: b.overs,
            wickets: b.wickets,
            runsConceded: b.runs,
            matches: appearance(b.playerId),
          });
        }
      }
      for (const id of [...xi1.players, ...xi2.players]) if (!counted.has(id)) updatePlayerSeasonStats(id, { matches: appearance(id) });
      recordMatchForm({
        matchKey: fixture.id,
        team1Id: fixture.team1Id,
        team2Id: fixture.team2Id,
        team1XI: xi1.players,
        team2XI: xi2.players,
        batsmen: [...sim.innings1.batsmen, ...sim.innings2.batsmen],
        bowlers: [...sim.innings1.bowlers, ...sim.innings2.bowlers],
        mustWin: !!fixture.isPlayoff,
      });
    }
  };

  const handleSimulateToHumanMatch = () => {
    if (!humanNextFixture) return;

    const updated = [...fixtures];
    for (const f of updated) {
      if (f.id === humanNextFixture.id) break;
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <MButton variant="ghost" size="sm" onClick={() => setActiveTab('hub')}>
            ← Back to league
          </MButton>
        </div>
        <MatchSimulator fixture={selectedMatchForSim} onMatchComplete={handleMatchCompleted} />
      </div>
    );
  }

  const team = (id: string) => franchises.find((f) => f.id === id);
  const openMatch = (f: Fixture) => {
    setSelectedMatchForSim(f);
    setActiveTab('match');
  };
  const isMine = (f: Fixture) => f.team1Id === humanFranchiseId || f.team2Id === humanFranchiseId;
  const listed = fixtures.filter((f) => fixtureFilter === 'all' || isMine(f));
  const myPlayed = fixtures.filter((f) => isMine(f) && f.isCompleted);
  const myWins = myPlayed.filter((f) => f.result?.winnerId === humanFranchiseId).length;
  const spotlight = humanNextFixture ?? nextUnplayedFixture;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        kicker={`League stage · ${completedCount} of ${fixtures.length} matches played`}
        title="League"
        subtitle="Each team plays 14 league matches. Finish in the top four to reach the playoffs."
        right={
          isRegularSeasonDone ? (
            <MButton variant="go" size="lg" onClick={handleEnterPlayoffs}>
              <Trophy className="w-4 h-4" /> Enter the playoffs
            </MButton>
          ) : (
            <MButton variant="ghost" onClick={handleSimulateAllSeason} title="Simulates every remaining league match, including yours">
              <FastForward className="w-4 h-4" /> Simulate rest of league
            </MButton>
          )
        }
      />

      <div className="m-meter h-1.5" aria-label="League progress">
        <span style={{ width: `${fixtures.length ? (completedCount / fixtures.length) * 100 : 0}%`, background: 'var(--m-green)' }} />
      </div>

      {spotlight && !isRegularSeasonDone && (
        <Panel bodyClassName="p-0">
          <div className="flex flex-col md:flex-row md:items-center gap-5 px-6 py-6">
            <div className="flex-1 min-w-0">
              <div className="m-label">
                {humanNextFixture ? `Your next match · ${myPlayed.length} played, ${myWins} won` : 'Next match'}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <TeamCrest franchiseId={spotlight.team1Id} size="md" />
                <span className="font-display font-extrabold uppercase text-xl truncate">{team(spotlight.team1Id)?.shortName}</span>
                <span className="text-[var(--m-faint)] text-sm">vs</span>
                <span className="font-display font-extrabold uppercase text-xl truncate">{team(spotlight.team2Id)?.shortName}</span>
                <TeamCrest franchiseId={spotlight.team2Id} size="md" />
              </div>
              <div className="text-xs text-[var(--m-faint)] mt-2">
                Match {spotlight.matchNumber} · {spotlight.venue}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {humanNextFixture && humanNextFixture.id !== nextUnplayedFixture?.id ? (
                <MButton variant="primary" size="lg" onClick={handleSimulateToHumanMatch}>
                  <FastForward className="w-4 h-4" /> Sim to your match
                </MButton>
              ) : (
                <MButton variant="primary" size="lg" onClick={() => openMatch(spotlight)}>
                  <Play className="w-4 h-4" /> Play match
                </MButton>
              )}
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-start">
        <StandingsTable />

        <Panel
          title="Fixtures"
          right={
            <div className="flex gap-1">
              {(['mine', 'all'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFixtureFilter(k)}
                  className={`px-2.5 py-0.5 rounded-full text-xs ${fixtureFilter === k ? 'bg-ink text-[var(--m-bg)] font-semibold' : 'text-[var(--m-dim)] hover:text-ink'}`}
                >
                  {k === 'mine' ? 'Yours' : 'All'}
                </button>
              ))}
            </div>
          }
          bodyClassName="p-0"
        >
          <ul className="max-h-[520px] overflow-y-auto m-scroll">
            {listed.map((f) => {
              const t1 = team(f.team1Id);
              const t2 = team(f.team2Id);
              const won = f.result?.winnerId;
              return (
                <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--m-line)]/50 text-sm">
                  <span className="w-7 text-xs text-[var(--m-faint)] tabular-nums">{f.matchNumber}</span>
                  <div className="flex-1 min-w-0">
                    <span className={won === t1?.id ? 'font-semibold' : f.isCompleted ? 'text-[var(--m-dim)]' : ''}>{t1?.shortName}</span>
                    <span className="text-[var(--m-faint)] mx-1.5">v</span>
                    <span className={won === t2?.id ? 'font-semibold' : f.isCompleted ? 'text-[var(--m-dim)]' : ''}>{t2?.shortName}</span>
                  </div>
                  {f.isCompleted && f.result ? (
                    <span className="text-xs tabular-nums text-[var(--m-dim)]">
                      {f.result.team1Score.runs}/{f.result.team1Score.wickets} · {f.result.team2Score.runs}/{f.result.team2Score.wickets}
                      {isMine(f) && (
                        <b className={`ml-2 ${won === humanFranchiseId ? 'text-[var(--m-green)]' : 'text-[var(--m-red)]'}`}>
                          {won === humanFranchiseId ? 'W' : 'L'}
                        </b>
                      )}
                    </span>
                  ) : f.id === nextUnplayedFixture?.id ? (
                    <MButton size="sm" variant="ghost" onClick={() => openMatch(f)}>
                      Play
                    </MButton>
                  ) : (
                    <span className="text-xs text-[var(--m-faint)]">Upcoming</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
