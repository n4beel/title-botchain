"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Hex, parseEventLogs } from "viem";
import { useAccount, useReadContract, useChainId } from "wagmi";
import { useWaitForTransactionReceipt } from "@/lib/useChainWrite";
import { useWriteContract } from "@/lib/useChainWrite";
import Button from "@/components/ui/Button";
import BotChainGate from "@/components/botchain/BotChainGate";
import { useToast } from "@/components/ui/Toast";
import { titleAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { MAX_LABEL } from "@/lib/limits";
import { describeError } from "@/lib/errors";
import { hashFor, newSalt, normalizeSerial } from "@/lib/title";

export default function RegisterPage() {
  const router = useRouter(); // stable-hook-result
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();

  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  const [label, setLabel] = useState("");
  const [serial, setSerial] = useState("");
  const [salt, setSalt] = useState<Hex>("0x");
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // Initialize salt on mount
  useEffect(() => {
    setSalt(newSalt());
  }, []);

  const normalizedSerial = useMemo(() => normalizeSerial(serial), [serial]);

  const isValidSalt = /^0x[0-9a-fA-F]{64}$/.test(salt);
  const labelBytes = useMemo(() => new TextEncoder().encode(label).length, [label]);

  const computedHash: Hex | null = useMemo(() => {
    if (!normalizedSerial || !isValidSalt) return null;
    try {
      return hashFor(normalizedSerial, salt);
    } catch {
      return null;
    }
  }, [normalizedSerial, salt, isValidSalt]);

  // Check if hash is already registered
  const { data: existingIdRaw } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "idOfHash",
    args: computedHash ? [computedHash] : undefined,
    query: { enabled: deployed && Boolean(computedHash) },
  });

  const existingId = existingIdRaw !== undefined ? Number(existingIdRaw) : 0;

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  const { isLoading: isWaiting, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check new id after registration success
  const { data: newIdRaw, refetch: refetchId } = useReadContract({
    address: deployment.address,
    abi: titleAbi,
    functionName: "idOfHash",
    args: computedHash ? [computedHash] : undefined,
    query: { enabled: deployed && isSuccess && Boolean(computedHash) },
  });

  useEffect(() => {
    if (!isSuccess) return;

    if (receipt) {
      try {
        const logs = parseEventLogs({
          abi: titleAbi,
          eventName: "Registered",
          logs: receipt.logs,
        });
        if (logs.length > 0 && logs[0].args && "id" in logs[0].args) {
          const registeredId = Number(logs[0].args.id);
          if (registeredId > 0) {
            toast("success", `Title #${registeredId} successfully docketed!`);
            router.push(`/t/${registeredId}`);
            return;
          }
        }
      } catch {
        // Fallback to refetch
      }
    }

    if (newIdRaw && Number(newIdRaw) > 0) {
      toast("success", `Title #${String(newIdRaw)} successfully docketed!`);
      router.push(`/t/${String(newIdRaw)}`);
    } else {
      refetchId().then((res) => {
        if (res.data && Number(res.data) > 0) {
          toast("success", `Title #${String(res.data)} successfully docketed!`);
          router.push(`/t/${String(res.data)}`);
        }
      });
    }
  }, [isSuccess, receipt, newIdRaw, refetchId, router, toast]);

  const handleDownloadBackup = () => {
    if (!computedHash || !isValidSalt) return;
    const backupData = {
      product: "Title (BotChain)",
      label: label.trim(),
      serial: normalizedSerial,
      salt: salt,
      itemHash: computedHash,
      chainId: currentChainId,
      createdAt: new Date().toISOString(),
      warning: "Keep this salt secret and safe. Without it, you cannot prove ownership of the hash.",
    };

    try {
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `title-backup-${normalizedSerial.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupDownloaded(true);
      toast("info", "Backup saved to file. Store it safely.");
    } catch {
      toast("error", "Failed to save backup file. Please copy the salt manually.");
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!computedHash) {
      toast("error", "Please enter a valid serial and secret salt.");
      return;
    }
    if (labelBytes === 0) {
      toast("error", "Item label cannot be empty.");
      return;
    }
    if (labelBytes > MAX_LABEL) {
      toast("error", `Label exceeds maximum of ${MAX_LABEL} bytes.`);
      return;
    }
    if (existingId > 0) {
      toast("error", `This item is already registered as Title #${existingId}.`);
      return;
    }
    if (!backupDownloaded) {
      toast("error", "Please download your secret backup before submitting to the blockchain.");
      return;
    }

    try {
      writeContract({
        address: deployment.address,
        abi: titleAbi,
        functionName: "register",
        args: [computedHash, label.trim()],
      });
      toast("info", "Register transaction submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[760px] mx-auto">
      {/* Page Header */}
      <div className="border-b border-[#CFC6AC] pb-4">
        <Link href="/" className="font-serif text-[12px] text-[#8C2F39] hover:underline mb-2 block">
          &larr; Back to Docket Book
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#6A634F]">
          Custody Docket Entry
        </span>
        <h1 className="font-serif text-3xl font-bold text-[#26231B] mt-1">
          Register an Item
        </h1>
        <p className="text-[13px] text-[#5D574A] mt-1 leading-relaxed">
          The serial number is never broadcast to the network. You register only the keccak256 hash of the serial
          combined with a secret salt.
        </p>
      </div>

      <BotChainGate>
        <form onSubmit={handleRegister} className="bg-[#FBF7EC] border border-[#CFC6AC] p-6 md:p-8 rounded-[2px] shadow-xs flex flex-col gap-6">
          {/* Label Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="reg-label" className="font-serif font-bold text-[14px] text-[#26231B]">
                Item Description / Title
              </label>
              <span className={`font-mono text-[11px] ${labelBytes > MAX_LABEL ? "text-[#9E1F2B] font-bold" : "text-[#6A634F]"}`}>
                {labelBytes}/{MAX_LABEL} bytes
              </span>
            </div>
            <input
              id="reg-label"
              type="text"
              maxLength={MAX_LABEL}
              placeholder="e.g. 1974 Fender Stratocaster"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="p-2.5 font-serif text-[14px] bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
              required
            />
          </div>

          {/* Serial Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-serial" className="font-serif font-bold text-[14px] text-[#26231B]">
              Physical or Digital Serial Number
            </label>
            <span className="text-[11px] text-[#6A634F]">
              Trimming and space-collapsing applied automatically; case is strictly preserved.
            </span>
            <input
              id="reg-serial"
              type="text"
              placeholder="e.g. SN-98765-XYZ"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              className="p-2.5 font-mono text-[13px] bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39]"
              required
            />
          </div>

          {/* Secret Salt Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="reg-salt" className="font-serif font-bold text-[14px] text-[#26231B]">
                Secret Salt (32 Bytes Hex)
              </label>
              <button
                type="button"
                onClick={() => {
                  setSalt(newSalt());
                  setBackupDownloaded(false);
                }}
                className="text-[11px] font-mono text-[#8C2F39] hover:underline cursor-pointer"
              >
                Regenerate Random Salt
              </button>
            </div>
            <input
              id="reg-salt"
              type="text"
              value={salt}
              onChange={(e) => {
                setSalt(e.target.value.trim() as Hex);
                setBackupDownloaded(false);
              }}
              className="p-2.5 font-mono text-[12px] bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] text-[#26231B] outline-none focus:border-[#8C2F39] break-all"
              required
            />
          </div>

          {/* Computed Hash Box */}
          {computedHash && (
            <div className="p-4 bg-[#F5EFE0] border border-[#CFC6AC] rounded-[2px] flex flex-col gap-1.5">
              <span className="font-mono text-[11px] text-[#6A634F] uppercase tracking-wider">
                Computed Public Item Hash (Submitted to Chain)
              </span>
              <span className="font-mono text-[12px] text-[#26231B] break-all font-semibold">
                {computedHash}
              </span>

              {existingId > 0 && (
                <div className="mt-2 p-2 bg-[#F8D7DA] text-[#721C24] border border-[#F5C6CB] rounded-[2px] text-[12px] flex items-center justify-between">
                  <span>That item is already registered in the docket!</span>
                  <Link href={`/t/${existingId}`} className="font-bold underline">
                    View Title #{existingId} &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Backup Download Section */}
          <div className="p-4 border rounded-[2px] flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{
              borderColor: backupDownloaded ? "var(--success)" : "var(--border-default)",
              background: backupDownloaded ? "#F0F7F2" : "#F4EEDB",
            }}
          >
            <div className="flex flex-col text-[12px]">
              <span className="font-serif font-bold text-[#26231B]">
                Backup Title Credentials
              </span>
              <span className="text-[#6A634F]">
                Download a JSON receipt with your secret salt before registering. You must keep it safe.
              </span>
            </div>

            <Button
              type="button"
              variant={backupDownloaded ? "secondary" : "primary"}
              size="sm"
              onClick={handleDownloadBackup}
              disabled={!computedHash}
            >
              {backupDownloaded ? "✓ Backup Saved" : "Download Backup (.json)"}
            </Button>
          </div>

          {writeError && (
            <div className="p-3 bg-[#F8D7DA] text-[#721C24] border border-[#F5C6CB] rounded-[2px] text-[12px] font-mono">
              {describeError(writeError)}
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-4 border-t border-[#CFC6AC]">
            <Link href="/" className="font-serif text-[13px] text-[#6A634F] hover:underline">
              Cancel
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isPending || isWaiting}
              disabled={!computedHash || labelBytes === 0 || labelBytes > MAX_LABEL || existingId > 0 || !backupDownloaded}
            >
              {isWaiting ? "Docketing on-chain..." : isPending ? "Confirm in Wallet..." : "Register Title"}
            </Button>
          </div>
        </form>
      </BotChainGate>
    </div>
  );
}
