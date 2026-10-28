"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useWriteContract } from "@/lib/useChainWrite";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { titleAbi } from "@/lib/botchain/abi";
import { describeError } from "@/lib/errors";
import { FLAG_CLEAR, FLAG_LOST, FLAG_STOLEN } from "@/lib/title";

interface OwnerControlsProps {
  id: bigint;
  contractAddress: Address;
  currentFlag: number;
  onSuccess?: () => void;
}

export default function OwnerControls({
  id,
  contractAddress,
  currentFlag,
  onSuccess,
}: OwnerControlsProps) {
  const { address } = useAccount();
  const { toast } = useToast();

  const [toAddress, setToAddress] = useState("");
  const [selectedFlag, setSelectedFlag] = useState<number>(currentFlag);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  const { isLoading: isWaiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(toAddress)) {
      toast("error", "Please enter a valid recipient address.");
      return;
    }
    if (address && toAddress.toLowerCase() === address.toLowerCase()) {
      toast("error", "Cannot transfer to yourself.");
      return;
    }

    try {
      writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "transfer",
        args: [id, toAddress as Address],
      });
      toast("info", "Transfer submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  const handleFlagUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      writeContract({
        address: contractAddress,
        abi: titleAbi,
        functionName: "setFlag",
        args: [id, selectedFlag],
      });
      toast("info", "Status stamp submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  return (
    <div className="bg-[#FBF7EC] border border-[#CFC6AC] p-6 rounded-[2px] shadow-xs flex flex-col gap-8">
      <div className="border-b border-[#CFC6AC] pb-3">
        <h3 className="font-serif text-[17px] font-bold text-[#26231B]">
          Holder Authority &amp; Actions
        </h3>
        <p className="font-mono text-[11px] text-[#6A634F] mt-1">
          You are the current recorded owner of Title #{String(id)}.
        </p>
      </div>

      {/* 1. Transfer Custody */}
      <form onSubmit={handleTransfer} className="flex flex-col gap-3">
        <span className="font-serif font-bold text-[14px] text-[#26231B]">
          Transfer Custody to Another Wallet
        </span>
        <p className="text-[12px] text-[#5D574A] leading-relaxed">
          Transferring permanently updates the record. Any active Lost or Stolen flag is automatically cleared
          so the new holder begins clean.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mt-1">
          <input
            type="text"
            placeholder="Recipient Address (0x...)"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value.trim())}
            className="flex-1 font-mono text-[12px] p-2 bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isPending || isWaiting}
            disabled={!toAddress}
          >
            Transfer Title
          </Button>
        </div>
      </form>

      <hr className="border-t border-[#E0D8C0]" />

      {/* 2. Change Status Flag */}
      <form onSubmit={handleFlagUpdate} className="flex flex-col gap-3">
        <span className="font-serif font-bold text-[14px] text-[#26231B]">
          Affix Status Stamp
        </span>
        <p className="text-[12px] text-[#5D574A] leading-relaxed">
          Flags state whether the item is in good standing, reported lost, or reported stolen.
          This will append a new notarized hop to the chain of custody.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-1">
          <button
            type="button"
            onClick={() => setSelectedFlag(FLAG_CLEAR)}
            className={`p-2.5 rounded-[2px] border text-center font-serif text-[13px] transition-all cursor-pointer ${
              selectedFlag === FLAG_CLEAR
                ? "bg-[#2E6B3A] text-white border-[#24542D] font-bold shadow-xs"
                : "bg-[#F5EFE0] text-[#26231B] border-[#CFC6AC] hover:bg-[#EEE6D0]"
            }`}
          >
            Clear (Normal)
          </button>
          <button
            type="button"
            onClick={() => setSelectedFlag(FLAG_LOST)}
            className={`p-2.5 rounded-[2px] border text-center font-serif text-[13px] transition-all cursor-pointer ${
              selectedFlag === FLAG_LOST
                ? "bg-[#8A5A00] text-white border-[#6B4600] font-bold shadow-xs"
                : "bg-[#F5EFE0] text-[#26231B] border-[#CFC6AC] hover:bg-[#EEE6D0]"
            }`}
          >
            Lost
          </button>
          <button
            type="button"
            onClick={() => setSelectedFlag(FLAG_STOLEN)}
            className={`p-2.5 rounded-[2px] border text-center font-serif text-[13px] transition-all cursor-pointer ${
              selectedFlag === FLAG_STOLEN
                ? "bg-[#9E1F2B] text-white border-[#7D1822] font-bold shadow-xs"
                : "bg-[#F5EFE0] text-[#26231B] border-[#CFC6AC] hover:bg-[#EEE6D0]"
            }`}
          >
            Stolen
          </button>
        </div>

        <div className="flex justify-end mt-2">
          <Button
            type="submit"
            variant="secondary"
            size="md"
            loading={isPending || isWaiting}
            disabled={selectedFlag === currentFlag}
          >
            Update Status Stamp
          </Button>
        </div>
      </form>

      {writeError && (
        <div className="p-3 bg-[#F8D7DA] text-[#721C24] border border-[#F5C6CB] rounded-[2px] text-[12px] font-mono">
          {describeError(writeError)}
        </div>
      )}
    </div>
  );
}
