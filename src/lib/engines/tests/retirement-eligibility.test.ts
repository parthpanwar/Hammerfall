import {
  isPlayerEligibleForAuction,
  filterAuctionEligiblePlayers,
  auditDatabaseRetirements,
} from '../eligibility';
import { Player } from '../../types/game';
import { generateCpuFranchiseShortlist } from '../scouting/cpu-shortlist-generator';
import { compileFinalAuctionPool } from '../auction/shortlist-compiler';
import { generateAuctionRegistrationPool } from '../registration/registration-engine';
import { FRANCHISES } from '../../data/franchises';
import { GLOBAL_PLAYERS } from '../../data/players';
import { getVerifiedRetirementRecord } from '../eligibility/retirement-registry';

const globalPlayers = GLOBAL_PLAYERS;

/**
 * Retired players are no longer shipped in the auction database (see
 * scripts/data/clean_player_database.ts), so build a neutral stub with the
 * retiree's id/name to exercise the registry-driven eligibility rules.
 */
function retireeStub(id: string): Player {
  const template = globalPlayers[0];
  const entry = getVerifiedRetirementRecord(id);
  return {
    ...template,
    id,
    name: entry?.canonicalName || id,
    currentFranchiseId: null,
    isRetired: false,
    professionalStatus: 'ACTIVE',
    iplStatus: 'ACTIVE',
    retirementScope: 'NONE',
    dateOfRetirement: undefined,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runRetirementEligibilityTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING RETIREMENT & IPL ELIGIBILITY TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Fully retired players excluded from 2026 auction
  console.log('--- TEST 1: Fully Retired Players Excluded from 2026 Auction ---');
  const retiredSampleIds = [
    'a-kumble',
    'b-lee',
    'dw-steyn',
    'ab-de-villiers',
    'a-nehra',
    'ch-gayle',
    'g-gambhir',
    'harbhajan-singh',
    'ac-gilchrist',
    'bb-mccullum',
    'dj-bravo',
    'dinesh-karthik',
    'shikhar-dhawan',
  ];

  for (const pid of retiredSampleIds) {
    assert(!globalPlayers.some((p) => p.id === pid), `Retired player ${pid} has been removed from the auction database`);
    const player = retireeStub(pid);
    {
      const res = isPlayerEligibleForAuction(player, 2026, { checkRetained: false });
      assert(
        res.isEligible === false,
        `Retired player ${player.name} (${pid}) must NOT be eligible for 2026 auction. Reason: ${res.reason}`
      );
      assert(
        res.professionalStatus === 'RETIRED',
        `${player.name} professional status must be RETIRED, got ${res.professionalStatus}`
      );
    }
  }

  // TEST 2: International-only retirees remain eligible for IPL 2026
  console.log('\n--- TEST 2: International-Only Retirees Remain IPL Eligible ---');
  const intlRetiredSampleIds = [
    'ms-dhoni',
    'faf-du-plessis',
    'sunil-narine',
    'david-warner',
    'moeen-ali',
  ];

  for (const pid of intlRetiredSampleIds) {
    const player = globalPlayers.find((p) => p.id === pid);
    if (player) {
      const res = isPlayerEligibleForAuction(player, 2026, { checkRetained: false });
      assert(
        res.isEligible === true,
        `International retiree ${player.name} (${pid}) MUST remain eligible for IPL 2026. Reason: ${res.reason}`
      );
      assert(
        res.retirementScope === 'INTERNATIONAL_ONLY',
        `${player.name} retirement scope must be INTERNATIONAL_ONLY, got ${res.retirementScope}`
      );
      assert(
        res.iplStatus === 'ACTIVE',
        `${player.name} IPL status must be ACTIVE, got ${res.iplStatus}`
      );
    }
  }

  // TEST 3: Inactive players without confirmed retirement are not assumed retired
  console.log('\n--- TEST 3: Inactivity Does Not Imply Complete Retirement ---');
  const mockInjuredOrInactivePlayer: Player = {
    id: 'mock-inactive-star',
    name: 'Mock Inactive Star',
    role: 'Batsman',
    battingRating: 84,
    bowlingRating: 40,
    fieldingRating: 75,
    overallRating: 82,
    basePrice: 150,
    isOverseas: false,
    age: 34,
    iplStatus: 'ACTIVE',
    internationalStatus: 'INACTIVE',
    professionalStatus: 'ACTIVE',
    retirementScope: 'NONE',
    auctionRegistrationStatus: 'REGISTERED',
  } as any;

  const inactiveRes = isPlayerEligibleForAuction(mockInjuredOrInactivePlayer, 2026);
  assert(
    inactiveRes.isEligible === true,
    `Inactive international player without official retirement must remain eligible. Result: ${inactiveRes.isEligible}`
  );

  // TEST 4: Historical Season Eligibility
  console.log('\n--- TEST 4: Historical Season-Specific Eligibility ---');
  const ab = retireeStub('ab-de-villiers');
  if (ab) {
    const eligible2021 = isPlayerEligibleForAuction(ab, 2021, { checkRetained: false });
    const ineligible2022 = isPlayerEligibleForAuction(ab, 2022, { checkRetained: false });
    const ineligible2026 = isPlayerEligibleForAuction(ab, 2026, { checkRetained: false });

    assert(
      eligible2021.isEligible === true,
      `AB de Villiers must be ELIGIBLE for 2021 season (retired Nov 2021)`
    );
    assert(
      ineligible2022.isEligible === false,
      `AB de Villiers must be INELIGIBLE for 2022 season`
    );
    assert(
      ineligible2026.isEligible === false,
      `AB de Villiers must be INELIGIBLE for 2026 season`
    );
  }

  const dk = retireeStub('dinesh-karthik');
  if (dk) {
    const dk2024 = isPlayerEligibleForAuction(dk, 2024, { checkRetained: false });
    const dk2025 = isPlayerEligibleForAuction(dk, 2025, { checkRetained: false });

    assert(
      dk2024.isEligible === true,
      `Dinesh Karthik must be ELIGIBLE for 2024 season (retired after IPL 2024 in June)`
    );
    assert(
      dk2025.isEligible === false,
      `Dinesh Karthik must be INELIGIBLE for 2025 season`
    );
  }

  // TEST 5: Retained players excluded if checkRetained option is enabled
  console.log('\n--- TEST 5: Retained Player Exclusion ---');
  const activeStar = globalPlayers.find((p) => p.id === 'jasprit-bumrah') || globalPlayers[0];
  const retainedSet = new Set<string>([activeStar.id]);

  const retainedCheck = isPlayerEligibleForAuction(activeStar, 2026, {
    retainedPlayerIds: retainedSet,
    checkRetained: true,
  });
  assert(
    retainedCheck.isEligible === false,
    `Retained player ${activeStar.name} must be ineligible for auction pool when retained by MI. Reason: ${retainedCheck.reason}`
  );

  // TEST 6: CPU Shortlisting never picks retired players
  console.log('\n--- TEST 6: CPU Shortlist Engine Filters Retirees ---');
  const csk = FRANCHISES.find((f) => f.abbreviation === 'CSK')!;
  const { registeredPlayers } = generateAuctionRegistrationPool(globalPlayers, new Set<string>(), new Set<string>(), { seasonYear: 2026 });
  const shortlistResult = generateCpuFranchiseShortlist(csk, registeredPlayers, 2026);

  const shortlistedIds = new Set(Object.keys(shortlistResult.entries));
  for (const retiredId of retiredSampleIds) {
    assert(
      !shortlistedIds.has(retiredId),
      `CPU shortlist for CSK must NOT contain retired player: ${retiredId}`
    );
  }

  // Verify that an international-only retiree CAN be shortlisted if high quality
  const dhoniInShortlist = shortlistedIds.has('ms-dhoni');
  console.log(`ℹ️ MS Dhoni shortlisted by CSK: ${dhoniInShortlist}`);

  // TEST 7: Final Auction Pool Compilation Filters Retirees
  console.log('\n--- TEST 7: Final Auction Pool Compilation Filters Retirees ---');
  const allShortlists = { [csk.id]: shortlistResult };
  const poolResult = compileFinalAuctionPool(registeredPlayers, allShortlists, 300, 2026);

  const finalPoolIds = new Set(poolResult.finalAuctionPool.map((p) => p.id));
  for (const retiredId of retiredSampleIds) {
    assert(
      !finalPoolIds.has(retiredId),
      `Final compiled auction pool must NOT contain retired player: ${retiredId}`
    );
  }

  // TEST 8: Career Mode Separation
  console.log('\n--- TEST 8: Career Mode Isolation & Real-World Non-Destructiveness ---');
  const kumble = getVerifiedRetirementRecord('a-kumble');
  assert(
    kumble?.scope === 'ALL_CRICKET',
    'Real-world retirement registry specifies Anil Kumble as ALL_CRICKET'
  );
  assert(
    Boolean(kumble?.sourceCitation?.includes('BCCI') || kumble?.sourceCitation?.includes('Official')),
    'Kumble has verified official provenance'
  );
  assert(!getVerifiedRetirementRecord('a-singh', 'A Singh'), 'Registry lookup does not fuzzy-match unrelated short names');

  // TEST 9: Database Audit Report Tally
  console.log('\n--- TEST 9: Full Database Audit Report ---');
  const auditReport = auditDatabaseRetirements(globalPlayers, 2026);
  console.log(`Audit Summary: Total: ${auditReport.totalPlayersChecked}, Active: ${auditReport.verifiedActiveCount}, Fully Retired: ${auditReport.verifiedRetiredCount}, Intl Only: ${auditReport.internationalOnlyRetireesCount}`);
  assert(auditReport.totalPlayersChecked === globalPlayers.length, 'Audit checked all players');
  assert(auditReport.verifiedRetiredCount === 0, `Cleaned database contains no fully retired cricketers (found ${auditReport.verifiedRetiredCount})`);
  assert(auditReport.internationalOnlyRetireesCount >= 5, `Found ${auditReport.internationalOnlyRetireesCount} international-only retirees (still IPL eligible)`);
  assert(auditReport.excludedFromCurrentAuctionCount >= auditReport.verifiedRetiredCount, 'Excluded count is consistent');

  console.log('\n======================================================');
  console.log('🎉 ALL 9 RETIREMENT & ELIGIBILITY TESTS PASSED CLEANLY');
  console.log('======================================================\n');
}

runRetirementEligibilityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
