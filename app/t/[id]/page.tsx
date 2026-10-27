"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Address } from "viem";
import { useAccount, useReadContract, useChainId } from "wagmi";
import DeedCard from "@/components/title/DeedCard";
import CustodyTimeline from "@/components/title/CustodyTimeline";
import OwnerControls from "@/components/title/OwnerControls";
import { titleAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { type Hop } from "@/lib/title";

export default function TitleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const idStr = resolvedParams.id;
  const idNum = parseInt(idStr, 10);
  const idBigInt = BigInt(idNum || 0);

  const { address } = useAccount();
  const chainId = useChainId();

  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  // Read total count to validate existence
  const { data: countRaw } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "count",
    query: { enabled: deployed },
  });

  const totalCount = countRaw !== undefined ? Number(countRaw) : undefined;

  // Read recordOf(id)
  const { data: recordRaw, isLoading: isLoadingRecord, refetch: refetchRecord } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "recordOf",
    args: idNum > 0 ? [idBigInt] : undefined,
    query: { enabled: deployed && idNum > 0 },
  });

  // Read history hops for this title (up to 50)
  const { data: hopsRaw, isLoading: isLoadingHops, refetch: refetchHops } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "historyOf",
    args: idNum > 0 ? [idBigInt, 0, 50] : undefined,
    query: { enabled: deployed && idNum > 0 },
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

  const hops = (hopsRaw as readonly Hop[] | undefined) ?? [];

  if (totalCount !== undefined && (idNum < 1 || idNum > totalCount)) {
    return (
      <div className="flex flex-col gap-6 max-w-[600px] mx-auto py-12 text-center">
        <h1 className="font-serif text-3xl font-bold text-[#26231B]">
          Title #{idStr} Not Docketed
        </h1>
        <p className="text-[14px] text-[#5D574A] leading-relaxed">
          No record exists for title #{idStr}. The current docket contains {totalCount} registered items.
        </p>
        <div>
          <Link href="/" className="font-serif text-[#8C2F39] underline font-bold">
            &larr; Return to Docket Book
          </Link>
        </div>
      </div>
    );
  }

  const isCurrentOwner =
    Boolean(address) &&
    Boolean(record?.owner) &&
    address?.toLowerCase() === record?.owner?.toLowerCase();

  const handleRefresh = () => {
    refetchRecord();
    refetchHops();
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between border-b border-[#CFC6AC] pb-4">
        <div>
          <Link href="/" className="font-serif text-[12px] text-[#8C2F39] hover:underline mb-1 block">
            &larr; Back to Docket Book
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-widest text-[#6A634F]">
            Title Docket Record #{idStr}
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#26231B] mt-0.5">
            {record?.label ?? `Title #${idStr}`}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="text-[11px] font-mono text-[#6A634F] hover:text-[#26231B] cursor-pointer border border-[#CFC6AC] px-2.5 py-1 rounded-[2px] bg-[#FBF7EC]"
        >
          Refresh On-Chain State
        </button>
      </div>

      {isLoadingRecord ? (
        <div className="py-20 text-center font-mono text-[14px] text-[#6A634F]">
          Retrieving notarized record for Title #{idStr}...
        </div>
      ) : !record ? (
        <div className="py-20 text-center font-serif text-[16px] text-[#5D574A]">
          Record could not be loaded from RPC. Check connection.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Deed Sheet (Left / Center) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <DeedCard
              id={idNum}
              label={record.label}
              itemHash={record.itemHash}
              owner={record.owner}
              registeredAt={record.registeredAt}
              transfers={record.transfers}
              flag={record.flag}
              interactive={false}
            />

            {/* Owner Authority Controls */}
            {isCurrentOwner && (
              <OwnerControls
                id={idBigInt}
                contractAddress={deployment.address}
                currentFlag={record.flag}
                onSuccess={handleRefresh}
              />
            )}
          </div>

          {/* Chain of Custody Timeline (Right on desktop, below on mobile) */}
          <div className="lg:col-span-5">
            <CustodyTimeline hops={hops} />
          </div>
        </div>
      )}
    </div>
  );
}
