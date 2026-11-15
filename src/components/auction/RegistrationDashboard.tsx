'use client';

// ============================================================
// IPL DYNASTY — Player Pool (registered players for the auction)
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { ChevronRight } from 'lucide-react';
import type { Player } from '@/lib/types/game';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { MButton, PageHero, Panel, StatTile } from '@/components/mynba/primitives';
import { PlayerPoolTable } from '@/components/mynba/PlayerPoolTable';
import { auctionTypeFor } from '@/lib/flow/season-flow';

export function RegistrationDashboard() {
  const {
    humanFranchiseId,
    franchises,
    registrationPool,
    franchiseShortlists,
    updateHumanShortlist,
    removeHumanShortlist,
    setPhase,
    currentSeason,
    settings,
  } = useGameStore();
  const [scouting, setScouting] = useState<Player | null>(null);
  const human = franchises.find((f) => f.id === humanFranchiseId);
  const shortlist = franchiseShortlists[humanFranchiseId]?.entries || {};

  const isMega = auctionTypeFor(currentSeason, settings) === 'Mega';
  const s = useMemo(() => {
    const by = (fn: (p: Player) => boolean) => registrationPool.filter(fn).length;
    return {
      total: registrationPool.length,
      overseas: by((p) => p.nationality === 'Overseas'),
      elite: by((p) => p.ratings.overall >= 84),
    };
  }, [registrationPool]);
  const tagged = Object.keys(shortlist).length;

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHero
        franchiseId={humanFranchiseId}
        kicker={`IPL ${currentSeason} offseason`}
        title="The Player Pool"
        subtitle={
          <>
            {s.total} players are registered for the IPL {currentSeason} {isMega ? 'mega' : 'mini'} auction, held in {isMega ? 'November' : 'December'} {currentSeason - 1}. Tag the ones you want with A, B or C
            (or the star) — your shortlist carries into the Scouting room and the auction.
          </>
        }
        right={
          <MButton variant="primary" size="lg" onClick={() => setPhase('Scouting')}>
            Scouting room <ChevronRight className="w-4 h-4" />
          </MButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Registered" value={s.total} />
        <StatTile label="Overseas" value={s.overseas} tone="gold" />
        <StatTile label="Elite (84+ OVR)" value={s.elite} tone="red" />
        <StatTile label="On your shortlist" value={tagged} tone="green" sub={tagged ? 'Rank them in Scouting' : 'Nobody tagged yet'} />
      </div>

      <Panel title="Registered players" bodyClassName="p-0">
        <PlayerPoolTable
          players={registrationPool}
          shortlist={shortlist}
          onPriority={(id, p) => updateHumanShortlist(id, p)}
          onRemove={removeHumanShortlist}
          onScout={setScouting}
        />
      </Panel>

      {scouting && <PlayerScoutingModal player={scouting} franchise={human} onClose={() => setScouting(null)} />}
    </div>
  );
}
