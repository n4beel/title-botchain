/**
 * Title contract ABI.
 * Const assertion provides complete viem/wagmi types.
 */
export const titleAbi = [
  {
    type: "function",
    name: "count",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "idOfHash",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "idFor",
    inputs: [{ name: "itemHash", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hashFor",
    inputs: [
      { name: "serial", type: "string", internalType: "string" },
      { name: "salt", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "historyLength",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "historyOf",
    inputs: [
      { name: "id", type: "uint256", internalType: "uint256" },
      { name: "offset", type: "uint32", internalType: "uint32" },
      { name: "count_", type: "uint32", internalType: "uint32" },
    ],
    outputs: [
      {
        name: "hops",
        type: "tuple[]",
        internalType: "struct Title.Hop[]",
        components: [
          { name: "from", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "at", type: "uint64", internalType: "uint64" },
          { name: "flag", type: "uint8", internalType: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownedBy",
    inputs: [
      { name: "addr", type: "address", internalType: "address" },
      { name: "offset", type: "uint256", internalType: "uint256" },
      { name: "count_", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "ids", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "recordOf",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Title.Record",
        components: [
          { name: "itemHash", type: "bytes32", internalType: "bytes32" },
          { name: "owner", type: "address", internalType: "address" },
          { name: "registeredAt", type: "uint64", internalType: "uint64" },
          { name: "transfers", type: "uint32", internalType: "uint32" },
          { name: "flag", type: "uint8", internalType: "uint8" },
          { name: "label", type: "string", internalType: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "itemHash", type: "bytes32", internalType: "bytes32" },
      { name: "label", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "id", type: "uint256", internalType: "uint256" },
      { name: "to", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFlag",
    inputs: [
      { name: "id", type: "uint256", internalType: "uint256" },
      { name: "flag", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "itemHash", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "label", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transferred",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Flagged",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "flag", type: "uint8", indexed: false, internalType: "uint8" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ZeroHash",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyRegistered",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "LabelTooLong",
    inputs: [],
  },
  {
    type: "error",
    name: "EmptyLabel",
    inputs: [],
  },
  {
    type: "error",
    name: "NoSuchTitle",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOwner",
    inputs: [],
  },
  {
    type: "error",
    name: "BadRecipient",
    inputs: [],
  },
  {
    type: "error",
    name: "BadFlag",
    inputs: [],
  },
] as const;

export const contractAbi = titleAbi;
