'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { simulateFullMatch } from '@/lib/engines/match-engine';
import { calculateSeasonAwards } from '@/lib/engines/tournament-engine';
import { ArrowRight, Trophy } from 'lucide-react';
import { MButton, PageHeader, Panel, TeamCrest, LineField, worldVars } from '@/components/mynba/primitives';
import type { Fixture, MatchResult } from '@/lib/types/game';

/** Match seed; drawn only inside click handlers. */
const randomSeed = () => Math.random() * 1000000;

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
    standings,
  } = useGameStore();

  const [justCrowned, setChampion] = useState<string | null>(null);

  const q1 = playoffFixtures[0];
  const elim = playoffFixtures[1];
  const q2 = playoffFixtures[2];
  const finalMatch = playoffFixtures[3];
  // Derived from the saved Final so it survives a reload.
  const champion = justCrowned ?? (finalMatch?.isCompleted ? finalMatch.result?.winnerId ?? null : null);

  const simulatePlayoffMatch = (fixture: Fixture): MatchResult | null => {
    const t1 = franchises.find((f) => f.id === fixture.team1Id);
    const t2 = franchises.find((f) => f.id === fixture.team2Id);
    const xi1 = t1 ? playingXIs[t1.id] : null;
    const xi2 = t2 ? playingXIs[t2.id] : null;

    if (!t1 || !t2 || !xi1 || !xi2) return null;

    const sim = simulateFullMatch(fixture, t1, t2, xi1, xi2, randomSeed());
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

    const myRow = standings.find((r) => r.franchiseId === humanFranchiseId);
    const champTeam = franchises.find((f) => f.id === winner);
    const runnerTeam = franchises.find((f) => f.id === (winner === finalMatch.team1Id ? finalMatch.team2Id : finalMatch.team1Id));
    addSeasonSummary({
      year: currentSeason,
      championId: champTeam?.name || winner,
      runnerUpId: runnerTeam?.name || 'Runner Up',
      orangeCapPlayer: awards.find((a) => a.type === 'OrangeCap')?.playerName || 'Top Scorer',
      purpleCapPlayer: awards.find((a) => a.type === 'PurpleCap')?.playerName || 'Top Bowler',
      mvpPlayer: awards.find((a) => a.type === 'MVP')?.playerName || 'Tournament MVP',
      humanFranchisePosition: myRow?.position ?? Math.max(1, standings.findIndex((r) => r.franchiseId === humanFranchiseId) + 1),
      humanFranchiseWins: myRow?.won ?? 0,
      humanFranchiseLosses: myRow?.lost ?? 0,
    });
  };

  const handleProceedToAwards = () => {
    setPhase('SeasonReview');
  };

  const getTeam = (id?: string) => franchises.find((f) => f.id === id);
  const nextUp = [q1, elim, q2, finalMatch].find((f) => f && !f.isCompleted);

  const stage = (
    fixture: Fixture | undefined,
    title: string,
    note: string,
    onSim: () => void,
    waiting: string
  ) => {
    if (!fixture) {
      return (
        <div className="rounded-[4px] border border-dashed border-[var(--m-line)] px-5 py-8 text-center text-sm text-[var(--m-faint)]">
          <div className="m-label mb-1">{title}</div>
          {waiting}
        </div>
      );
    }
    const isNext = nextUp?.id === fixture.id;
    const winner = fixture.result?.winnerId;
    const side = (id: string) => (
      <div className={`flex items-center gap-3 min-w-0 ${fixture.isCompleted && winner !== id ? 'opacity-45' : ''}`}>
        <TeamCrest franchiseId={id} size="sm" />
        <span className={`truncate ${id === humanFranchiseId ? 'font-semibold' : ''}`}>{getTeam(id)?.name}</span>
        {winner === id && <Trophy className="w-3.5 h-3.5 text-[var(--m-gold)] shrink-0" />}
      </div>
    );
    return (
      <Panel title={title} right={<span className="text-xs text-[var(--m-faint)]">{note}</span>}>
        <div className="space-y-3">
          {side(fixture.team1Id)}
          {side(fixture.team2Id)}
        </div>
        <div className="mt-4">
          {fixture.isCompleted && fixture.result ? (
            <div className="text-sm text-[var(--m-green)]">{fixture.result.winMargin}</div>
          ) : (
            <MButton variant={isNext ? 'primary' : 'ghost'} className="w-full" disabled={!isNext} onClick={onSim}>
              {isNext ? `Simulate ${title}` : 'Waiting for earlier match'}
            </MButton>
          )}
        </div>
      </Panel>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        kicker={`IPL ${currentSeason} · Knockouts`}
        title="Playoffs"
        subtitle="The top two get two chances to reach the Final; third and fourth must win every game. Play them in order."
        right={
          champion && (
            <MButton variant="go" size="lg" onClick={handleProceedToAwards}>
              Season review <ArrowRight className="w-4 h-4" />
            </MButton>
          )
        }
      />

      {champion && (
        <div className="relative overflow-hidden border border-[var(--m-ink)] px-6 py-12 text-center bg-[var(--m-bg)] text-[var(--m-text)] shadow-[8px_8px_0_var(--m-ink)]" style={worldVars(champion)}>
          <div
            className="absolute inset-0 text-[var(--m-ink)]"
            style={{ maskImage: 'radial-gradient(ellipse 42% 75% at center, transparent 55%, #000 85%)', WebkitMaskImage: 'radial-gradient(ellipse 42% 75% at center, transparent 55%, #000 85%)' }}
          >
            <LineField seed={`${champion}-${currentSeason}`} lines={30} accentEvery={3} className="w-full h-full" />
          </div>
          <div className="relative">
            <div className="m-label !text-[var(--m-accent-ink)]">IPL {currentSeason} champions</div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <TeamCrest franchiseId={champion} size="lg" />
              <div className="m-display text-5xl sm:text-6xl">{getTeam(champion)?.name}</div>
            </div>
            {finalMatch?.result?.winMargin && <p className="text-sm text-[var(--m-dim)] mt-3">{finalMatch.result.winMargin} in the Final.</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {stage(q1, 'Qualifier 1', '1st v 2nd · winner to the Final', handleSimulateQ1, '')}
        {stage(elim, 'Eliminator', '3rd v 4th · loser is out', handleSimulateEliminator, '')}
        {stage(q2, 'Qualifier 2', 'Q1 loser v Eliminator winner', handleSimulateQ2, 'Decided by Qualifier 1 and the Eliminator.')}
        {stage(finalMatch, 'Final', 'Q1 winner v Q2 winner', handleSimulateFinal, 'Decided by Qualifier 2.')}
      </div>
    </div>
  );
}
