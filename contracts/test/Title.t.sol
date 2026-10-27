// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Title} from "../src/Title.sol";

contract TitleTest is Test {
  Title public title;

  address public alice = makeAddr("alice");
  address public bob = makeAddr("bob");
  address public charlie = makeAddr("charlie");

  bytes32 public constant HASH1 = keccak256("item-1");
  bytes32 public constant HASH2 = keccak256("item-2");
  bytes32 public constant HASH3 = keccak256("item-3");

  event Registered(uint256 indexed id, bytes32 indexed itemHash, address indexed owner, string label);
  event Transferred(uint256 indexed id, address indexed from, address indexed to);
  event Flagged(uint256 indexed id, address indexed owner, uint8 flag);

  function setUp() public {
    title = new Title();
  }

  function test_RegisterAndRead() public {
    vm.prank(alice);
    vm.expectEmit(true, true, true, true);
    emit Registered(1, HASH1, alice, "1974 Fender Stratocaster");
    uint256 id = title.register(HASH1, "1974 Fender Stratocaster");

    assertEq(id, 1);
    assertEq(title.count(), 1);
    assertEq(title.idOfHash(HASH1), 1);

    Title.Record memory rec = title.recordOf(1);
    assertEq(rec.itemHash, HASH1);
    assertEq(rec.owner, alice);
    assertEq(rec.registeredAt, uint64(block.timestamp));
    assertEq(rec.transfers, 0);
    assertEq(rec.flag, 0);
    assertEq(rec.label, "1974 Fender Stratocaster");

    assertEq(title.historyLength(1), 1);
    Title.Hop[] memory hops = title.historyOf(1, 0, 10);
    assertEq(hops.length, 1);
    assertEq(hops[0].from, address(0));
    assertEq(hops[0].to, alice);
    assertEq(hops[0].at, uint64(block.timestamp));
    assertEq(hops[0].flag, 0);
  }

  function test_DuplicateHashReverts_ArgsId() public {
    vm.prank(alice);
    uint256 id = title.register(HASH1, "Item One");
    assertEq(id, 1);

    vm.prank(bob);
    vm.expectRevert(abi.encodeWithSelector(Title.AlreadyRegistered.selector, 1));
    title.register(HASH1, "Item Duplicate");
  }

  function test_ZeroHashReverts() public {
    vm.prank(alice);
    vm.expectRevert(Title.ZeroHash.selector);
    title.register(bytes32(0), "Label");
  }

  function test_LabelLengthBounds() public {
    vm.startPrank(alice);
    // 0 bytes reverts EmptyLabel
    vm.expectRevert(Title.EmptyLabel.selector);
    title.register(HASH1, "");

    // 49 bytes reverts LabelTooLong
    string memory longLabel = "1234567890123456789012345678901234567890123456789"; // 49 chars
    vm.expectRevert(Title.LabelTooLong.selector);
    title.register(HASH1, longLabel);

    // Exact 48 bytes succeeds
    string memory exact48 = "123456789012345678901234567890123456789012345678"; // 48 chars
    uint256 id = title.register(HASH1, exact48);
    assertEq(id, 1);
    vm.stopPrank();
  }

  function test_TransferMovesOwnerAndAppendsHop() public {
    vm.prank(alice);
    title.register(HASH1, "Road Bike");

    vm.warp(1000);
    vm.prank(alice);
    vm.expectEmit(true, true, true, false);
    emit Transferred(1, alice, bob);
    title.transfer(1, bob);

    Title.Record memory rec = title.recordOf(1);
    assertEq(rec.owner, bob);
    assertEq(rec.transfers, 1);
    assertEq(rec.flag, 0);

    assertEq(title.historyLength(1), 2);
    Title.Hop[] memory hops = title.historyOf(1, 0, 10);
    assertEq(hops.length, 2);
    assertEq(hops[1].from, alice);
    assertEq(hops[1].to, bob);
    assertEq(hops[1].at, 1000);
    assertEq(hops[1].flag, 0);

    // Now bob transfers to charlie
    vm.warp(2000);
    vm.prank(bob);
    title.transfer(1, charlie);

    rec = title.recordOf(1);
    assertEq(rec.owner, charlie);
    assertEq(rec.transfers, 2);
    assertEq(title.historyLength(1), 3);
  }

  function test_OnlyOwnerTransfers() public {
    vm.prank(alice);
    title.register(HASH1, "Lens");

    vm.prank(bob);
    vm.expectRevert(Title.NotOwner.selector);
    title.transfer(1, charlie);
  }

  function test_BadRecipientReverts() public {
    vm.prank(alice);
    title.register(HASH1, "Lens");

    vm.startPrank(alice);
    // Address zero
    vm.expectRevert(Title.BadRecipient.selector);
    title.transfer(1, address(0));

    // Self
    vm.expectRevert(Title.BadRecipient.selector);
    title.transfer(1, alice);

    // Contract itself
    vm.expectRevert(Title.BadRecipient.selector);
    title.transfer(1, address(title));
    vm.stopPrank();
  }

  function test_TransferClearsFlag() public {
    vm.prank(alice);
    title.register(HASH1, "Stolen Watch");

    // Alice flags it as stolen (2)
    vm.prank(alice);
    title.setFlag(1, 2);
    assertEq(title.recordOf(1).flag, 2);

    // Alice recovers and transfers to Bob -> flag resets to 0
    vm.prank(alice);
    title.transfer(1, bob);

    Title.Record memory rec = title.recordOf(1);
    assertEq(rec.flag, 0);
    assertEq(rec.owner, bob);

    // Check last hop is clear flag
    Title.Hop[] memory hops = title.historyOf(1, 2, 1);
    assertEq(hops[0].from, alice);
    assertEq(hops[0].to, bob);
    assertEq(hops[0].flag, 0);
  }

  function test_SetFlagAppendsHop() public {
    vm.prank(alice);
    title.register(HASH1, "Trombone");

    // Flag lost (1)
    vm.warp(500);
    vm.prank(alice);
    vm.expectEmit(true, true, false, true);
    emit Flagged(1, alice, 1);
    title.setFlag(1, 1);

    assertEq(title.recordOf(1).flag, 1);
    assertEq(title.historyLength(1), 2);

    Title.Hop[] memory hops = title.historyOf(1, 1, 1);
    assertEq(hops[0].from, alice);
    assertEq(hops[0].to, alice);
    assertEq(hops[0].at, 500);
    assertEq(hops[0].flag, 1);

    // Clear flag (0)
    vm.warp(800);
    vm.prank(alice);
    title.setFlag(1, 0);
    assertEq(title.recordOf(1).flag, 0);
    assertEq(title.historyLength(1), 3);
  }

  function test_SetFlagNonOwnerReverts() public {
    vm.prank(alice);
    title.register(HASH1, "Trombone");

    vm.prank(bob);
    vm.expectRevert(Title.NotOwner.selector);
    title.setFlag(1, 1);
  }

  function test_BadFlagReverts() public {
    vm.prank(alice);
    title.register(HASH1, "Trombone");

    vm.prank(alice);
    vm.expectRevert(Title.BadFlag.selector);
    title.setFlag(1, 3);
  }

  function test_NoSuchTitleReverts() public {
    vm.expectRevert(Title.NoSuchTitle.selector);
    title.recordOf(99);

    vm.expectRevert(Title.NoSuchTitle.selector);
    title.recordOf(0);

    vm.prank(alice);
    vm.expectRevert(Title.NoSuchTitle.selector);
    title.transfer(99, bob);

    vm.prank(alice);
    vm.expectRevert(Title.NoSuchTitle.selector);
    title.setFlag(99, 1);

    vm.expectRevert(Title.NoSuchTitle.selector);
    title.historyOf(99, 0, 10);

    vm.expectRevert(Title.NoSuchTitle.selector);
    title.historyLength(99);
  }

  function test_HistoryPagination() public {
    vm.prank(alice);
    title.register(HASH1, "Item");

    // Add 5 history entries (total 6)
    for (uint256 i = 0; i < 5; i++) {
      vm.prank(alice);
      title.setFlag(1, uint8((i % 2) + 1));
    }
    assertEq(title.historyLength(1), 6);

    // Page 1: 0 to 2
    Title.Hop[] memory page1 = title.historyOf(1, 0, 2);
    assertEq(page1.length, 2);
    assertEq(page1[0].from, address(0));

    // Page 2: 2 to 4
    Title.Hop[] memory page2 = title.historyOf(1, 2, 2);
    assertEq(page2.length, 2);

    // Out of bounds offset returns empty
    Title.Hop[] memory empty = title.historyOf(1, 6, 2);
    assertEq(empty.length, 0);

    // Zero count returns empty
    Title.Hop[] memory zeroCount = title.historyOf(1, 0, 0);
    assertEq(zeroCount.length, 0);
  }

  function test_OwnedByFiltersCurrentOwner() public {
    vm.startPrank(alice);
    uint256 id1 = title.register(HASH1, "One");
    uint256 id2 = title.register(HASH2, "Two");
    uint256 id3 = title.register(HASH3, "Three");
    vm.stopPrank();

    // Alice currently owns 1, 2, 3
    uint256[] memory aliceOwned = title.ownedBy(alice, 0, 10);
    assertEq(aliceOwned.length, 3);
    assertEq(aliceOwned[0], id1);
    assertEq(aliceOwned[1], id2);
    assertEq(aliceOwned[2], id3);

    // Alice transfers id2 to Bob
    vm.prank(alice);
    title.transfer(id2, bob);

    // Alice now only owns 1 and 3
    aliceOwned = title.ownedBy(alice, 0, 10);
    assertEq(aliceOwned.length, 2);
    assertEq(aliceOwned[0], id1);
    assertEq(aliceOwned[1], id3);

    // Bob owns id2
    uint256[] memory bobOwned = title.ownedBy(bob, 0, 10);
    assertEq(bobOwned.length, 1);
    assertEq(bobOwned[0], id2);

    // Test offset pagination on ownedBy
    uint256[] memory paged = title.ownedBy(alice, 1, 10);
    assertEq(paged.length, 1);
    assertEq(paged[0], id3);
  }

  function test_HashForMatchesOffChainVector() public view {
    string memory serial = "SN-98765-XYZ";
    bytes32 salt = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;

    bytes32 expected = keccak256(abi.encode(serial, salt));
    bytes32 calculated = title.hashFor(serial, salt);

    assertEq(calculated, expected);
  }

  function test_NoBalance_NoReceive() public {
    assertEq(address(title).balance, 0);

    (bool ok,) = address(title).call{value: 1 ether}("");
    assertFalse(ok);
  }

  function testFuzz_HistoryAppendOnly(uint8 opCount) public {
    vm.prank(alice);
    title.register(HASH1, "Fuzz Item");

    address currentOwner = alice;
    uint32 expectedHops = 1;
    uint32 flagChanges = 0;
    uint32 transfers = 0;

    uint256 bound = (uint256(opCount) % 20) + 1;
    for (uint256 i = 0; i < bound; i++) {
      if (i % 2 == 0) {
        // Transfer
        address nextOwner = makeAddr(string(abi.encodePacked("owner-", vm.toString(i))));
        vm.prank(currentOwner);
        title.transfer(1, nextOwner);
        currentOwner = nextOwner;
        transfers++;
      } else {
        // Set flag
        uint8 f = uint8((i % 2) + 1);
        vm.prank(currentOwner);
        title.setFlag(1, f);
        flagChanges++;
      }
      expectedHops++;

      assertEq(title.historyLength(1), expectedHops);
      Title.Record memory rec = title.recordOf(1);
      assertEq(rec.transfers, transfers);
      // Invariant: record.transfers + flagChanges + 1 == number of history entries
      assertEq(rec.transfers + flagChanges + 1, expectedHops);
      assertEq(rec.owner, currentOwner);
    }
  }
}
