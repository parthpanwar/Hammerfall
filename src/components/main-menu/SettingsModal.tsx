'use client';

import React, { useState } from 'react';
import { NeoModal, NeoButton } from '@/components/neobrutalism';
import { CPUDifficulty, AuctionPace } from '@/lib/types/game';
import { difficultyGuide } from '@/lib/data/difficulty-guide';
import { Zap, Layers, Shield, BookOpen, Volume2, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  difficulty: CPUDifficulty;
  setDifficulty: (d: CPUDifficulty) => void;
  auctionPace: AuctionPace;
  setAuctionPace: (p: AuctionPace) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  difficulty,
  setDifficulty,
  auctionPace,
  setAuctionPace,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'gameplay' | 'rules' | 'visuals'>('gameplay');
  const [expandedRule, setExpandedRule] = useState<string | null>('retentions');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [motionReduced, setMotionReduced] = useState(false);

  const toggleRule = (key: string) => {
    setExpandedRule(expandedRule === key ? null : key);
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title="GAME CONFIGURATION & IPL REGULATIONS"
      subtitle="Tune CPU general manager algorithms, auction pacing and review official tournament bylaws"
      size="lg"
    >
      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-[var(--m-line)] pb-3 mb-5 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gameplay')}
          className={`sports-btn px-4 py-2 text-xs font-bold uppercase rounded-md flex items-center gap-1.5 ${
            activeTab === 'gameplay'
              ? 'bg-[var(--m-accent-ink)] text-white border-blue-400/40 shadow-sm'
              : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-[var(--m-text)] border-[var(--m-line)]'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Gameplay & AI
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`sports-btn px-4 py-2 text-xs font-bold uppercase rounded-md flex items-center gap-1.5 ${
            activeTab === 'rules'
              ? 'bg-[var(--m-accent-ink)] text-white border-blue-400/40 shadow-sm'
              : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-[var(--m-text)] border-[var(--m-line)]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          IPL 2026 Official Rules
        </button>

        <button
          onClick={() => setActiveTab('visuals')}
          className={`sports-btn px-4 py-2 text-xs font-bold uppercase rounded-md flex items-center gap-1.5 ${
            activeTab === 'visuals'
              ? 'bg-[var(--m-accent-ink)] text-white border-blue-400/40 shadow-sm'
              : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-[var(--m-text)] border-[var(--m-line)]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Visuals & Audio
        </button>
      </div>

      {/* Tab 1: Gameplay & AI */}
      {activeTab === 'gameplay' && (
        <div className="space-y-4">
          {/* AI Difficulty */}
          <div className="terminal-card p-4 rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)]">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--m-text)] block mb-2.5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--m-gold)]" />
              CPU GM Bidding Intelligence Difficulty
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Easy', 'Normal', 'Hard', 'Expert'] as CPUDifficulty[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-2 px-3 text-xs font-bold uppercase rounded-md border transition-all ${
                    difficulty === level
                      ? 'bg-[var(--m-accent-ink)] text-white border-blue-400 shadow-sm'
                      : 'bg-[var(--m-raised)] text-[var(--m-dim)] border-[var(--m-line)] hover:border-[var(--m-line-strong)] hover:text-[var(--m-text)]'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--m-dim)] mt-2 font-medium">
              {difficultyGuide(difficulty).short} {difficultyGuide(difficulty).example}
            </p>
          </div>

          {/* Auction Speed */}
          <div className="terminal-card p-4 rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)]">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--m-text)] block mb-2.5 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--m-accent-ink)]" />
              Live Auction Pace & Timer Speed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Slow', 'Normal', 'Fast'] as AuctionPace[]).map((pace) => (
                <button
                  key={pace}
                  onClick={() => setAuctionPace(pace)}
                  className={`py-2 px-3 text-xs font-bold uppercase rounded-md border transition-all ${
                    auctionPace === pace
                      ? 'bg-[var(--m-accent-ink)] text-white border-blue-400 shadow-sm'
                      : 'bg-[var(--m-raised)] text-[var(--m-dim)] border-[var(--m-line)] hover:border-[var(--m-line-strong)] hover:text-[var(--m-text)]'
                  }`}
                >
                  {pace}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--m-dim)] mt-2 font-medium">
              Controls the interval before final hammer countdown triggers between AI bids.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: IPL 2026 Official Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {/* Rule 1: Retentions */}
          <div className="terminal-card rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] overflow-hidden">
            <button
              onClick={() => toggleRule('retentions')}
              className="w-full p-4 text-left flex items-center justify-between font-bold text-xs uppercase text-[var(--m-text)] hover:bg-[var(--m-raised)]"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--m-gold)]" />
                1. PLAYER RETENTIONS & PURSE DEDUCTIONS
              </span>
              {expandedRule === 'retentions' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedRule === 'retentions' && (
              <div className="p-4 pt-0 text-xs text-[var(--m-dim)] border-t border-[var(--m-line)]/60 space-y-2 mt-2 font-medium">
                <p>• Max 6 retentions per franchise prior to the Mega Auction.</p>
                <p>• Maximum of 5 capped players (Indian or Overseas).</p>
                <p>• Maximum of 2 uncapped Indian players (₹4.00 Cr deduction each).</p>
                <p>• Standard capped deduction brackets: ₹18 Cr, ₹14 Cr, ₹11 Cr, ₹18 Cr, ₹14 Cr.</p>
              </div>
            )}
          </div>

          {/* Rule 2: Auction Purse */}
          <div className="terminal-card rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] overflow-hidden">
            <button
              onClick={() => toggleRule('purse')}
              className="w-full p-4 text-left flex items-center justify-between font-bold text-xs uppercase text-[var(--m-text)] hover:bg-[var(--m-raised)]"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--m-green)]" />
                2. SQUAD CONSTRAINTS & SALARY CAP
              </span>
              {expandedRule === 'purse' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedRule === 'purse' && (
              <div className="p-4 pt-0 text-xs text-[var(--m-dim)] border-t border-[var(--m-line)]/60 space-y-2 mt-2 font-medium">
                <p>• Total Franchise Salary Cap: ₹120.00 Cr for the 2026 Mega Auction.</p>
                <p>• Minimum Squad Size: 18 players. Maximum Squad Size: 25 players.</p>
                <p>• Maximum Overseas Players in squad: 8 players (max 4 in playing XI).</p>
              </div>
            )}
          </div>

          {/* Rule 3: RTM Cards */}
          <div className="terminal-card rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] overflow-hidden">
            <button
              onClick={() => toggleRule('rtm')}
              className="w-full p-4 text-left flex items-center justify-between font-bold text-xs uppercase text-[var(--m-text)] hover:bg-[var(--m-raised)]"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--m-accent-ink)]" />
                3. RIGHT-TO-MATCH (RTM) MECHANICS
              </span>
              {expandedRule === 'rtm' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedRule === 'rtm' && (
              <div className="p-4 pt-0 text-xs text-[var(--m-dim)] border-t border-[var(--m-line)]/60 space-y-2 mt-2 font-medium">
                <p>• Number of available RTMs = 6 minus total players retained.</p>
                <p>• If winning bidder places highest bid, former team can exercise RTM to match price or counter-bid.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Visuals & Audio */}
      {activeTab === 'visuals' && (
        <div className="space-y-4">
          <div className="terminal-card p-4 rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-[var(--m-text)] flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[var(--m-accent-ink)]" />
                Auction Audio & Gavel Sound FX
              </div>
              <p className="text-[11px] text-[var(--m-dim)] mt-0.5">
                Play acoustic auction gavel strikes on final SOLD call
              </p>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase border transition-colors ${
                soundEnabled
                  ? 'bg-[var(--m-green)]/20 border-[var(--m-green)] text-[var(--m-green)]'
                  : 'bg-[var(--m-raised)] border-[var(--m-line)] text-[var(--m-dim)]'
              }`}
            >
              {soundEnabled ? 'ENABLED' : 'MUTED'}
            </button>
          </div>

          <div className="terminal-card p-4 rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-[var(--m-text)] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--m-gold)]" />
                Reduced Motion Mode
              </div>
              <p className="text-[11px] text-[var(--m-dim)] mt-0.5">
                Disable intense countdown pulse and stamp slam transitions
              </p>
            </div>
            <button
              onClick={() => setMotionReduced(!motionReduced)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase border transition-colors ${
                motionReduced
                  ? 'bg-[var(--m-green)]/20 border-[var(--m-green)] text-[var(--m-green)]'
                  : 'bg-[var(--m-raised)] border-[var(--m-line)] text-[var(--m-dim)]'
              }`}
            >
              {motionReduced ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Done Button */}
      <div className="mt-6 pt-4 border-t border-[var(--m-line)] flex justify-end">
        <NeoButton variant="primary" onClick={onClose}>
          SAVE & CLOSE SETTINGS
        </NeoButton>
      </div>
    </NeoModal>
  );
}
