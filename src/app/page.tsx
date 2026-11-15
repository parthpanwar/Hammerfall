'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { GameHeader } from '@/components/layout/GameHeader';
import { MainMenu } from '@/components/main-menu/MainMenu';
import { RetentionView } from '@/components/retention/RetentionView';
import { RegistrationDashboard } from '@/components/auction/RegistrationDashboard';
import { FranchiseScoutingRoom } from '@/components/scouting/FranchiseScoutingRoom';
import { ShortlistRevealModal } from '@/components/auction/ShortlistRevealModal';
import { AuctionHall } from '@/components/auction/AuctionHall';
import { SquadManager } from '@/components/squad/SquadManager';
import { TournamentHub } from '@/components/tournament/TournamentHub';
import { StandingsTable } from '@/components/standings/StandingsTable';
import { PlayoffsBracket } from '@/components/playoffs/PlayoffsBracket';
import { SeasonReview } from '@/components/season/SeasonReview';
import { CareerDashboard } from '@/components/career/CareerDashboard';
import { TradeCenter } from '@/components/trade/TradeCenter';
import { TransactionsView } from '@/components/transactions/TransactionsView';
import { MiniReleaseView } from '@/components/retention/MiniReleaseView';
import { auctionTypeFor } from '@/lib/flow/season-flow';
import { worldVars } from '@/components/mynba/primitives';

const subscribeNoop = () => () => {};

export default function Home() {
  const { phase, humanFranchiseId, ensurePhaseData, currentSeason, settings } = useGameStore();
  const miniYear = !!settings && auctionTypeFor(currentSeason, settings) === 'Mini';
  // True only on the client (the store hydrates from localStorage).
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // Rebuild pre-auction data that is intentionally not persisted (keeps saves small),
  // e.g. after a page refresh or when stepping back from Auction Sets to Scouting.
  useEffect(() => {
    ensurePhaseData();
  }, [phase, ensurePhaseData]);

  // The whole page takes on the franchise's world (paper, ink, jersey accents).
  const worldId = phase === 'MainMenu' ? null : humanFranchiseId || null;
  useEffect(() => {
    const vars = worldVars(worldId) as Record<string, string>;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }, [worldId]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="m-display text-4xl">IPL Dynasty</div>
        <div className="w-40 m-meter"><span style={{ width: '60%', background: 'var(--m-ink)' }} /></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--m-bg)] text-[var(--m-text)] flex flex-col transition-colors duration-500"
      style={worldVars(worldId)}
    >
      {/* Header bar (shown during active game) */}
      {phase !== 'MainMenu' && <GameHeader />}

      {/* Main Game Screen depending on phase */}
      <main className="flex-1 w-full">
        {phase === 'MainMenu' && <MainMenu />}
        {phase === 'Retention' && (miniYear ? <MiniReleaseView /> : <RetentionView />)}
        {phase === 'Registration' && <RegistrationDashboard />}
        {phase === 'Scouting' && <FranchiseScoutingRoom />}
        {phase === 'ShortlistReveal' && <ShortlistRevealModal />}
        {phase === 'Auction' && <AuctionHall />}
        {phase === 'SquadManagement' && <SquadManager />}
        {phase === 'Tournament' && <TournamentHub />}
        {phase === 'Standings' && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <StandingsTable />
          </div>
        )}
        {phase === 'Playoffs' && <PlayoffsBracket />}
        {phase === 'SeasonReview' && <SeasonReview />}
        {(phase === 'CareerDashboard' || phase === 'CareerHistory') && <CareerDashboard />}
        {phase === 'TradeCenter' && <TradeCenter />}
        {phase === 'Transactions' && <TransactionsView />}
      </main>
    </div>
  );
}
