/**
 * Local stack runner and seeder for Title.
 *
 * Spawns anvil on port 8726 with chain id 968, deploys Title, and seeds:
 * - Title 1: Clear with 3 hops (Alice -> Bob -> Charlie)
 * - Title 2: Lost (Bob)
 * - Title 3: Stolen (Alice)
 * - Title 4: Newly registered (Dave)
 * - Title 5: Transferred and flagged by new owner (Alice -> Dave, flagged Lost)
 * Plus known serial + salt in the log and README for /verify testing.
 *
 * Usage:
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8726;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: Owner A (Alice)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: Owner B (Bob)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: Owner C (Charlie)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: Buyer (Dave)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4: Outsider (Eve)
];

const accounts = KEYS.map((k) => privateKeyToAccount(k));

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

function hashFor(serial, salt) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "bytes32" }],
      [serial, salt],
    ),
  );
}

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

console.log(`Starting anvil on port ${PORT}...`);
spawn(
  "anvil",
  [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--block-time",
    "1",
    "--silent",
  ],
  {
    detached: true,
    stdio: "ignore",
  },
).unref();

const pub = createPublicClient({ chain: local, transport: http(), pollingInterval: 50 });

// Wait for anvil to answer
for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Title.sol/Title.json", import.meta.url), "utf8"),
);

const wallets = accounts.map((account) =>
  createWalletClient({ account, chain: local, transport: http() }),
);

const deployHash = await wallets[0].deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});

const receipt = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = receipt.contractAddress;
const startBlock = receipt.blockNumber;

console.log(`Title deployed at ${contractAddress} (start block ${startBlock})`);

// 1. Title 1: Clear with 3 hops (Alice registers -> transfers to Bob -> transfers to Charlie)
const serial1 = "FNDR-1974-STRAT";
const salt1 = "0x1111111111111111111111111111111111111111111111111111111111111111";
const hash1 = hashFor(serial1, salt1);

console.log("Seeding Title 1 (Clear, 3 hops)...");
const t1Reg = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "register",
  args: [hash1, "1974 Fender Stratocaster"],
});
await pub.waitForTransactionReceipt({ hash: t1Reg });

const t1Tr1 = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "transfer",
  args: [1n, accounts[1].address],
});
await pub.waitForTransactionReceipt({ hash: t1Tr1 });

const t1Tr2 = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "transfer",
  args: [1n, accounts[2].address],
});
await pub.waitForTransactionReceipt({ hash: t1Tr2 });

// 2. Title 2: Lost (Bob registers -> sets flag Lost)
const serial2 = "LEICA-M6-44829";
const salt2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
const hash2 = hashFor(serial2, salt2);

console.log("Seeding Title 2 (Lost)...");
const t2Reg = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "register",
  args: [hash2, "Leica M6 Rangefinder #44829"],
});
await pub.waitForTransactionReceipt({ hash: t2Reg });

const t2Flag = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "setFlag",
  args: [2n, 1], // 1 = Lost
});
await pub.waitForTransactionReceipt({ hash: t2Flag });

// 3. Title 3: Stolen (Alice registers -> sets flag Stolen)
const serial3 = "ROLEX-SUB-99214";
const salt3 = "0x3333333333333333333333333333333333333333333333333333333333333333";
const hash3 = hashFor(serial3, salt3);

console.log("Seeding Title 3 (Stolen)...");
const t3Reg = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "register",
  args: [hash3, "Rolex Submariner 16610"],
});
await pub.waitForTransactionReceipt({ hash: t3Reg });

const t3Flag = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "setFlag",
  args: [3n, 2], // 2 = Stolen
});
await pub.waitForTransactionReceipt({ hash: t3Flag });

// 4. Title 4: Newly registered (Dave registers)
const serial4 = "COLNAGO-C64-001";
const salt4 = "0x4444444444444444444444444444444444444444444444444444444444444444";
const hash4 = hashFor(serial4, salt4);

console.log("Seeding Title 4 (Newly registered)...");
const t4Reg = await wallets[3].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "register",
  args: [hash4, "Colnago C64 Road Frame"],
});
await pub.waitForTransactionReceipt({ hash: t4Reg });

// 5. Title 5: Transferred and flagged by new owner (Alice registers -> transfers to Dave -> Dave flags Lost)
const serial5 = "MOOG-MINI-0812";
const salt5 = "0x5555555555555555555555555555555555555555555555555555555555555555";
const hash5 = hashFor(serial5, salt5);

console.log("Seeding Title 5 (Transferred and flagged by new owner)...");
const t5Reg = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "register",
  args: [hash5, "Moog Minimoog Model D"],
});
await pub.waitForTransactionReceipt({ hash: t5Reg });

const t5Tr = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "transfer",
  args: [5n, accounts[3].address],
});
await pub.waitForTransactionReceipt({ hash: t5Tr });

const t5Flag = await wallets[3].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "setFlag",
  args: [5n, 1], // 1 = Lost
});
await pub.waitForTransactionReceipt({ hash: t5Flag });

console.log("\nRoles Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| Role             | Index | Address                                    | Private Key (first 10) |");
console.log("----------------------------------------------------------------------------------------");
console.log(`| Owner A (Alice)  | 0     | ${accounts[0].address} | ${KEYS[0].slice(0, 10)}... |`);
console.log(`| Owner B (Bob)    | 1     | ${accounts[1].address} | ${KEYS[1].slice(0, 10)}... |`);
console.log(`| Owner C (Charlie)| 2     | ${accounts[2].address} | ${KEYS[2].slice(0, 10)}... |`);
console.log(`| Buyer (Dave)     | 3     | ${accounts[3].address} | ${KEYS[3].slice(0, 10)}... |`);
console.log(`| Outsider (Eve)   | 4     | ${accounts[4].address} | ${KEYS[4].slice(0, 10)}... |`);
console.log("----------------------------------------------------------------------------------------\n");

console.log("Seeded Titles Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| ID | Label                       | Current Owner | Status | Hops | Known Serial     |");
console.log("----------------------------------------------------------------------------------------");
console.log(`| 1  | 1974 Fender Stratocaster    | Charlie       | Clear  | 3    | ${serial1}  |`);
console.log(`| 2  | Leica M6 Rangefinder #44829 | Bob           | Lost   | 2    | ${serial2}   |`);
console.log(`| 3  | Rolex Submariner 16610      | Alice         | Stolen | 2    | ${serial3}  |`);
console.log(`| 4  | Colnago C64 Road Frame      | Dave          | Clear  | 1    | ${serial4}  |`);
console.log(`| 5  | Moog Minimoog Model D       | Dave          | Lost   | 3    | ${serial5}   |`);
console.log("----------------------------------------------------------------------------------------\n");

console.log("Known Serial & Salt for /verify verification:");
console.log(`Serial: ${serial1}`);
console.log(`Salt:   ${salt1}`);
console.log(`Hash:   ${hash1}`);
console.log(`Resolves to Title #1\n`);

// Write .env.local
const envContent = [
  `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet`,
  `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
  `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK_968=${startBlock}`,
  "",
].join("\n");

writeFileSync(".env.local", envContent);
console.log("Wrote .env.local");
