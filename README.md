# Title

Who owned it, and when.

Title is a public chain-of-custody registry built on BOT Chain (Bohr testnet chain ID 968). Anyone can register a physical or digital item using a private serial number and a secret 256-bit salt (`keccak256(abi.encode(serial, salt))`). The serial number is never published on-chain, preserving owner privacy while enabling cryptographic proof of authenticity and provenance.

Holders can record chain-of-custody transfers and affix notarized status stamps (`CLEAR`, `LOST`, `STOLEN`). Transfers automatically clear active loss/theft flags so new holders start with a clean custody slate.

## What it does
- **Commitment-Based Registration:** Register items privately using `keccak256(abi.encode(serial, salt))`. The underlying serial number is never published to the public ledger.
- **Append-Only Chain of Custody:** Every registration, custody transfer, and status stamp appends an immutable hop recording `from`, `to`, timestamp `at`, and `flag`.
- **Loss and Theft Disclosures:** Current holders can stamp items as `LOST` (flag 1) or `STOLEN` (flag 2), or restore to `CLEAR` (flag 0).
- **Clean Slate on Transfer:** Transferring an item automatically clears loss/theft flags so the new holder begins clean.
- **Independent Offline/Online Verification:** Any buyer or counterparty can verify provenance by entering the serial number and salt at `/verify` without connecting a wallet or revealing the serial to third parties.
- **Docket Book Index:** Query any title ID or lookup by wallet address to inspect public custody histories.
- **Archetype AE · Deed:** Archival notarial register aesthetic featuring aged parchment (`#FBF7EC`), blackletter ink (`#26231B`), deep oxblood wax seals (`#8C2F39`), classical serif typography (`IM Fell English`), and clean monospaced notarial figures (`Cutive Mono`).

## What it cannot do
- **No Physical Real-World Verification:** First to register an item hash holds it. The blockchain cannot verify whether the physical object is real or counterfeit.
- **Self-Reported Status:** Flags represent the current recorded holder's declaration. A new holder starts clean upon custody transfer.
- **Not Legal Title:** Title is a public cryptographic record of custody and disclosures; it does not confer legal ownership or replace sovereign property deeds.

## Gas Profile
Measured with Solc 0.8.23 via Foundry:

| Operation | Gas Used | Cost (BOT at 20 gwei) |
|---|---|---|
| `register(itemHash, label)` | ~132,000 | ~0.0026 BOT |
| `transfer(id, to)` | ~87,000 | ~0.0017 BOT |
| `setFlag(id, flag)` | ~54,000 | ~0.0011 BOT |
| `recordOf(id)` | View call | Free |
| `historyOf(id, offset, count)` | View call | Free |
| `historyLength(id)` | View call | Free |
| `ownedBy(addr, offset, count)` | View call | Free |
| `idFor(itemHash)` / `idOfHash` | View call | Free |

## Development & Local Stack

Run the local stack with 5 seeded titles (chain ID 968 on port 8726):
```bash
node scripts/local-stack.mjs
npm run dev
```

Run tests:
```bash
# Contract unit, fuzz (256 runs), and invariant suites
cd contracts && forge test --gas-report

# Frontend unit tests and typecheck
npm test
npx tsc --noEmit

# Full integration test suite on live anvil node
npm run test:integration

# Headless Chrome automated walkthrough
node scripts/browser-walkthrough.mjs
```

## Contract Deployments
- **Bohr Testnet (Chain ID 968):** `0x5fbdb2315678afecb367f032d93f642f64180aa3` (local anvil seed)
- **Mainnet (Chain ID 677):** `TBD`
