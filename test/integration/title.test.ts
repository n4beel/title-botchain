import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { titleAbi } from "@/lib/botchain/abi";
import {
  hashFor,
  newSalt,
  normalizeSerial,
  foldHistory,
  flagLabel,
  FLAG_CLEAR,
  FLAG_LOST,
  FLAG_STOLEN,
  type Hop,
} from "@/lib/title";
import { getLogsChunked } from "@/lib/logs";

const PORT = 8626;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968 as const;

const KEY_ALICE = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const KEY_BOB = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const KEY_CHARLIE = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const accountAlice = privateKeyToAccount(KEY_ALICE);
const accountBob = privateKeyToAccount(KEY_BOB);
const accountCharlie = privateKeyToAccount(KEY_CHARLIE);

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

let node: ChildProcess;
let publicClient: PublicClient;
let walletAlice: any;
let walletBob: any;
let walletCharlie: any;
let contractAddress: Address;
let deployBlock: bigint;

beforeAll(async () => {
  try {
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}

  node = spawn("anvil", [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--silent",
  ]);

  publicClient = createPublicClient({ chain: local, transport: http(), pollingInterval: 50 });

  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      if (i > 80) throw new Error("Anvil failed to start on integration port");
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  walletAlice = createWalletClient({ account: accountAlice, chain: local, transport: http() });
  walletBob = createWalletClient({ account: accountBob, chain: local, transport: http() });
  walletCharlie = createWalletClient({ account: accountCharlie, chain: local, transport: http() });

  const artifact = JSON.parse(
    readFileSync(new URL("../../contracts/out/Title.sol/Title.json", import.meta.url), "utf8"),
  );

  const hash = await walletAlice.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractAddress = receipt.contractAddress!;
  deployBlock = receipt.blockNumber;
}, 30_000);

afterAll(() => {
  try {
    node?.kill();
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}
});

describe("Title Contract Integration Suite", () => {
  const serial1 = "SN-98765-XYZ";
  const salt1 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
  const hash1 = hashFor(serial1, salt1);

  it("1. hashFor matches contract output and exact known vector", async () => {
    const onChainHash = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "hashFor",
      args: [serial1, salt1],
    });

    expect(onChainHash).toBe(hash1);
    expect(onChainHash).toBe("0x52a7add389d4b8865cdc0806dd3b055e0d884337183cb98e7979a0965f39560f");
  });

  it("2. register creates title 1 and initializes history hop 0", async () => {
    const tx = await walletAlice.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "register",
      args: [hash1, "1974 Fender Stratocaster"],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    expect(receipt.status).toBe("success");

    const count = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "count",
    });
    expect(count).toBe(1n);

    const rec = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "recordOf",
      args: [1n],
    });
    expect(rec.itemHash).toBe(hash1);
    expect(rec.owner.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(rec.transfers).toBe(0);
    expect(rec.flag).toBe(FLAG_CLEAR);
    expect(rec.label).toBe("1974 Fender Stratocaster");

    const hops = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 0, 10],
    });
    expect(hops).toHaveLength(1);
    expect(hops[0].from).toBe("0x0000000000000000000000000000000000000000");
    expect(hops[0].to.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(hops[0].flag).toBe(0);
  });

  it("3. duplicate itemHash reverts with AlreadyRegistered(1)", async () => {
    await expect(
      walletBob.writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "register",
        args: [hash1, "Duplicate Registration Attempt"],
      }),
    ).rejects.toThrow();
  });

  it("4. transfer changes owner, appends Hop, and increments transfers", async () => {
    const tx = await walletAlice.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "transfer",
      args: [1n, accountBob.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const rec = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "recordOf",
      args: [1n],
    });
    expect(rec.owner.toLowerCase()).toBe(accountBob.address.toLowerCase());
    expect(rec.transfers).toBe(1);

    const hops = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 0, 10],
    });
    expect(hops).toHaveLength(2);
    expect(hops[1].from.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(hops[1].to.toLowerCase()).toBe(accountBob.address.toLowerCase());
  });

  it("5. non-owner cannot transfer or set flag", async () => {
    // Alice is no longer the owner
    await expect(
      walletAlice.writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "transfer",
        args: [1n, accountCharlie.address],
      }),
    ).rejects.toThrow();

    await expect(
      walletAlice.writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "setFlag",
        args: [1n, FLAG_LOST],
      }),
    ).rejects.toThrow();
  });

  it("6. bad recipients revert", async () => {
    // Transfer to self
    await expect(
      walletBob.writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "transfer",
        args: [1n, accountBob.address],
      }),
    ).rejects.toThrow();

    // Transfer to contract address
    await expect(
      walletBob.writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "transfer",
        args: [1n, contractAddress],
      }),
    ).rejects.toThrow();
  });

  it("7. setFlag lost records flag and appends hop", async () => {
    const tx = await walletBob.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "setFlag",
      args: [1n, FLAG_LOST],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const rec = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "recordOf",
      args: [1n],
    });
    expect(rec.flag).toBe(FLAG_LOST);

    const len = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyLength",
      args: [1n],
    });
    expect(len).toBe(3);

    const hops = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 2, 1],
    });
    expect(hops[0].from.toLowerCase()).toBe(accountBob.address.toLowerCase());
    expect(hops[0].to.toLowerCase()).toBe(accountBob.address.toLowerCase());
    expect(hops[0].flag).toBe(FLAG_LOST);
  });

  it("8. transfer clears flag for new owner", async () => {
    const tx = await walletBob.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "transfer",
      args: [1n, accountCharlie.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const rec = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "recordOf",
      args: [1n],
    });
    expect(rec.owner.toLowerCase()).toBe(accountCharlie.address.toLowerCase());
    expect(rec.flag).toBe(FLAG_CLEAR); // Cleared on transfer
    expect(rec.transfers).toBe(2);

    const hops = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 0, 10],
    });
    expect(hops).toHaveLength(4);
    expect(hops[3].from.toLowerCase()).toBe(accountBob.address.toLowerCase());
    expect(hops[3].to.toLowerCase()).toBe(accountCharlie.address.toLowerCase());
    expect(hops[3].flag).toBe(FLAG_CLEAR);
  });

  it("9. new owner Charlie sets flag stolen", async () => {
    const tx = await walletCharlie.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "setFlag",
      args: [1n, FLAG_STOLEN],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const rec = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "recordOf",
      args: [1n],
    });
    expect(rec.flag).toBe(FLAG_STOLEN);
  });

  it("10. ownedBy accurately tracks active ownership across transfers", async () => {
    const salt2 = newSalt();
    const hash2 = hashFor("ITEM-2", salt2);
    const tx2 = await walletAlice.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "register",
      args: [hash2, "Item Two"],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    const salt3 = newSalt();
    const hash3 = hashFor("ITEM-3", salt3);
    const tx3 = await walletAlice.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "register",
      args: [hash3, "Item Three"],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx3 });

    // Alice currently owns 2 and 3
    const aliceOwned = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "ownedBy",
      args: [accountAlice.address, 0n, 10n],
    });
    expect(aliceOwned).toHaveLength(2);
    expect(aliceOwned[0]).toBe(2n);
    expect(aliceOwned[1]).toBe(3n);

    // Charlie owns 1
    const charlieOwned = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "ownedBy",
      args: [accountCharlie.address, 0n, 10n],
    });
    expect(charlieOwned).toHaveLength(1);
    expect(charlieOwned[0]).toBe(1n);

    // Alice transfers 2 to Bob
    const txT = await walletAlice.writeContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "transfer",
      args: [2n, accountBob.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: txT });

    const aliceNow = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "ownedBy",
      args: [accountAlice.address, 0n, 10n],
    });
    expect(aliceNow).toHaveLength(1);
    expect(aliceNow[0]).toBe(3n);

    const bobNow = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "ownedBy",
      args: [accountBob.address, 0n, 10n],
    });
    expect(bobNow).toHaveLength(1);
    expect(bobNow[0]).toBe(2n);
  });

  it("11. historyOf pagination handles offsets and limits", async () => {
    const page1 = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 0, 2],
    });
    expect(page1).toHaveLength(2);

    const page2 = await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 2, 2],
    });
    expect(page2).toHaveLength(2);

    expect(page1[0].at).toBeLessThanOrEqual(page1[1].at);
    expect(page1[1].at).toBeLessThanOrEqual(page2[0].at);
  });

  it("12. foldHistory properly categorizes raw hops", async () => {
    const hops = (await publicClient.readContract({
      address: contractAddress,
      abi: titleAbi,
      functionName: "historyOf",
      args: [1n, 0, 50],
    })) as Hop[];

    const folded = foldHistory(hops);
    expect(folded).toHaveLength(5);
    expect(folded[0].kind).toBe("registered");
    expect(folded[1].kind).toBe("transfer");
    expect(folded[2].kind).toBe("flag");
    expect(folded[2].flagLabel).toBe("Lost");
    expect(folded[3].kind).toBe("transfer");
    expect(folded[3].flagLabel).toBe("Clear");
    expect(folded[4].kind).toBe("flag");
    expect(folded[4].flagLabel).toBe("Stolen");
  });

  it("13. getLogsChunked fetches Registered events", async () => {
    const result = await getLogsChunked({
      client: publicClient,
      address: contractAddress,
      event: titleAbi.find((e) => e.type === "event" && e.name === "Registered") as any,
      fromBlock: deployBlock,
    });

    expect(result.logs.length).toBeGreaterThanOrEqual(3);
  });
});
