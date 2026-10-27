"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAddress, type Address, type Hex } from "viem";
import { useAccount, useReadContract, useChainId } from "wagmi";
import Button from "@/components/ui/Button";
import { titleAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { hashFor, normalizeSerial, flagLabel } from "@/lib/title";

export default function DocketPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  // Quick lookup state
  const [jumpId, setJumpId] = useState("");
  const [serial, setSerial] = useState("");
  const [salt, setSalt] = useState("");
  const [lookupError, setLookupError] = useState("");

  // Total count in docket
  const { data: totalCountRaw } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "count",
    query: { enabled: deployed },
  });
  const totalCount = totalCountRaw !== undefined ? Number(totalCountRaw) : undefined;

  // Read owned titles for connected user
  const { data: ownedIdsRaw, isLoading: isLoadingOwned } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "ownedBy",
    args: address ? [address as Address, 0n, 50n] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const ownedIds = (ownedIdsRaw as readonly bigint[] | undefined) ?? [];

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = parseInt(jumpId, 10);
    if (!idNum || idNum < 1) {
      setLookupError("Please enter a valid title number.");
      return;
    }
    router.push(`/t/${idNum}`);
  };

  const handleVerifyLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim() || !salt.trim()) {
      setLookupError("Please enter both a serial number and a salt.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(salt.trim())) {
      setLookupError("Salt must be 32 bytes (66 hex characters with 0x prefix).");
      return;
    }
    router.push(`/verify?serial=${encodeURIComponent(serial.trim())}&salt=${encodeURIComponent(salt.trim())}`);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Top Banner / Description */}
      <div className="border-b pb-6" style={{ borderColor: "var(--border-default)" }}>
        <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Official Docket Book
        </span>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mt-1" style={{ color: "var(--text-primary)" }}>
          The Custody Register
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed max-w-[680px]" style={{ color: "var(--text-secondary)" }}>
          A public, immutable custody docket for unique possessions. Records are anchored by secret hash
          proofs and transferable from holder to holder without central authority.
        </p>

        {!deployed && (
          <div className="mt-4 p-3 bg-[#FFF3CD] border border-[#FFEEBA] text-[#856404] text-[13px] rounded-[2px] font-mono">
            Contract is not deployed on this network ({currentChainId}). Start local stack or switch to Bohr testnet.
          </div>
        )}
      </div>

      {/* Two-Column Docket Book Spread */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Look up a title */}
        <div className="bg-[#FBF7EC] border border-[#CFC6AC] p-6 rounded-[2px] shadow-xs flex flex-col gap-6">
          <div className="border-b border-[#CFC6AC] pb-3">
            <h2 className="font-serif text-xl font-bold text-[#26231B]">
              Look Up a Title
            </h2>
            <p className="text-[12px] text-[#5D574A] mt-1">
              Verify provenance by secret serial + salt or directly inspect a docket number.
            </p>
          </div>

          {lookupError && (
            <div className="p-2.5 bg-[#F8D7DA] text-[#721C24] border border-[#F5C6CB] text-[12px] rounded-[2px] font-mono">
              {lookupError}
            </div>
          )}

          {/* Jump to Title # */}
          <form onSubmit={handleJump} className="flex flex-col gap-2">
            <label htmlFor="jump-title-id" className="font-serif font-bold text-[13px] text-[#26231B]">
              Direct Title Lookup
            </label>
            <div className="flex gap-2">
              <input
                id="jump-title-id"
                type="number"
                min="1"
                placeholder="Title Number (e.g. 1)"
                value={jumpId}
                onChange={(e) => {
                  setJumpId(e.target.value);
                  setLookupError("");
                }}
                className="flex-1 font-mono text-[13px] p-2 bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
              />
              <Button type="submit" variant="secondary" size="md" disabled={!jumpId}>
                Open Deed
              </Button>
            </div>
          </form>

          <hr className="border-t border-[#E0D8C0]" />

          {/* Serial + Salt Checker */}
          <form onSubmit={handleVerifyLookup} className="flex flex-col gap-3">
            <div>
              <span className="font-serif font-bold text-[13px] text-[#26231B] block">
                Resolve by Item Secret
              </span>
              <span className="text-[11px] text-[#6A634F]">
                The serial never leaves your browser; only the resulting hash is queried.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Serial Number (e.g. FNDR-1974-STRAT)"
                value={serial}
                onChange={(e) => {
                  setSerial(e.target.value);
                  setLookupError("");
                }}
                className="font-mono text-[12px] p-2 bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
              />

              <input
                type="text"
                placeholder="32-Byte Secret Salt (0x...)"
                value={salt}
                onChange={(e) => {
                  setSalt(e.target.value);
                  setLookupError("");
                }}
                className="font-mono text-[12px] p-2 bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
              />

              <Button type="submit" variant="primary" size="md" disabled={!serial || !salt}>
                Compute &amp; Resolve
              </Button>
            </div>
          </form>

          {/* Docket Registry Stats */}
          <div className="pt-4 border-t border-[#CFC6AC] flex items-center justify-between text-[12px] text-[#6A634F]">
            <span>Total Titles Docketed:</span>
            <span className="font-mono font-bold text-[#26231B]">
              {totalCount !== undefined ? totalCount : "—"}
            </span>
          </div>
        </div>

        {/* Right Column: Your Titles */}
        <div className="bg-[#FBF7EC] border border-[#CFC6AC] p-6 rounded-[2px] shadow-xs flex flex-col gap-4">
          <div className="border-b border-[#CFC6AC] pb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl font-bold text-[#26231B]">
              Your Titles
            </h2>
            <Link
              href="/register"
              className="font-serif text-[13px] font-bold text-[#8C2F39] hover:underline"
            >
              + Register New
            </Link>
          </div>

          {!isConnected ? (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <span className="font-serif text-lg text-[#5D574A]">
                Connect your wallet to inspect held titles
              </span>
              <p className="text-[12px] text-[#6A634F] max-w-[340px]">
                Your connected account will automatically display all property deeds recorded in your active custody.
              </p>
            </div>
          ) : isLoadingOwned ? (
            <div className="p-8 text-center font-mono text-[13px] text-[#6A634F]">
              Querying docket records...
            </div>
          ) : ownedIds.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <span className="font-serif text-lg text-[#5D574A]">
                No titles yet.
              </span>
              <p className="text-[12px] text-[#6A634F] max-w-[320px]">
                You do not currently hold any property deeds in this wallet.
              </p>
              <Link href="/register">
                <Button variant="primary" size="md">
                  Register an Item
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#E0D8C0]">
              {ownedIds.map((tid: bigint) => (
                <OwnedTitleItem key={String(tid)} id={tid} contractAddress={deployment.address} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OwnedTitleItem({ id, contractAddress }: { id: bigint; contractAddress: Address }) {
  const { data: recRaw } = useReadContract({
    address: contractAddress,
    abi: titleAbi,
    functionName: "recordOf",
    args: [id],
  });

  const rec = recRaw as
    | {
        itemHash: `0x${string}`;
        owner: `0x${string}`;
        registeredAt: bigint;
        transfers: number;
        flag: number;
        label: string;
      }
    | undefined;

  if (!rec) {
    return (
      <div className="py-3 font-mono text-[12px] text-[#6A634F]">
        Loading Title #{String(id)}...
      </div>
    );
  }

  const statusLabel = flagLabel(rec.flag);
  const statusBg =
    rec.flag === 0
      ? "bg-[#2E6B3A] text-white"
      : rec.flag === 1
      ? "bg-[#8A5A00] text-white"
      : "bg-[#9E1F2B] text-white";

  return (
    <Link
      href={`/t/${String(id)}`}
      className="py-3 flex items-center justify-between gap-3 hover:bg-[#F5EFE0] px-2 rounded-[2px] transition-colors no-underline text-[#26231B]"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] font-bold text-[#8C2F39]">
            #{String(id)}
          </span>
          <span className="font-serif font-bold text-[14px]">
            {rec.label}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#6A634F]">
          {rec.transfers} {rec.transfers === 1 ? "transfer" : "transfers"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-[2px] ${statusBg}`}>
          {statusLabel}
        </span>
        <span className="font-serif text-[12px] text-[#8C2F39]">&rarr;</span>
      </div>
    </Link>
  );
}
