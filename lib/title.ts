import { encodeAbiParameters, keccak256, toHex, type Hex } from "viem";

export const FLAG_CLEAR = 0;
export const FLAG_LOST = 1;
export const FLAG_STOLEN = 2;

export interface TitleRecord {
  itemHash: `0x${string}`;
  owner: `0x${string}`;
  registeredAt: bigint | number;
  transfers: number;
  flag: number;
  label: string;
}

export interface Hop {
  from: `0x${string}`;
  to: `0x${string}`;
  at: bigint | number;
  flag: number;
}

export interface FoldedHop {
  index: number;
  kind: "registered" | "transfer" | "flag";
  from: `0x${string}`;
  to: `0x${string}`;
  at: number;
  flag: number;
  flagLabel: "Clear" | "Lost" | "Stolen";
  dateFormatted: string;
}

/**
 * Normalizes serial string: trims leading/trailing whitespace,
 * collapses internal whitespace runs, and preserves case.
 */
export function normalizeSerial(serial: string): string {
  return serial.trim().replace(/\s+/g, " ");
}

/**
 * Computes keccak256(abi.encode(serial, salt)), matching contract hashFor.
 */
export function hashFor(serial: string, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "bytes32" }],
      [serial, salt]
    )
  );
}

/**
 * Generates 32 secure cryptographically random bytes as 0x-prefixed hex string.
 */
export function newSalt(): Hex {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return toHex(bytes);
}

/**
 * Returns descriptive status label for a flag code.
 */
export function flagLabel(flag: number): "Clear" | "Lost" | "Stolen" {
  if (flag === 1) return "Lost";
  if (flag === 2) return "Stolen";
  return "Clear";
}

/**
 * Formats a UNIX timestamp in full notarial format ("14 March 2027").
 */
export function formatNotarialDate(timestampSec: number | bigint): string {
  const date = new Date(Number(timestampSec) * 1000);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Folds raw chain-of-custody hops into annotated history entries.
 */
export function foldHistory(hops: readonly Hop[]): FoldedHop[] {
  return hops.map((h, index) => {
    const isZeroFrom =
      h.from === "0x0000000000000000000000000000000000000000" || index === 0;
    const isFlagOnly = !isZeroFrom && h.from.toLowerCase() === h.to.toLowerCase();
    const kind: "registered" | "transfer" | "flag" = isZeroFrom
      ? "registered"
      : isFlagOnly
      ? "flag"
      : "transfer";

    const atSec = Number(h.at);
    return {
      index,
      kind,
      from: h.from,
      to: h.to,
      at: atSec,
      flag: h.flag,
      flagLabel: flagLabel(h.flag),
      dateFormatted: formatNotarialDate(atSec),
    };
  });
}
