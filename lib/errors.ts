import { activeBotChain } from "@/lib/botchain/chain";
/**
 * Human-readable error translation for Title.
 * Maps contract custom errors and viem/wagmi exceptions into notarial feedback.
 */
export const REVERT_MESSAGES: Record<string, string> = {
  NotOwner: "Only the current owner can do that.",
  BadRecipient: "Invalid recipient address (cannot be zero, self, or contract).",
  NoSuchTitle: "No such title exists.",
  LabelTooLong: "Item label exceeds maximum length of 48 characters.",
  EmptyLabel: "Item label cannot be empty.",
  BadFlag: "Invalid flag value.",
  ZeroHash: "Item hash cannot be zero.",
};

export function describeError(err: unknown): string {
  // A wallet on the other BOT Chain network: writes are pinned to this build's chain (lib/useChainWrite.ts), so wagmi
  // refuses before the wallet opens. Say what to do, not the library's name for it.
  if (/ConnectorChainMismatch|chain mismatch|does not match the target chain/i.test(err instanceof Error ? `${err.name} ${err.message}` : String(err))) {
    return `Your wallet is on a different network. Switch it to ${activeBotChain.name}, then try again.`;
  }
  if (!err) return "An unexpected error occurred.";

  const message = err instanceof Error ? err.message : String(err);

  // Check for AlreadyRegistered(id)
  const alreadyRegMatch = message.match(/AlreadyRegistered\(\s*(?:id\s*:\s*)?([0-9]+n?)\s*\)/i);
  if (alreadyRegMatch && alreadyRegMatch[1]) {
    const cleanId = alreadyRegMatch[1].replace("n", "");
    return `That item is already registered as title #${cleanId}.`;
  }

  if (message.includes("AlreadyRegistered")) {
    return "That item is already registered.";
  }

  for (const [errorName, translation] of Object.entries(REVERT_MESSAGES)) {
    if (new RegExp(`\\b${errorName}\\b`).test(message) || message.includes(errorName)) {
      return translation;
    }
  }

  if (/user rejected|rejected transaction|denied transaction/i.test(message)) {
    return "Transaction was dismissed in your wallet.";
  }

  if (/insufficient funds/i.test(message)) {
    return "Insufficient BOT balance for transaction and gas.";
  }

  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

export const describeContractError = describeError;
