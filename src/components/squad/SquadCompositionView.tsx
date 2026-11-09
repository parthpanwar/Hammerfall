'use client';

import React from 'react';
import type { Franchise } from '@/lib/types/game';
import type { SquadRules } from '@/lib/types/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';
import { analyzeSquadComposition } from '@/lib/engines/squad-rules';
import { formatPrice } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle2, Users, Globe, Award, DollarSign } from 'lucide-react';

interface SquadCompositionViewProps {
  franchise: Franchise;
  rules?: SquadRules;
  compact?: boolean;
}

export function SquadCompositionView({
  franchise,
  rules = OFFICIAL_IPL_SQUAD_RULES,
  compact = false,
}: SquadCompositionViewProps) {
  const comp = analyzeSquadComposition(franchise, rules);

  const squadProgress = Math.min(100, Math.round((comp.totalPlayers / rules.maxSquadSize) * 100));
  const overseasProgress = Math.min(100, Math.round((comp.overseasPlayers / rules.maxOverseas) * 100));

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-black/60 p-2.5 rounded-xl border-[2px] border-black text-xs">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-300">Squad:</span>
          <span
            className={`font-black ${
              comp.totalPlayers >= rules.minSquadSize ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {comp.totalPlayers}/{rules.maxSquadSize}
          </span>
          <span className="text-[10px] text-zinc-500 font-medium">(min {rules.minSquadSize})</span>
        </div>

        <div className="h-3 w-[1px] bg-zinc-700" />

        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-bold text-zinc-300">Overseas:</span>
          <span
            className={`font-black ${
              comp.overseasPlayers > rules.maxOverseas ? 'text-red-400' : 'text-sky-300'
            }`}
          >
            {comp.overseasPlayers}/{rules.maxOverseas}
          </span>
        </div>

        <div className="h-3 w-[1px] bg-zinc-700" />

        <div className="flex items-center gap-1.5 ml-auto">
          {comp.isLegal ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 uppercase bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
              <CheckCircle2 className="w-3 h-3 stroke-[3]" /> Legal Squad
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 uppercase bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
              <AlertTriangle className="w-3 h-3 stroke-[3]" /> Deficit ({comp.minSlotsNeeded} req)
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="neo-box p-5 rounded-2xl bg-zinc-900 border-[2.5px] border-black shadow-[4px_4px_0px_#000] space-y-4">
      {/* Title & Overall Legality Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <h3 className="font-black text-white text-base tracking-wide uppercase">
            Official IPL Squad Constraints
          </h3>
        </div>

        {comp.isLegal ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-black font-black text-xs uppercase border-[2px] border-black shadow-[2px_2px_0px_#000]">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            Official Legal Squad
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400 text-black font-black text-xs uppercase border-[2px] border-black shadow-[2px_2px_0px_#000]">
            <AlertTriangle className="w-4 h-4 stroke-[3]" />
            {comp.minSlotsNeeded > 0
              ? `Needs ${comp.minSlotsNeeded} More Player${comp.minSlotsNeeded > 1 ? 's' : ''}`
              : 'Action Required'}
          </div>
        )}
      </div>

      {/* Constraints Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Squad Count (18-25) */}
        <div className="p-3.5 rounded-xl bg-black/50 border-[2px] border-black">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-zinc-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-400" /> Total Squad Size
            </span>
            <span className="text-white font-black text-sm">
              {comp.totalPlayers} <span className="text-zinc-500 font-bold">/ {rules.maxSquadSize}</span>
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden relative">
            {/* Target 18 marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${(rules.minSquadSize / rules.maxSquadSize) * 100}%` }}
              title={`Min legal threshold: ${rules.minSquadSize}`}
            />
            <div
              className={`h-full transition-all duration-300 ${
                comp.totalPlayers < rules.minSquadSize
                  ? 'bg-amber-400'
                  : comp.totalPlayers <= rules.maxSquadSize
                  ? 'bg-emerald-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${squadProgress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium mt-1">
            <span>0</span>
            <span className="text-amber-400 font-black">Min 18 Required</span>
            <span>Max 25</span>
          </div>
        </div>

        {/* Overseas Players (Max 8) */}
        <div className="p-3.5 rounded-xl bg-black/50 border-[2px] border-black">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-zinc-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" /> Overseas Limit
            </span>
            <span className="text-white font-black text-sm">
              {comp.overseasPlayers} <span className="text-zinc-500 font-bold">/ {rules.maxOverseas}</span>
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                comp.overseasPlayers <= rules.maxOverseas ? 'bg-sky-400' : 'bg-red-500'
              }`}
              style={{ width: `${overseasProgress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium mt-1">
            <span>0</span>
            <span className="text-zinc-400">{comp.remainingOverseasSlots} slots available</span>
            <span className="text-sky-300 font-black">Max 8 Ceiling</span>
          </div>
        </div>
      </div>

      {/* Composition Breakdown Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Indian Players</div>
          <div className="text-lg font-black text-amber-400 mt-0.5">{comp.indianPlayers}</div>
          <div className="text-[10px] text-zinc-500 font-medium">
            {comp.cappedIndian} Capped • {comp.uncappedIndian} Uncapped
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Overseas Players</div>
          <div className="text-lg font-black text-sky-400 mt-0.5">{comp.overseasPlayers}</div>
          <div className="text-[10px] text-zinc-500 font-medium">
            {comp.cappedOverseas} Capped • {comp.uncappedOverseas} Uncapped
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Role Balance</div>
          <div className="text-xs font-black text-white mt-1 space-x-1">
            <span title="Batters">{comp.batters} BAT</span> •
            <span title="Bowlers">{comp.bowlers} BOWL</span> •
            <span title="All-Rounders">{comp.allRounders} AR</span> •
            <span title="Wicketkeepers">{comp.wicketkeepers} WK</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-0.5">Tactical Spread</div>
        </div>

        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Purse Reserve</div>
          <div className="text-lg font-black text-emerald-400 mt-0.5">
            {formatPrice(comp.remainingPurse)}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium">
            {comp.minSlotsNeeded > 0
              ? `₹${comp.minSlotsNeeded * 20}L reserved for slots`
              : 'Sufficient balance'}
          </div>
        </div>
      </div>

      {/* Validation Warnings / Errors if any */}
      {comp.validationErrors.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1">
          <div className="font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Rule Notes
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-zinc-300">
            {comp.validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

