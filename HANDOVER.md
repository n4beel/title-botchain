# Title Handover Report

## 1. What Was Built
Title is a public chain-of-custody registry on BOT Chain (Bohr testnet chain ID 968). It enables privacy-preserving item registration, provenance tracking, custody transfers, and status flag declarations.

Key components:
- **Smart Contract (`contracts/src/Title.sol`)**:
  - Implements item registration (`register`), custody transfers (`transfer`), status flag stamping (`setFlag`), and public queries (`recordOf`, `historyOf`, `historyLength`, `idFor`, `ownedBy`, `hashFor`).
  - Strict input validations:
    - `ZeroHash` (rejects 0x0 hash).
    - `AlreadyRegistered(id)` (prevents duplicate registration of same hash).
    - `LabelTooLong` (enforces `<= 48` bytes).
    - `EmptyLabel` (rejects empty string).
    - `NoSuchTitle` (validates `id > 0 && id <= count`).
    - `NotOwner` (restricts transfers and flag updates to current recorded holder).
    - `BadRecipient` (rejects `to == address(0)` and self-transfers).
    - `BadFlag` (only permits `0 = CLEAR`, `1 = LOST`, `2 = STOLEN`).
  - Append-only chain of custody:
    - Hop 0 records initial registration (`from = address(0)`, `to = owner`, `flag = CLEAR`).
    - Custody transfers append hops with previous holder and new holder, clearing flags back to `CLEAR`.
    - Flag updates append hops recording status change with `from = to = owner`.
  - Storage bounds & gas limits:
    - `historyOf` capped at 50 hops per read.
    - `ownedBy` capped at 50 IDs per read.
    - No receive/fallback functions; rejects accidental BOT value transfers.
- **Design Decisions (`contracts/DECISIONS.md`)**:
  - Documents hashing algorithm (`keccak256(abi.encode(serial, salt))`), flag auto-clearing logic on custody transfers, invariant properties, and mutant kill analysis.
- **Frontend Architecture (Archetype AE · Deed)**:
  - Ground: Aged parchment (`--bg-base: #FBF7EC`), blackletter ink (`--text-primary: #26231B`), deep oxblood wax seals (`--accent: #8C2F39`).
  - Typography: IM Fell English for display titles, Public Sans for UI body, and Cutive Mono for notarial figures, dates, and cryptographic hashes.
  - Bespoke Components:
    - `DeedCard`: Archival parchment deed sheet with double notarial border, seal stamp, item metadata, and cryptographic hash verification chip.
    - `CustodyTimeline`: Vertical chain-of-custody timeline showing initial docketing, transfers, and status stamps.
    - `OwnerControls`: Holder action panel for custody transfers and wax status stamps.
  - Routes:
    - `/`: Custody Docket Book with direct title number lookup and connected holder's registered titles.
    - `/register`: New title registration form with secret salt generator, live hash preview, mandatory JSON backup receipt download, and on-chain docketing.
    - `/t/[id]`: Archival deed view with custody timeline, cryptographic proof chip, and holder authority controls.
    - `/verify`: Independent verification page matching serial number and salt against on-chain records.
    - `not-found.tsx`: Notarial 404 deed page.
  - Shared UI Contract:
    - 3 mandatory footer links on all pages (`Built on BOT Chain`, `botchain.ai`, `scan.botchain.ai`).
    - Verified AAA contrast tokens for wallet dropdown menu.
    - Notarial statutory disclaimers in footer: "A record, not a deed. First to register holds it. Flags are owner's word. Nothing here is legal title."

---

## 2. Verification Results

### Forge Tests
```bash
$ forge test --gas-report
Compiler run successful!

Ran 17 tests for test/Title.t.sol:TitleTest
[PASS] testFuzz_HistoryAppendOnly(uint8) (runs: 256, μ: 804123, ~: 601607)
[PASS] test_BadFlagReverts() (gas: 221498)
[PASS] test_BadRecipientReverts() (gas: 225767)
[PASS] test_DuplicateHashReverts_ArgsId() (gas: 224012)
[PASS] test_HashForMatchesOffChainVector() (gas: 7250)
[PASS] test_HistoryPagination() (gas: 505124)
[PASS] test_LabelLengthBounds() (gas: 274688)
[PASS] test_NoBalance_NoReceive() (gas: 12148)
[PASS] test_NoSuchTitleReverts() (gas: 39754)
[PASS] test_OnlyOwnerTransfers() (gas: 225603)
[PASS] test_OwnedByFiltersCurrentOwner() (gas: 674538)
[PASS] test_RegisterAndRead() (gas: 236847)
[PASS] test_SetFlagAppendsHop() (gas: 337387)
[PASS] test_SetFlagNonOwnerReverts() (gas: 223425)
[PASS] test_TransferClearsFlag() (gas: 379595)
[PASS] test_TransferMovesOwnerAndAppendsHop() (gas: 435798)
[PASS] test_ZeroHashReverts() (gas: 11226)
Suite result: ok. 17 passed; 0 failed; 0 skipped; finished in 210.71ms

Ran 2 tests for test/TitleInvariant.t.sol:TitleInvariantTest
[PASS] invariant_BalanceZero() (runs: 256, calls: 32768, reverts: 0)
[PASS] invariant_CustodyAndHistoryIntegrity() (runs: 256, calls: 32768, reverts: 0)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 8.35s
```

### Mutation Testing
- 21 of 25 mutants killed.
- 4 surviving mutants analyzed and documented in `contracts/DECISIONS.md`:
  1. `MAX_LABEL = 48` boundary mutant (`> 48` vs `>= 49`): identical condition on integer types.
  2. `FLAG_STOLEN = 2` boundary mutant (`flag > 2` vs `flag >= 3`): identical condition on uint8 types.
  3. `historyLength` vs `_historyCount`: accessor returns direct storage variable; boundary mutation equivalent.
  4. `idFor` vs `idOfHash`: public mapping accessor and helper function return identical values.

### Frontend Unit & Lint Tests
```bash
$ npm test && npx tsc --noEmit
✓ lib/botchain/__tests__/active-chain.test.ts (5 tests)
✓ lib/botchain/__tests__/deployment.test.ts (4 tests)
✓ lib/botchain/__tests__/wagmi-chains.test.ts (2 tests)
✓ lib/botchain/__tests__/chain.test.ts (10 tests)
✓ lib/__tests__/title.test.ts (17 tests)
✓ lib/botchain/__tests__/amount.test.ts (7 tests)
✓ lib/__tests__/wallet.test.ts (6 tests)
✓ lib/__tests__/contract-limits.test.ts (2 tests)
✓ test/lint/hook-deps.test.ts (4 tests)
Test Files  9 passed (9)
Tests       57 passed (57)
tsc --noEmit passed with 0 errors
```

### Integration Tests
```bash
$ npm run test:integration
✓ test/integration/abi-matches-contract.test.ts (4 tests)
✓ test/integration/title.test.ts (13 tests)
Test Files  2 passed (2)
Tests       17 passed (17)
```

### Production Build
```bash
$ npm run build
✓ Compiled successfully in 1550ms
✓ Finished TypeScript in 5.9s
✓ Generating static pages using 7 workers (6/6) in 257ms
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /icon.png
├ ○ /register
├ ƒ /t/[id]
└ ○ /verify
```

### Browser Walkthrough (Headless Chrome CDP)
```bash
$ node scripts/browser-walkthrough.mjs
1. Testing Desktop 1280px on /...
   Page title: "Title — Who owned it, and when."
   Footer links check: { total: 3, hasBotchain: true, hasScan: true, hasContract: true }
   Docket Book sections: register=true, lookup=true, yourTitles=true
2. Testing Mobile 360px Viewport...
   360px viewport: scrollWidth=360, clientWidth=360
3. Walking /register (registration form & hash computation)...
   /register inputs: label=true, serial=true, salt=true
4. Walking /verify (independent verification with known sample)...
   Known sample verified to Title #1: true
   Unregistered serial correctly reports No Registration Found: true
5. Walking seeded titles 1 through 5...
   Title 1: Fender Stratocaster Clear (3 hops)=true
   Title 2: Leica M6 Lost=true
   Title 3: Rolex Submariner Stolen=true
   Title 4: Colnago C64 Road Frame=true
   Title 5: Moog Minimoog Model D Lost=true
6. Testing on-chain registration & status stamp affixing...
   Clicked 'Register Title': true
   Successfully redirected to: /t/8
   Testing affixing status stamp on new title...
   Clicked 'Update Status Stamp': true
7. Checking console errors...
   Total console errors: 0
✓ ALL BROWSER WALKTHROUGH TESTS PASSED WITH 0 ERRORS!
```

### Automated Checkers
```bash
python3 scripts/check-honesty.py title      # 0 findings
python3 scripts/check-tokens.py title       # 0 undefined tokens
python3 scripts/check-ui-contract.py title  # title: ok
python3 scripts/check-distinct.py title     # 0 collisions across 35 projects
```

---

## 3. Handover Checklist
- [x] All 7 milestones executed in order without skips.
- [x] Contract unit, fuzz, and invariant tests passing (19 forge tests).
- [x] Mutation tests executed with surviving mutants documented (21/25 killed).
- [x] TypeScript unit tests and lint suite passing (57 tests).
- [x] Local stack seeded with 5 diverse real-world titles.
- [x] Full integration suite passing against live local Anvil (17 tests).
- [x] Archetype AE · Deed theme tokens and fonts strictly enforced.
- [x] Headless Chrome CDP walkthrough passed across 1280px & 360px viewports with zero console errors.
- [x] All 4 repository checkers pass with 0 warnings or errors.
- [x] No modifications outside `title-botchain/` and `docs/specs/PROGRESS-WAVE3.md`.
