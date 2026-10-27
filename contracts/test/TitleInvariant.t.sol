// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Title} from "../src/Title.sol";

contract TitleHandler is Test {
  Title public immutable title;

  address[] public actors;
  bytes32[] public registeredHashes;
  uint256[] public registeredIds;

  mapping(bytes32 => uint256) public ghostIdOfHash;
  mapping(uint256 => uint32) public ghostFlagChanges;
  mapping(uint256 => uint32) public ghostHistoryLength;
  mapping(uint256 => address) public ghostCurrentOwner;

  constructor(Title _title) {
    title = _title;
    actors.push(address(0x1111));
    actors.push(address(0x2222));
    actors.push(address(0x3333));
    actors.push(address(0x4444));
  }

  function registeredHashesCount() external view returns (uint256) {
    return registeredHashes.length;
  }

  function registerItem(uint8 actorSeed, uint256 saltSeed) external {
    address actor = actors[actorSeed % actors.length];
    bytes32 itemHash = keccak256(abi.encode(saltSeed, registeredHashes.length));

    if (title.idOfHash(itemHash) != 0) return;

    string memory label = "Item";

    vm.prank(actor);
    uint256 id = title.register(itemHash, label);

    registeredHashes.push(itemHash);
    registeredIds.push(id);
    ghostIdOfHash[itemHash] = id;
    ghostHistoryLength[id] = 1;
    ghostCurrentOwner[id] = actor;
  }

  function transferItem(uint8 recipientOffset, uint256 idRaw) external {
    if (registeredIds.length == 0) return;
    uint256 id = registeredIds[idRaw % registeredIds.length];

    Title.Record memory rec = title.recordOf(id);
    address currentOwner = rec.owner;

    // Pick an actor different from current owner
    address recipient = actors[0];
    if (recipient == currentOwner) {
      recipient = actors[1];
    }
    if (recipientOffset % 2 == 1 && actors[2] != currentOwner) {
      recipient = actors[2];
    }

    uint32 priorLength = title.historyLength(id);

    vm.prank(currentOwner);
    title.transfer(id, recipient);

    ghostCurrentOwner[id] = recipient;
    ghostHistoryLength[id] = priorLength + 1;
  }

  function setItemFlag(uint256 idRaw, uint8 flagRaw) external {
    if (registeredIds.length == 0) return;
    uint256 id = registeredIds[idRaw % registeredIds.length];

    Title.Record memory rec = title.recordOf(id);
    address currentOwner = rec.owner;
    uint8 flag = uint8(flagRaw % 3);

    uint32 priorLength = title.historyLength(id);

    vm.prank(currentOwner);
    title.setFlag(id, flag);

    ghostFlagChanges[id]++;
    ghostHistoryLength[id] = priorLength + 1;
  }
}

contract TitleInvariantTest is Test {
  Title public title;
  TitleHandler public handler;

  function setUp() public {
    title = new Title();
    handler = new TitleHandler(title);

    targetContract(address(handler));
  }

  /// @notice Invariant 1: Title contract balance is always 0.
  function invariant_BalanceZero() public view {
    assertEq(address(title).balance, 0, "Balance must remain zero");
  }

  /// @notice Invariant 2, 3, 4: Custody, history append-only lengths, and owner match.
  function invariant_CustodyAndHistoryIntegrity() public view {
    uint256 total = title.count();
    if (total > 0) {
      // Check head and tail
      _checkTitle(1);
      _checkTitle(total);
    }

    uint256 count = handler.registeredHashesCount();
    if (count > 0) {
      bytes32 h = handler.registeredHashes(count - 1);
      assertEq(title.idOfHash(h), handler.ghostIdOfHash(h), "idOfHash mutated or corrupted");
    }
  }

  function _checkTitle(uint256 id) internal view {
    Title.Record memory rec = title.recordOf(id);
    uint32 flags = handler.ghostFlagChanges(id);
    uint32 hops = title.historyLength(id);
    assertEq(hops, handler.ghostHistoryLength(id), "History length mismatch");
    assertEq(uint32(rec.transfers + flags + 1), hops, "Hops count mismatch with transfers + flags + 1");
    assertEq(rec.owner, handler.ghostCurrentOwner(id), "Owner must match last transfer recipient");
  }
}
