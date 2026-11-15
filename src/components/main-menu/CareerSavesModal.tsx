'use client';

import React, { useEffect, useState } from 'react';
import { NeoModal, NeoButton } from '@/components/neobrutalism';
import { listAllSaveSlots, FullCareerSavePayload } from '@/lib/engines/career/save-manager';
import { CareerSaveSlot } from '@/lib/types/career';
import { useGameStore } from '@/lib/store/game-store';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { Trophy, Calendar, Users, Shield, Play } from 'lucide-react';
import { FRANCHISES } from '@/lib/data/franchises';

export interface CareerSavesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CareerSavesModal({ isOpen, onClose }: CareerSavesModalProps) {
  const [slots, setSlots] = useState<{ slotNumber: number; metadata: CareerSaveSlot | null }[]>([]);
  const { loadFromSlot, resumeCareer } = useGameStore();

  useEffect(() => {
    if (isOpen) {
      setSlots(listAllSaveSlots());
    }
  }, [isOpen]);

  const handleLoad = (slotNumber: number) => {
    const success = loadFromSlot(slotNumber);
    if (success) {
      onClose();
      // Resume to saved phase
      const state = useGameStore.getState();
      if (state.phase === 'MainMenu') {
        resumeCareer();
      }
    } else {
      alert('Failed to load career save.');
    }
  };

  const hasAnySaves = slots.some((s) => s.metadata !== null);

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title="CAREER SAVE MANAGER"
      subtitle="Select a saved franchise profile to resume multi-season dynasty progression"
      size="lg"
    >
      <div className="space-y-4">
        {!hasAnySaves ? (
          <div className="terminal-card p-8 text-center bg-[var(--m-panel)] rounded-lg border border-[var(--m-line)]">
            <Shield className="w-12 h-12 mx-auto text-[var(--m-dim)]/40 mb-3" />
            <h4 className="font-bold text-sm uppercase text-[var(--m-text)]">NO SAVED DYNASTIES DETECTED</h4>
            <p className="text-xs text-[var(--m-dim)] font-medium mt-1">
              Start a new campaign from the main menu to begin tracking multi-season dynasty history.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {slots.map(({ slotNumber, metadata }) => {
              if (!metadata) {
                return (
                  <div
                    key={slotNumber}
                    className="terminal-card p-4 rounded-lg bg-[var(--m-panel)]/40 border border-dashed border-[var(--m-line)] text-center flex flex-col justify-center min-h-[140px]"
                  >
                    <div className="text-xs font-bold uppercase text-[var(--m-dim)]">
                      SLOT {slotNumber === 0 ? '0 (AUTOSAVE)' : slotNumber}
                    </div>
                    <div className="text-xs text-[var(--m-faint)] mt-1 font-medium">EMPTY SAVE SLOT</div>
                  </div>
                );
              }

              const theme = getTeamTheme(metadata.humanFranchiseId);
              const saveDate = new Date(metadata.savedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={slotNumber}
                  className="terminal-card p-4 rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] relative flex flex-col justify-between hover:border-[var(--m-accent-ink)]/50 transition-all"
                >
                  {/* Top Stripe */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: theme.primary }}
                  />

                  <div>
                    <div className="flex items-center justify-between mt-1 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--m-raised)] text-[var(--m-dim)] border border-[var(--m-line)]">
                        SLOT {slotNumber === 0 ? 'AUTOSAVE' : slotNumber}
                      </span>
                      <span className="text-[10px] text-[var(--m-dim)] font-mono">{saveDate}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded flex items-center justify-center font-bold text-sm tracking-wider text-ink"
                        style={{ backgroundColor: theme.primary }}
                      >
                        {FRANCHISES.find((f) => f.id === metadata.humanFranchiseId)?.abbreviation || 'IPL'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--m-text)] uppercase">
                          {metadata.humanFranchiseName}
                        </h4>
                        <div className="text-xs text-[var(--m-dim)] flex items-center gap-2 mt-0.5">
                          <span className="text-[var(--m-accent-ink)] font-semibold">Season {metadata.seasonYear}</span>
                          <span>•</span>
                          <span className="text-[var(--m-gold)] font-semibold flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> {metadata.championships} Titles
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--m-line)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--m-dim)] font-medium">Ready to Resume</span>
                    <NeoButton
                      size="sm"
                      variant="primary"
                      onClick={() => handleLoad(slotNumber)}
                      className="flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>LOAD</span>
                    </NeoButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </NeoModal>
  );
}
