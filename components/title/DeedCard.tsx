"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNotarialDate, flagLabel, FLAG_CLEAR, FLAG_LOST, FLAG_STOLEN } from "@/lib/title";

interface DeedCardProps {
  id: bigint | number;
  label: string;
  itemHash: string;
  owner: string;
  registeredAt: bigint | number;
  transfers: number;
  flag: number;
  interactive?: boolean;
}

export default function DeedCard({
  id,
  label,
  itemHash,
  owner,
  registeredAt,
  transfers,
  flag,
  interactive = true,
}: DeedCardProps) {
  const [copied, setCopied] = useState(false);
  const statusWord = flagLabel(flag).toUpperCase();

  const handleCopyHash = () => {
    navigator.clipboard.writeText(itemHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sealClass =
    flag === FLAG_CLEAR
      ? "seal-clear"
      : flag === FLAG_LOST
      ? "seal-lost"
      : flag === FLAG_STOLEN
      ? "seal-stolen"
      : "seal-clear";

  return (
    <div className="deed-sheet p-6 md:p-8 rounded-[3px] text-[#26231B] relative overflow-hidden flex flex-col justify-between min-h-[340px]">
      {/* Top Header Block */}
      <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: "var(--border-default)" }}>
        <div className="flex flex-col">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#6A634F]">
            Title Docket Record
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-[#26231B]">
            No. #{String(id)}
          </span>
        </div>

        {/* Notarial Status Seal */}
        <div className={`deed-seal ${sealClass} flex-shrink-0 z-10`}>
          <span className="text-[9px] font-mono tracking-widest opacity-80 uppercase leading-none mb-0.5">
            STATUS
          </span>
          <span className="text-[12px] font-serif font-black tracking-wider leading-none">
            {statusWord}
          </span>
          <span className="text-[8px] font-mono opacity-70 mt-0.5">
            BOTCHAIN
          </span>
        </div>
      </div>

      {/* Centred Item Label / Title */}
      <div className="my-6 text-center px-4">
        <span className="text-[12px] font-mono uppercase tracking-widest text-[#6A634F] block mb-1">
          REGISTERED PROPERTY
        </span>
        <h2 className="font-serif text-2xl md:text-3xl font-normal tracking-tight text-[#26231B] break-words">
          &ldquo;{label}&rdquo;
        </h2>
      </div>

      {/* Deed Particulars Block */}
      <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]" style={{ borderColor: "var(--border-default)" }}>
        <div>
          <span className="text-[#6A634F] block font-mono text-[11px]">REGISTERED ON</span>
          <span className="font-serif text-[14px] text-[#26231B]">
            {formatNotarialDate(registeredAt)}
          </span>
        </div>

        <div>
          <span className="text-[#6A634F] block font-mono text-[11px]">CHAIN OF CUSTODY</span>
          <span className="font-serif text-[14px] text-[#26231B]">
            {transfers} {transfers === 1 ? "transfer" : "transfers"} recorded
          </span>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-[#6A634F] font-mono text-[11px]">CURRENT HOLDER</span>
          <span className="font-mono text-[12px] text-[#26231B] break-all">
            {owner}
          </span>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[#6A634F] font-mono text-[11px]">ITEM HASH (KECCAK256)</span>
            <button
              type="button"
              onClick={handleCopyHash}
              className="text-[10px] font-mono underline hover:text-[#8C2F39] cursor-pointer"
            >
              {copied ? "Copied" : "Copy Hash"}
            </button>
          </div>
          <span className="font-mono text-[11px] text-[#5D574A] break-all bg-[#F4EEDB] p-1.5 rounded-[2px] border border-[#CFC6AC]">
            {itemHash}
          </span>
        </div>
      </div>

      {interactive && (
        <div className="mt-4 pt-3 border-t flex justify-end" style={{ borderColor: "var(--border-subtle)" }}>
          <Link
            href={`/t/${String(id)}`}
            className="text-[12px] font-serif font-bold text-[#8C2F39] hover:underline"
          >
            Inspect Deed &amp; Custody Trail &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
