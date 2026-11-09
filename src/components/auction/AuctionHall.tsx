'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import {
  nominatePlayer,
  getMinimumBid,
  placeBid,
  processFinalCall,
  getAuctionProgress,
  simulateAcceleratedCompletion,
} from '@/lib/engines/auction-engine';
import {
  cpuDecideBid,
  getPlayerTacticalRoles,
  FRANCHISE_STRATEGY_PROFILES,
  onAuctionLotCompleted,
  initializeFranchisePlans,
} from '@/lib/engines/cpu-manager';
import { createSeededRandom } from '@/lib/utils/random';
import { formatPrice } from '@/lib/utils';
import {
  Gavel,
  FastForward,
  Play,
  Pause,
  Users,
  Award,
  Shield,
  ArrowRight,
  TrendingUp,
  Flame,
  Zap,
  Sparkles,
  Brain,
} from 'lucide-react';
import type { AuctionSession, Franchise, Player } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { CpuDecisionInspectorModal } from './CpuDecisionInspectorModal';
import { SquadCompositionView } from '@/components/squad/SquadCompositionView';

export function AuctionHall() {
  const {
    auctionSession,
    setAuctionSession,
    humanFranchiseId,
    franchises,
    updateFranchise,
    setPhase,
    completeAuction,
  } = useGameStore();

  const [auctioneerMessage, setAuctioneerMessage] = useState<string>(
    'Welcome to the IPL 2026 Mega Auction! Press Start Auction to bring up the first lot.'
  );
  const [isAutoBidding, setIsAutoBidding] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'purses' | 'intel'>('purses');
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const autoBidTimerRef = useRef<NodeJS.Timeout | null>(null);

  const session = auctionSession;
  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);

  if (!session) {
    return <div className="p-8 text-center text-zinc-400 font-bold">Loading auction session...</div>;
  }

  const currentLot = session.currentLot;
  const isLotActive = currentLot && currentLot.state === 'Active';
  const isLotFinished = currentLot && (currentLot.state === 'Sold' || currentLot.state === 'Unsold');

  const highestBidder = currentLot?.currentBidderId
    ? franchises.find((f) => f.id === currentLot.currentBidderId)
    : null;

  const nextMinBid = getMinimumBid(session);
  const canHumanAfford = humanFranchise
    ? humanFranchise.remainingPurse >= nextMinBid &&
      humanFranchise.players.length < humanFranchise.maxSquadSize
    : false;

  const isHumanHighest = currentLot?.currentBidderId === humanFranchiseId;

  // Single step execution (one CPU bid or auctioneer progression)
  const executeAuctionStep = (currentSession: AuctionSession): AuctionSession => {
    const updated: AuctionSession = { ...currentSession };
    const rng = createSeededRandom(Math.floor(Math.random() * 1000000));

    // If no lot or lot is done, nominate next player
    if (!updated.currentLot || updated.currentLot.state === 'Sold' || updated.currentLot.state === 'Unsold') {
      const trans = nominatePlayer(updated);
      setAuctioneerMessage(trans.message);
      return updated;
    }

    const lot = updated.currentLot;
    const stepMinBid = getMinimumBid(updated);

    // Filter CPU bidders (exclude current highest bidder and human)
    const cpuBidders = updated.franchises.filter(
      (f) => f.id !== humanFranchiseId && f.id !== lot.currentBidderId
    );

    // Shuffle CPU order so each team has fair opportunity to counter
    const shuffledCPUs = [...cpuBidders].sort(() => Math.random() - 0.5);
    let cpuBidPlaced = false;

    for (const cpu of shuffledCPUs) {
      const decision = cpuDecideBid(cpu, lot, updated, rng);
      if (decision.bid) {
        const bidResult = placeBid(updated, cpu.id, stepMinBid);
        if (bidResult.success) {
          setAuctioneerMessage(`New bid of ${formatPrice(stepMinBid)} by ${cpu.name}!`);
          cpuBidPlaced = true;
          break;
        }
      }
    }

    // If no CPU wants to bid, advance final call or mark sold/unsold
    if (!cpuBidPlaced) {
      const trans = processFinalCall(updated);
      setAuctioneerMessage(trans.message);

      if (lot.state === 'Sold' && lot.currentBidderId) {
        const winningTeam = updated.franchises.find((f) => f.id === lot.currentBidderId);
        if (winningTeam) {
          updateFranchise(winningTeam.id, {
            remainingPurse: winningTeam.remainingPurse,
            players: winningTeam.players,
          });
        }
      }

      // Re-evaluate shortlists, update opponent model, and evolve CPU strategies
      if (lot.state === 'Sold' || lot.state === 'Unsold') {
        onAuctionLotCompleted(updated, lot);
      }
    }

    return updated;
  };

  const handleStartAuction = () => {
    const updated = { ...session };
    const rng = createSeededRandom(Date.now());
    initializeFranchisePlans(updated, rng);
    const trans = nominatePlayer(updated);
    setAuctioneerMessage(trans.message);
    setAuctionSession(updated);
  };

  const handleNominateNext = () => {
    const updated = { ...session };
    const trans = nominatePlayer(updated);
    setAuctioneerMessage(trans.message);
    setAuctionSession(updated);
  };

  const handleHumanBid = () => {
    if (!canHumanAfford || !session.currentLot || !isLotActive) return;
    const updated = { ...session };
    const res = placeBid(updated, humanFranchiseId, nextMinBid);
    if (res.success) {
      setAuctioneerMessage(`You raised your paddle! Current bid: ${formatPrice(nextMinBid)}`);
      setAuctionSession(updated);
    } else {
      alert(res.message);
    }
  };

  const handleNextCall = () => {
    if (!session.currentLot) {
      handleStartAuction();
      return;
    }
    const nextSession = executeAuctionStep(session);
    setAuctionSession(nextSession);
  };

  const handleFastForwardLot = () => {
    let current = { ...session };
    if (!current.currentLot || current.currentLot.state !== 'Active') {
      current = executeAuctionStep(current);
    }

    let iterations = 0;
    while (current.currentLot && current.currentLot.state === 'Active' && iterations < 40) {
      current = executeAuctionStep(current);
      iterations++;
    }
    setAuctionSession(current);
  };

  const handleSimulateFiveLots = () => {
    let current = { ...session };
    for (let i = 0; i < 5; i++) {
      if (
        current.currentPlayerIndex >= current.playerPool.length &&
        (!current.currentLot || current.currentLot.state !== 'Active')
      ) {
        break;
      }
      let it = 0;
      while (current.currentLot && current.currentLot.state === 'Active' && it < 40) {
        current = executeAuctionStep(current);
        it++;
      }
      current = executeAuctionStep(current);
    }
    setAuctionSession(current);
  };

  const handleSimulateEntireAuction = () => {
    let current = { ...session };
    let safetyCounter = 0;
    while (
      (current.currentPlayerIndex < current.playerPool.length ||
        (current.currentLot && current.currentLot.state === 'Active')) &&
      safetyCounter < 3000
    ) {
      current = executeAuctionStep(current);
      safetyCounter++;
    }
    // Guarantee 100% squad completion compliance across all 10 franchises
    simulateAcceleratedCompletion(current);
    completeAuction();
    setAuctionSession(current);
    setShowSummary(true);
  };

  useEffect(() => {
    if (isAutoBidding && isLotActive) {
      autoBidTimerRef.current = setInterval(() => {
        const prev = useGameStore.getState().auctionSession;
        if (!prev) return;
        const next = executeAuctionStep(prev);
        if (next.currentLot?.state !== 'Active') {
          setIsAutoBidding(false);
        }
        setAuctionSession(next);
      }, 1200);
    } else {
      if (autoBidTimerRef.current) clearInterval(autoBidTimerRef.current);
    }

    return () => {
      if (autoBidTimerRef.current) clearInterval(autoBidTimerRef.current);
    };
  }, [isAutoBidding, isLotActive]);

  const handleFinishAndProceed = () => {
    if (!humanFranchise || humanFranchise.players.length < 15) {
      alert(
        `Squad incomplete! IPL regulations require a minimum of 15 players in your squad (currently ${
          humanFranchise?.players.length || 0
        }/15). Please purchase more players or simulate remaining auction rounds.`
      );
      return;
    }
    completeAuction();
    setPhase('SquadManagement');
  };

  const isAuctionCompleted =
    session.currentPlayerIndex >= session.playerPool.length &&
    (!currentLot || currentLot.state !== 'Active');

  const progressPct = getAuctionProgress(session);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Progress & Auction Fast Controls (Neo-Box) */}
      <div className="neo-box p-4 sm:p-5 rounded-2xl bg-zinc-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center shadow-[2.5px_2.5px_0px_#000]"
            style={{
              backgroundColor: theme.primary,
              color: theme.textLight,
            }}
          >
            <Gavel className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black uppercase text-white tracking-tight">
                IPL 2026 MEGA AUCTION
              </h2>
              <span className="neo-badge px-2 py-0.5 rounded bg-amber-400 text-black text-[11px]">
                LOT {Math.max(1, session.currentPlayerIndex + 1)} OF {session.playerPool.length}
              </span>
            </div>
            <div className="text-xs text-zinc-400 font-bold flex flex-wrap items-center gap-2 mt-1">
              <span className="text-emerald-400">SOLD: {session.soldPlayers.length}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-red-400">UNSOLD: {session.unsoldPlayers.length}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300">ROUND {session.round}/{session.totalRounds}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-amber-400">PROGRESS: {progressPct}%</span>
            </div>
          </div>
        </div>

        {/* Action Controls (Neo-Buttons) */}
        <div className="flex flex-wrap items-center gap-2">
          {isLotActive && (
            <>
              <button
                onClick={() => setIsAutoBidding(!isAutoBidding)}
                className={`neo-btn px-3.5 py-1.5 rounded-lg text-xs uppercase flex items-center gap-1.5 ${
                  isAutoBidding ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-200 hover:text-white'
                }`}
              >
                {isAutoBidding ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause Auto-Bid
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Live Auto-Bid
                  </>
                )}
              </button>

              <button
                onClick={handleFastForwardLot}
                className="neo-btn px-3.5 py-1.5 rounded-lg text-xs uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              >
                Fast-Forward Lot
              </button>
            </>
          )}

          <button
            onClick={handleSimulateFiveLots}
            className="neo-btn px-3.5 py-1.5 rounded-lg text-xs uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            Simulate 5 Lots
          </button>

          <button
            onClick={handleSimulateEntireAuction}
            className="neo-btn px-3.5 py-1.5 rounded-lg text-xs uppercase bg-amber-400 text-black hover:bg-amber-300"
          >
            Simulate All & Finish
          </button>

          <button
            onClick={() => setShowInspector(true)}
            className="neo-btn px-3.5 py-1.5 rounded-lg text-xs uppercase bg-zinc-900 border border-zinc-700 hover:border-amber-400 text-amber-300 font-black flex items-center gap-1.5"
          >
            <Brain className="w-3.5 h-3.5" />
            CPU AI Inspector
          </button>

          {isAuctionCompleted && humanFranchise && humanFranchise.players.length >= 15 && (
            <button
              onClick={handleFinishAndProceed}
              className="neo-btn px-4 py-2 rounded-xl text-xs uppercase bg-emerald-400 text-black font-black"
            >
              Proceed to Playing XI
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Live Auction Podium (2 cols) & Franchise Purses (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* STAGE 0: Auction Not Started Yet */}
          {!currentLot && (
            <div
              className="neo-box-lg p-8 sm:p-12 text-center rounded-3xl relative overflow-hidden"
              style={{
                backgroundColor: theme.cardBg,
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl border-[3px] border-black flex items-center justify-center mx-auto mb-5 shadow-[4px_4px_0px_#000]"
                style={{
                  backgroundColor: theme.primary,
                  color: theme.textLight,
                }}
              >
                <Gavel className="w-10 h-10 stroke-[2.5]" />
              </div>

              <span className="neo-badge px-3 py-1 rounded bg-amber-400 text-black text-xs">
                STAGE 1 • MARQUEE SETS UNDER THE HAMMER
              </span>

              <h3 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight mt-4">
                THE STAGE IS SET
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 font-medium max-w-lg mx-auto mt-2 leading-relaxed">
                All 10 IPL franchises have taken their seats at the auction tables.
                World-class batters, express pacers, mystery spinners, and match-winning all-rounders await your bids.
              </p>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleStartAuction}
                  className="neo-btn px-8 py-4 rounded-2xl text-base uppercase font-black tracking-wider flex items-center gap-2.5 transition-transform"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.textLight,
                  }}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>START MEGA AUCTION (LOT #1)</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 1 & 2: Active or Concluded Lot (Neo-Brutalist Trading Desk) */}
          {currentLot && (
            <div
              className="neo-box-lg p-6 rounded-3xl relative overflow-hidden space-y-4"
              style={{
                backgroundColor: theme.cardBg,
              }}
            >
              {/* Dynamic Auction Set Display */}
              <div className="bg-black/70 border-2 border-black rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center gap-2.5">
                  <div className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-black text-xs uppercase border border-black shadow-[1.5px_1.5px_0px_#000]">
                    {currentLot.auctionSetCode || 'SET'}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Current Set
                    </div>
                    <div className="font-black text-white text-sm sm:text-base uppercase tracking-tight">
                      {currentLot.auctionSetName || 'Official Auction Pool'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Player X of Y in Set */}
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-black uppercase text-zinc-400">Set Progress</div>
                    <div className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                      Player {currentLot.playerOrderWithinSet || 1} of {currentLot.totalInSet || 1}
                      {currentLot.playerOrderWithinSet === currentLot.totalInSet && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-400 text-black text-[9px] uppercase font-black">
                          FINAL LOT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Next Set Preview */}
                  {currentLot.nextSetName && (
                    <div className="hidden md:block pl-3 border-l border-zinc-700 text-right">
                      <div className="text-[10px] font-black uppercase text-zinc-400">Next Set</div>
                      <div className="font-black text-zinc-300 text-xs truncate max-w-[150px]">
                        {currentLot.nextSetName}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2.5">
                  {isLotActive ? (
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="neo-badge px-2 py-0.5 rounded bg-emerald-400 text-black text-[11px]">
                        LIVE BIDDING STAGE
                      </span>
                    </div>
                  ) : currentLot.state === 'Sold' ? (
                    <span className="neo-badge px-2.5 py-0.5 rounded bg-emerald-400 text-black text-xs font-black">
                      ✓ SOLD UNDER THE HAMMER
                    </span>
                  ) : (
                    <span className="neo-badge px-2.5 py-0.5 rounded bg-red-500 text-white text-xs font-black">
                      ✕ UNSOLD
                    </span>
                  )}
                </div>

                <div className="text-xs text-zinc-300 font-bold">
                  BASE PRICE:{' '}
                  <span className="text-white font-black">{formatPrice(currentLot.basePrice)}</span>
                </div>
              </div>

              {/* Player Spotlight Card */}
              <div className="py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-tight">
                      {currentLot.player.name}
                    </h3>
                    {currentLot.player.nationality === 'Overseas' && (
                      <span className="neo-badge px-2 py-0.5 rounded bg-sky-400 text-black text-[10px]">
                        ✈ {currentLot.player.country}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-300 font-bold mt-1">
                    {currentLot.player.role} • {currentLot.player.battingHand} Bat • {currentLot.player.bowlingStyle}
                  </div>

                  {/* Rating Badges (Neo-Brutalist Pills) */}
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    <span
                      className="neo-badge text-xs px-2.5 py-1 rounded-lg"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.textLight,
                      }}
                    >
                      {currentLot.player.ratings.overall} OVR
                    </span>
                    <span className="neo-badge text-xs px-2.5 py-1 rounded-lg bg-black text-zinc-200">
                      BAT {currentLot.player.ratings.batting}
                    </span>
                    <span className="neo-badge text-xs px-2.5 py-1 rounded-lg bg-black text-zinc-200">
                      BOWL {currentLot.player.ratings.bowling}
                    </span>
                    <span className="neo-badge text-xs px-2.5 py-1 rounded-lg bg-black text-amber-400">
                      POWER {currentLot.player.ratings.powerHitting}
                    </span>
                  </div>

                  {/* Tactical Roles Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">ROLES:</span>
                    {getPlayerTacticalRoles(currentLot.player).map((role) => (
                      <span
                        key={role}
                        className="neo-badge text-[9px] px-2 py-0.5 rounded bg-zinc-950 text-amber-300"
                      >
                        {role}
                      </span>
                    ))}

                    <button
                      onClick={() => setScoutingPlayer(currentLot.player)}
                      className="neo-btn text-[10px] px-2.5 py-0.5 rounded-md bg-amber-400 text-black font-black uppercase ml-1 flex items-center gap-1 hover:bg-amber-300"
                    >
                      <Sparkles className="w-3 h-3 fill-black" />
                      <span>SCOUT DOSSIER</span>
                    </button>
                  </div>
                </div>

                {/* Big Price Display (Crypto Trading Ticker Neo-Style) */}
                <div className="neo-box p-5 rounded-2xl bg-black min-w-[220px] text-center">
                  <div className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">
                    {currentLot.state === 'Sold' ? 'FINAL HAMMER PRICE' : 'CURRENT HIGH BID'}
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-400 my-1">
                    {formatPrice(currentLot.currentBid)}
                  </div>
                  {highestBidder ? (
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <span
                        className="w-5 h-5 rounded border border-black flex items-center justify-center text-[10px] font-black"
                        style={{
                          backgroundColor: highestBidder.colors.primary,
                          color: highestBidder.colors.text,
                        }}
                      >
                        {highestBidder.abbreviation}
                      </span>
                      <span className="text-xs font-black text-white truncate max-w-[130px]">
                        {highestBidder.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 font-bold italic">No bids yet</span>
                  )}
                </div>
              </div>

              {/* Auctioneer Message & Gavel Banner */}
              <div
                className={`neo-box-sm p-3.5 rounded-xl text-center my-2 font-black text-xs sm:text-sm flex items-center justify-center gap-2 ${
                  currentLot.state === 'Sold'
                    ? 'bg-emerald-400 text-black'
                    : currentLot.state === 'Unsold'
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-400 text-black'
                }`}
              >
                <Gavel className="w-4 h-4 shrink-0 stroke-[3]" />
                <span>{auctioneerMessage}</span>
              </div>

              {/* Interactive Bidding Controls (Neo-Buttons) */}
              {isLotActive ? (
                <div className="pt-4 border-t-2 border-black grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleHumanBid}
                    disabled={!canHumanAfford || isHumanHighest}
                    className={`neo-btn py-4 rounded-xl text-xs sm:text-sm font-black tracking-wider uppercase transition-all ${
                      isHumanHighest
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                        : 'bg-emerald-400 hover:bg-emerald-300 text-black'
                    }`}
                  >
                    {isHumanHighest ? (
                      'YOU ARE HIGHEST BIDDER'
                    ) : (
                      `RAISE PADDLE (${formatPrice(nextMinBid)})`
                    )}
                  </button>

                  <button
                    onClick={handleNextCall}
                    className="neo-btn py-4 rounded-xl text-xs sm:text-sm font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-white"
                  >
                    PASS / CALL NEXT BID
                  </button>

                  <button
                    onClick={handleFastForwardLot}
                    className="neo-btn py-4 rounded-xl text-xs sm:text-sm font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    FAST-FORWARD LOT
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs font-bold text-zinc-300">
                    {currentLot.state === 'Sold'
                      ? `Lot awarded to ${highestBidder?.name} for ${formatPrice(currentLot.currentBid)}`
                      : `${currentLot.player.name} passed through unsold.`}
                  </div>

                  <button
                    onClick={handleNominateNext}
                    className="neo-btn px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-amber-400 text-black hover:bg-amber-300"
                  >
                    <span>BRING UP NEXT PLAYER</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bidding Log for Current Lot */}
          {currentLot && currentLot.bids.length > 0 && (
            <div className="neo-box p-4 rounded-2xl bg-zinc-950">
              <div className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
                <span>LIVE BIDDING AUDIT LOG</span>
                <span className="neo-badge px-2 py-0.5 rounded bg-black text-amber-400 text-[10px]">
                  {currentLot.bids.length} BIDS RECORDED
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {currentLot.bids.map((b, i) => {
                  const bidder = franchises.find((f) => f.id === b.franchiseId);
                  const isYou = b.franchiseId === humanFranchiseId;
                  return (
                    <div
                      key={i}
                      className={`neo-badge px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 ${
                        isYou
                          ? 'bg-amber-400 text-black'
                          : 'bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      <span>{bidder?.shortName || b.franchiseId}</span>
                      <span className="font-black">{formatPrice(b.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: All 10 Franchises Live Budget & AI War Room Intel */}
        <div className="space-y-4">
          {humanFranchise && (
            <SquadCompositionView franchise={humanFranchise} compact={true} />
          )}

          <div className="neo-box p-4 rounded-2xl bg-zinc-950">
            {/* Sidebar Tab Header */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarTab('purses')}
                  className={`neo-btn text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg ${
                    sidebarTab === 'purses'
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  PURSES
                </button>
                <button
                  onClick={() => setSidebarTab('intel')}
                  className={`neo-btn text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg ${
                    sidebarTab === 'intel'
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  WAR ROOM AI
                </button>
              </div>
              <span className="neo-badge px-2 py-0.5 rounded bg-black text-zinc-400 text-[10px]">
                10 TEAMS
              </span>
            </div>

            {sidebarTab === 'purses' ? (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {franchises.map((f) => {
                  const isHuman = f.id === humanFranchiseId;
                  const fTheme = getTeamTheme(f.id);
                  const overseasInSquad = f.players.filter((p) => p.nationality === 'Overseas').length;
                  return (
                    <div
                      key={f.id}
                      className={`neo-box-sm p-2.5 rounded-xl flex items-center justify-between transition-all ${
                        isHuman
                          ? 'bg-zinc-900 ring-2 ring-amber-400'
                          : 'bg-zinc-900/80 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shadow-[1.5px_1.5px_0px_#000]"
                          style={{
                            backgroundColor: fTheme.primary,
                            color: fTheme.textLight,
                          }}
                        >
                          {f.abbreviation}
                        </div>
                        <div>
                          <div className="font-black text-xs text-white flex items-center gap-1.5">
                            {f.shortName}
                            {isHuman && (
                              <span className="neo-badge text-[9px] px-1 py-0.2 rounded bg-amber-400 text-black">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-bold">
                            {f.players.length} players ({overseasInSquad} OS)
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-emerald-400">
                          {formatPrice(f.remainingPurse)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-bold">
                          slots: {f.maxSquadSize - f.players.length}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {franchises.map((f) => {
                  const profile = FRANCHISE_STRATEGY_PROFILES[f.id];
                  const fTheme = getTeamTheme(f.id);
                  return (
                    <div
                      key={f.id}
                      className="neo-box-sm p-3 rounded-xl bg-zinc-900 text-xs space-y-1.5"
                    >
                      <div className="flex items-center gap-2 font-black text-white">
                        <span
                          className="w-6 h-6 rounded border border-black flex items-center justify-center font-black text-[10px]"
                          style={{
                            backgroundColor: fTheme.primary,
                            color: fTheme.textLight,
                          }}
                        >
                          {f.abbreviation}
                        </span>
                        <span>{f.name}</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">
                        {profile?.behaviorDescription || f.gmPersonality}
                      </p>
                      {profile && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {profile.primaryTendencies.map((tendency) => (
                            <span
                              key={tendency}
                              className="neo-badge text-[9px] px-1.5 py-0.5 rounded bg-black text-amber-400"
                            >
                              {tendency}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player Intelligence Scouting Dossier Modal */}
      {scoutingPlayer && humanFranchise && (
        <PlayerScoutingModal
          player={scoutingPlayer}
          franchise={humanFranchise}
          onClose={() => setScoutingPlayer(null)}
        />
      )}

      {/* CPU AI Decision Inspector Modal */}
      {showInspector && (
        <CpuDecisionInspectorModal
          session={session}
          onClose={() => setShowInspector(false)}
        />
      )}
    </div>
  );
}
