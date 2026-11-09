'use client';

import React, { useEffect, useState } from 'react';
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
import { getTeamTheme } from '@/lib/theme/team-themes';

export default function Home() {
  const { phase, humanFranchiseId } = useGameStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = getTeamTheme(humanFranchiseId);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-xs font-black">
        INITIALIZING IPL DYNASTY ENGINE...
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-black transition-colors duration-300"
      style={{
        backgroundColor: phase === 'MainMenu' ? undefined : theme.surface,
      }}
    >
      {/* Header bar (shown during active game) */}
      {phase !== 'MainMenu' && <GameHeader />}

      {/* Main Game Screen depending on phase */}
      <main className="flex-1 w-full">
        {phase === 'MainMenu' && <MainMenu />}
        {phase === 'Retention' && <RetentionView />}
        {phase === 'Registration' && <RegistrationDashboard />}
        {phase === 'Scouting' && <FranchiseScoutingRoom />}
        {phase === 'ShortlistReveal' && <ShortlistRevealModal />}
        {phase === 'Auction' && <AuctionHall />}
        {phase === 'SquadManagement' && <SquadManager />}
        {phase === 'Tournament' && <TournamentHub />}
        {phase === 'Standings' && (
          <div className="max-w-5xl mx-auto px-4 py-8">
            <StandingsTable />
          </div>
        )}
        {phase === 'Playoffs' && <PlayoffsBracket />}
        {phase === 'SeasonReview' && <SeasonReview />}
        {(phase === 'CareerDashboard' || phase === 'CareerHistory') && <CareerDashboard />}
      </main>
    </div>
  );
}
