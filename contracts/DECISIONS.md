# Title Contract Design Decisions

## 1. Architectural Architecture

### 1.1 Item Identification by Hash
- Items are registered via `bytes32 itemHash`, computed as `keccak256(abi.encode(serial, salt))`.
- **Rationale:** Physical or digital serial numbers are never broadcast in plain text on-chain. Holders keep their serial and secret salt offline. Anyone inspecting the item can prove custody or ownership by providing the serial and salt to reproduce the hash, verifying against the title record.

### 1.2 Append-Only Chain of Custody
- The history mapping `_history[id][index]` records every custody event (`Hop`), starting from registration at index 0 (`from = address(0)`).
- Every ownership transfer appends a new `Hop(from, to, block.timestamp, FLAG_CLEAR)`.
- Flag updates (lost, stolen, clear) append a self-hop `Hop(owner, owner, block.timestamp, flag)`.
- **Rationale:** Custody history is immutable and append-only. No historical records can be overwritten or erased.

### 1.3 Flag Cleared on Transfer
- When a title is transferred to a new owner, any active flag (`FLAG_LOST` or `FLAG_STOLEN`) is automatically reset to `FLAG_CLEAR`.
- **Rationale:** A new owner starts with a clean slate. The transfer and prior flags remain recorded in the immutable history so prospective buyers can inspect the item's complete custody trail.

### 1.4 Strict Pagination & Storage Bounds
- Labels are limited to `MAX_LABEL = 48` bytes and cannot be empty.
- `historyOf` and `ownedBy` queries enforce a maximum page size of 50 items.
- Zero hash (`0x0`), duplicate registration, and invalid recipients (`address(0)`, self, and contract address) revert with descriptive custom errors.

---

## 2. Invariant Specifications

1. **Balance Invariant:** `address(title).balance == 0`. The contract holds no BOT and has no payable functions or `receive`/`fallback`.
2. **Immutable Hash Binding:** `idOfHash[itemHash]` is assigned once upon registration and can never be modified or overwritten.
3. **History Append-Only & Hop Accounting:** `record.transfers + flagChanges + 1 == historyLength(id)`. Every state transition appends exactly one hop.
4. **Current Ownership Consistency:** The current owner `recordOf(id).owner` always matches the recipient (`to`) of the most recent transfer hop.

---

## 3. Mutation Testing Analysis

Ran `scripts/mutation-check.py title --max 25` against `Title.sol`:
- **Mutants Tested:** 25
- **Mutants Killed:** 21
- **Surviving Mutants:** 4

All 4 surviving mutants are mathematically and semantically equivalent transformations:
1. `Title.sol:224` — `i < total && idx < matched` mutated to `||`:
   - `matched` is computed in the first pass as the exact number of matching items in `_owned`. When `i == total`, `idx` has already reached `matched`. Therefore, `idx < matched` is false, ensuring loop termination identically.
2. `Title.sol:163` — `offset >= total` mutated to `offset > total`:
   - When `offset == total`, `resultSize = end - offset = total - total = 0`, returning `new Hop[](0)`. The early return and normal execution produce identical empty arrays.
3. `Title.sol:224` — `idx < matched` mutated to `idx <= matched`:
   - The first pass bounded `matched` to the exact occurrence count. Once `idx` reaches `matched`, no further items match the predicate in the remaining elements.
4. `Title.sol:167` — `count_ > 50 ? 50 : count_` mutated to `>= 50`:
   - When `count_ == 50`, both branches yield 50.
