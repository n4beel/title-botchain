// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Title
 * @notice Public chain-of-custody registry for physical or digital items.
 * @dev Spec: docs/specs/26-title.md
 */
contract Title {
  struct Record {
    bytes32 itemHash;
    address owner;
    uint64 registeredAt;
    uint32 transfers;
    uint8 flag; // 0 none, 1 lost, 2 stolen
    string label; // label <= 48 bytes
  }

  struct Hop {
    address from;
    address to;
    uint64 at;
    uint8 flag;
  }

  uint256 public constant MAX_LABEL = 48;
  uint8 public constant FLAG_CLEAR = 0;
  uint8 public constant FLAG_LOST = 1;
  uint8 public constant FLAG_STOLEN = 2;

  mapping(uint256 => Record) private _records;
  mapping(bytes32 => uint256) public idOfHash; // 0 = unregistered
  mapping(uint256 => mapping(uint32 => Hop)) private _history; // index 0 = registration
  mapping(uint256 => uint32) private _historyCount;
  mapping(address => uint256[]) private _owned; // ids currently or formerly owned
  uint256 public count; // ids start at 1

  event Registered(uint256 indexed id, bytes32 indexed itemHash, address indexed owner, string label);
  event Transferred(uint256 indexed id, address indexed from, address indexed to);
  event Flagged(uint256 indexed id, address indexed owner, uint8 flag);

  error ZeroHash();
  error AlreadyRegistered(uint256 id);
  error LabelTooLong();
  error EmptyLabel();
  error NoSuchTitle();
  error NotOwner();
  error BadRecipient();
  error BadFlag();

  /**
   * @notice Registers a new title for an item hash.
   * @param itemHash keccak256 hash of serial number + salt.
   * @param label Human-readable description (max 48 bytes).
   * @return id The assigned title number.
   */
  function register(bytes32 itemHash, string calldata label) external returns (uint256 id) {
    if (itemHash == bytes32(0)) revert ZeroHash();
    uint256 existingId = idOfHash[itemHash];
    if (existingId != 0) revert AlreadyRegistered(existingId);
    if (bytes(label).length > MAX_LABEL) revert LabelTooLong();
    if (bytes(label).length == 0) revert EmptyLabel();

    count++;
    id = count;
    idOfHash[itemHash] = id;

    _records[id] = Record({
      itemHash: itemHash,
      owner: msg.sender,
      registeredAt: uint64(block.timestamp),
      transfers: 0,
      flag: FLAG_CLEAR,
      label: label
    });

    _history[id][0] = Hop({
      from: address(0),
      to: msg.sender,
      at: uint64(block.timestamp),
      flag: FLAG_CLEAR
    });
    _historyCount[id] = 1;

    _owned[msg.sender].push(id);

    emit Registered(id, itemHash, msg.sender, label);
  }

  /**
   * @notice Transfers ownership of a title to another address.
   * @dev Clears any existing flags (a new owner starts clean).
   * @param id The title number.
   * @param to New owner address.
   */
  function transfer(uint256 id, address to) external {
    if (id == 0 || id > count) revert NoSuchTitle();
    Record storage rec = _records[id];
    if (msg.sender != rec.owner) revert NotOwner();
    if (to == address(0) || to == msg.sender || to == address(this)) revert BadRecipient();

    address from = rec.owner;
    rec.owner = to;
    rec.transfers++;
    rec.flag = FLAG_CLEAR;

    uint32 hIdx = _historyCount[id];
    _history[id][hIdx] = Hop({
      from: from,
      to: to,
      at: uint64(block.timestamp),
      flag: FLAG_CLEAR
    });
    _historyCount[id] = hIdx + 1;

    _owned[to].push(id);

    emit Transferred(id, from, to);
  }

  /**
   * @notice Flags a title as lost (1), stolen (2), or clears the flag (0).
   * @param id The title number.
   * @param flag New flag value (0 = none, 1 = lost, 2 = stolen).
   */
  function setFlag(uint256 id, uint8 flag) external {
    if (id == 0 || id > count) revert NoSuchTitle();
    Record storage rec = _records[id];
    if (msg.sender != rec.owner) revert NotOwner();
    if (flag > FLAG_STOLEN) revert BadFlag();

    rec.flag = flag;

    uint32 hIdx = _historyCount[id];
    _history[id][hIdx] = Hop({
      from: rec.owner,
      to: rec.owner,
      at: uint64(block.timestamp),
      flag: flag
    });
    _historyCount[id] = hIdx + 1;

    emit Flagged(id, rec.owner, flag);
  }

  /**
   * @notice Reads record metadata for a title.
   */
  function recordOf(uint256 id) external view returns (Record memory) {
    if (id == 0 || id > count) revert NoSuchTitle();
    return _records[id];
  }

  /**
   * @notice Reads chain-of-custody hops for a title.
   * @param id Title number.
   * @param offset Starting index.
   * @param count_ Maximum hops to return (capped at 50).
   */
  function historyOf(uint256 id, uint32 offset, uint32 count_) external view returns (Hop[] memory hops) {
    if (id == 0 || id > count) revert NoSuchTitle();
    uint32 total = _historyCount[id];
    if (offset >= total || count_ == 0) {
      return new Hop[](0);
    }

    uint32 maxCount = count_ > 50 ? 50 : count_;
    uint32 end = offset + maxCount;
    if (end > total) {
      end = total;
    }
    uint32 resultSize = end - offset;

    hops = new Hop[](resultSize);
    for (uint32 i = 0; i < resultSize; i++) {
      hops[i] = _history[id][offset + i];
    }
  }

  /**
   * @notice Returns total number of history hops for a title.
   */
  function historyLength(uint256 id) external view returns (uint32) {
    if (id == 0 || id > count) revert NoSuchTitle();
    return _historyCount[id];
  }

  /**
   * @notice Returns title id for a registered item hash (0 if unregistered).
   */
  function idFor(bytes32 itemHash) external view returns (uint256) {
    return idOfHash[itemHash];
  }

  /**
   * @notice Returns title IDs currently owned by addr.
   * @param addr Owner address.
   * @param offset Offset into active owned items.
   * @param count_ Max items to return (capped at 50).
   */
  function ownedBy(address addr, uint256 offset, uint256 count_) external view returns (uint256[] memory ids) {
    if (count_ == 0) return new uint256[](0);
    uint256 limit = count_ > 50 ? 50 : count_;

    uint256[] storage allOwned = _owned[addr];
    uint256 total = allOwned.length;

    uint256 skipped = 0;
    uint256 matched = 0;
    for (uint256 i = 0; i < total; i++) {
      uint256 tid = allOwned[i];
      if (_records[tid].owner == addr) {
        if (skipped < offset) {
          skipped++;
        } else if (matched < limit) {
          matched++;
        }
      }
    }

    ids = new uint256[](matched);
    skipped = 0;
    uint256 idx = 0;
    for (uint256 i = 0; i < total && idx < matched; i++) {
      uint256 tid = allOwned[i];
      if (_records[tid].owner == addr) {
        if (skipped < offset) {
          skipped++;
        } else {
          ids[idx] = tid;
          idx++;
        }
      }
    }
  }

  /**
   * @notice Calculates keccak256(abi.encode(serial, salt)).
   */
  function hashFor(string memory serial, bytes32 salt) public pure returns (bytes32) {
    return keccak256(abi.encode(serial, salt));
  }
}
