"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type Hex } from "viem";
import { useReadContract, useChainId } from "wagmi";
import Button from "@/components/ui/Button";
import DeedCard from "@/components/title/DeedCard";
import { titleAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain, isBotChainId, type BotChainId } from "@/lib/botchain/chain";
import { hashFor, normalizeSerial } from "@/lib/title";

function VerifyContent() {
  const searchParams = useSearchParams();
  const chainId = useChainId();

  const currentChainId: BotChainId = activeBotChain.id;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  const initialSerial = searchParams.get("serial") ?? "";
  const initialSalt = searchParams.get("salt") ?? "";

  const [serial, setSerial] = useState(initialSerial);
  const [salt, setSalt] = useState(initialSalt);
  const [hasQueried, setHasQueried] = useState(Boolean(initialSerial && initialSalt));

  const normalized = useMemo(() => normalizeSerial(serial), [serial]);
  const isValidSalt = /^0x[0-9a-fA-F]{64}$/.test(salt.trim());

  const computedHash: Hex | null = useMemo(() => {
    if (!normalized || !isValidSalt) return null;
    try {
      return hashFor(normalized, salt.trim() as Hex);
    } catch {
      return null;
    }
  }, [normalized, salt, isValidSalt]);

  const { data: matchedIdRaw, isLoading: isChecking } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "idOfHash",
    args: computedHash ? [computedHash] : undefined,
    query: { enabled: deployed && Boolean(computedHash) && hasQueried },
  });

  const matchedId = matchedIdRaw !== undefined ? Number(matchedIdRaw) : undefined;

  // Read record if matched
  const { data: recordRaw, isLoading: isLoadingRecord } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "recordOf",
    args: matchedId && matchedId > 0 ? [BigInt(matchedId)] : undefined,
    query: { enabled: deployed && Boolean(matchedId && matchedId > 0) },
  });

  const record = recordRaw as
    | {
        itemHash: `0x${string}`;
        owner: `0x${string}`;
        registeredAt: bigint;
        transfers: number;
        flag: number;
        label: string;
      }
    | undefined;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (computedHash) {
      setHasQueried(true);
    }
  };

  const handleLoadKnownSample = () => {
    setSerial("FNDR-1974-STRAT");
    setSalt("0x1111111111111111111111111111111111111111111111111111111111111111");
    setHasQueried(true);
  };

  return (
    <div className="flex flex-col gap-8 max-w-[760px] mx-auto">
      {/* Page Header */}
      <div className="border-b border-[#CFC6AC] pb-4">
        <Link href="/" className="font-serif text-[12px] text-[#8C2F39] hover:underline mb-2 block">
          &larr; Back to Docket Book
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#6A634F]">
          Independent Provenance Verification
        </span>
        <h1 className="font-serif text-3xl font-bold text-[#26231B] mt-1">
          Verify Item Serial &amp; Salt
        </h1>
        <p className="text-[13px] text-[#5D574A] mt-1 leading-relaxed">
          Anyone holding a physical item&apos;s serial number and secret salt can compute its hash locally to prove
          that the item corresponds to an authentic, un-tampered docket title.
        </p>
      </div>

      {/* Verification Form */}
      <form
        onSubmit={handleVerify}
        className="bg-[#FBF7EC] border border-[#CFC6AC] p-6 rounded-[2px] shadow-xs flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <span className="font-serif font-bold text-[14px] text-[#26231B]">
            Item Credentials
          </span>
          <button
            type="button"
            onClick={handleLoadKnownSample}
            className="text-[11px] font-mono text-[#8C2F39] hover:underline cursor-pointer"
          >
            Load Sample (1974 Fender Strat)
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="verify-serial" className="font-mono text-[12px] text-[#6A634F]">
            Serial Number
          </label>
          <input
            id="verify-serial"
            type="text"
            placeholder="e.g. FNDR-1974-STRAT"
            value={serial}
            onChange={(e) => {
              setSerial(e.target.value);
              setHasQueried(false);
            }}
            className="p-2.5 font-mono text-[13px] bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="verify-salt" className="font-mono text-[12px] text-[#6A634F]">
            Secret Salt (32 Bytes Hex)
          </label>
          <input
            id="verify-salt"
            type="text"
            placeholder="0x..."
            value={salt}
            onChange={(e) => {
              setSalt(e.target.value.trim());
              setHasQueried(false);
            }}
            className="p-2.5 font-mono text-[12px] bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39] break-all"
            required
          />
        </div>

        {computedHash && (
          <div className="p-3 bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] flex flex-col gap-1 text-[11px] font-mono">
            <span className="text-[#6A634F]">Resolved Hash (Computed Locally):</span>
            <span className="text-[#26231B] break-all font-bold">{computedHash}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isChecking || isLoadingRecord}
            disabled={!computedHash}
          >
            Verify Against Docket
          </Button>
        </div>
      </form>

      {/* Verification Result */}
      {hasQueried && computedHash && !isChecking && matchedId !== undefined && (
        <div className="flex flex-col gap-4">
          {matchedId > 0 && record ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-[#EAF5EC] border border-[#A3D9A5] text-[#2E6B3A] rounded-[2px] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#2E6B3A] text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                  <span className="font-serif font-bold text-[15px]">
                    Verified Proof Match — Registered as Title #{matchedId}
                  </span>
                </div>

                <Link
                  href={`/t/${matchedId}`}
                  className="font-serif text-[13px] font-bold text-[#8C2F39] underline"
                >
                  View Full Deed &rarr;
                </Link>
              </div>

              <DeedCard
                id={matchedId}
                label={record.label}
                itemHash={record.itemHash}
                owner={record.owner}
                registeredAt={record.registeredAt}
                transfers={record.transfers}
                flag={record.flag}
                interactive={true}
              />
            </div>
          ) : matchedId === 0 ? (
            <div className="p-6 bg-[#FBF7EC] border border-[#E0D8C0] rounded-[2px] text-center flex flex-col gap-2">
              <span className="font-serif text-lg font-bold text-[#26231B]">
                No Registration Found
              </span>
              <p className="text-[13px] text-[#5D574A] max-w-[480px] mx-auto leading-relaxed">
                The computed hash (<code className="font-mono text-[11px] break-all">{computedHash}</code>)
                is not recorded in the on-chain docket. This item has never been registered, or the salt is incorrect.
              </p>
              <div className="pt-2">
                <Link href="/register">
                  <Button variant="secondary" size="sm">
                    Register This Item Now
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center font-mono text-[13px] text-[#6A634F]">Loading verifier...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
