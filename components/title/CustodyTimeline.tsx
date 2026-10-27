"use client";

import { foldHistory, type Hop, type FoldedHop } from "@/lib/title";

interface CustodyTimelineProps {
  hops: readonly Hop[];
}

export default function CustodyTimeline({ hops }: CustodyTimelineProps) {
  const folded = foldHistory(hops);

  if (folded.length === 0) {
    return (
      <div className="p-6 text-center text-[13px] font-serif text-[#6A634F] bg-[#FBF7EC] border border-[#CFC6AC] rounded-[2px]">
        No custody entries recorded yet.
      </div>
    );
  }

  return (
    <div className="bg-[#FBF7EC] border border-[#CFC6AC] p-6 rounded-[2px] shadow-xs">
      <div className="border-b border-[#CFC6AC] pb-3 mb-6 flex items-baseline justify-between">
        <h3 className="font-serif text-[17px] font-bold text-[#26231B]">
          Chain of Custody
        </h3>
        <span className="font-mono text-[11px] text-[#6A634F]">
          {folded.length} {folded.length === 1 ? "entry" : "entries"} on-chain
        </span>
      </div>

      <div className="custody-rule flex flex-col gap-6 pl-2">
        {folded.map((hop: FoldedHop) => {
          return (
            <div key={hop.index} className="flex items-start gap-4 relative z-10">
              {/* Dot indicator */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono text-white flex-shrink-0 mt-0.5 shadow-xs"
                style={{
                  background:
                    hop.kind === "registered"
                      ? "#26231B"
                      : hop.kind === "flag"
                      ? hop.flag === 1
                        ? "#8A5A00"
                        : hop.flag === 2
                        ? "#9E1F2B"
                        : "#2E6B3A"
                      : "#8C2F39",
                }}
              >
                {hop.index}
              </div>

              {/* Hop Content */}
              <div className="flex-1 flex flex-col gap-1 text-[13px]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-serif font-bold text-[#26231B]">
                    {hop.dateFormatted}
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-[2px] border"
                    style={{
                      background:
                        hop.kind === "registered"
                          ? "#EAE4D3"
                          : hop.kind === "flag"
                          ? "#FBF7EC"
                          : "#F5EFE0",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {hop.kind === "registered"
                      ? "Registration"
                      : hop.kind === "flag"
                      ? `Flag: ${hop.flagLabel}`
                      : "Transfer"}
                  </span>
                </div>

                {hop.kind === "registered" && (
                  <p className="text-[12px] text-[#5D574A] font-mono break-all">
                    Registered by <span className="text-[#26231B]">{hop.to}</span>
                  </p>
                )}

                {hop.kind === "transfer" && (
                  <p className="text-[12px] text-[#5D574A] font-mono break-all">
                    Transferred from <span className="text-[#26231B]">{hop.from}</span> to{" "}
                    <span className="text-[#26231B]">{hop.to}</span>
                  </p>
                )}

                {hop.kind === "flag" && (
                  <p className="text-[12px] text-[#5D574A] font-mono break-all">
                    Status marked <strong className="font-serif text-[#26231B]">{hop.flagLabel}</strong> by{" "}
                    <span className="text-[#26231B]">{hop.from}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
