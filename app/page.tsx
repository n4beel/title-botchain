import BotChainGate from "@/components/botchain/BotChainGate";
import Panel from "@/components/ui/Panel";
import { app } from "@/lib/app-config";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <Panel headerTitle={app.name} headerSub={app.tagline}>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          A public chain-of-custody record for physical or digital items.
        </p>
      </Panel>

      <BotChainGate>
        <Panel>
          <p className="text-[11px] uppercase tracking-[0.04em]" style={{ color: "var(--text-secondary)" }}>
            The one transaction
          </p>
          <p className="mt-2 text-[14px]" style={{ color: "var(--text-primary)" }}>
            {app.theTx}
          </p>
        </Panel>
      </BotChainGate>
    </div>
  );
}
