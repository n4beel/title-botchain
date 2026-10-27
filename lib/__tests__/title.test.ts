import { describe, expect, it } from "vitest";
import { describeError } from "../errors";
import {
  FLAG_CLEAR,
  FLAG_LOST,
  FLAG_STOLEN,
  flagLabel,
  foldHistory,
  formatNotarialDate,
  hashFor,
  newSalt,
  normalizeSerial,
  type Hop,
} from "../title";

describe("Title library", () => {
  describe("hashFor", () => {
    it("matches the exact contract test vector", () => {
      const serial = "SN-98765-XYZ";
      const salt = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
      const expected = "0x52a7add389d4b8865cdc0806dd3b055e0d884337183cb98e7979a0965f39560f";

      const calculated = hashFor(serial, salt);
      expect(calculated).toBe(expected);
    });

    it("changes when serial or salt changes", () => {
      const salt1 = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
      const salt2 = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;

      const h1 = hashFor("ITEM-A", salt1);
      const h2 = hashFor("ITEM-A", salt2);
      const h3 = hashFor("ITEM-B", salt1);

      expect(h1).not.toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });

  describe("newSalt", () => {
    it("generates a valid 32-byte hex string", () => {
      const salt = newSalt();
      expect(salt).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it("generates distinct salts on subsequent calls", () => {
      const s1 = newSalt();
      const s2 = newSalt();
      expect(s1).not.toBe(s2);
    });
  });

  describe("normalizeSerial", () => {
    it("trims leading and trailing whitespace", () => {
      expect(normalizeSerial("  ABC-123  ")).toBe("ABC-123");
    });

    it("collapses multiple internal whitespace characters into single space", () => {
      expect(normalizeSerial("Fender   Stratocaster \t 1974")).toBe("Fender Stratocaster 1974");
    });

    it("preserves case", () => {
      expect(normalizeSerial("aBcDeFg")).toBe("aBcDeFg");
    });
  });

  describe("flagLabel", () => {
    it("maps 0 to Clear", () => {
      expect(flagLabel(FLAG_CLEAR)).toBe("Clear");
    });

    it("maps 1 to Lost", () => {
      expect(flagLabel(FLAG_LOST)).toBe("Lost");
    });

    it("maps 2 to Stolen", () => {
      expect(flagLabel(FLAG_STOLEN)).toBe("Stolen");
    });
  });

  describe("formatNotarialDate", () => {
    it("formats unix timestamp in UTC notarial form", () => {
      // 1700000000 = 2023-11-14T22:13:20Z
      const formatted = formatNotarialDate(1700000000);
      expect(formatted).toBe("14 November 2023");
    });
  });

  describe("foldHistory", () => {
    it("correctly identifies registration, transfer, and flag events", () => {
      const hops: Hop[] = [
        {
          from: "0x0000000000000000000000000000000000000000",
          to: "0x1111111111111111111111111111111111111111",
          at: 1700000000n,
          flag: 0,
        },
        {
          from: "0x1111111111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          at: 1700100000n,
          flag: 0,
        },
        {
          from: "0x2222222222222222222222222222222222222222",
          to: "0x2222222222222222222222222222222222222222",
          at: 1700200000n,
          flag: 1,
        },
      ];

      const folded = foldHistory(hops);
      expect(folded).toHaveLength(3);

      expect(folded[0].kind).toBe("registered");
      expect(folded[0].flagLabel).toBe("Clear");

      expect(folded[1].kind).toBe("transfer");
      expect(folded[1].from).toBe("0x1111111111111111111111111111111111111111");
      expect(folded[1].to).toBe("0x2222222222222222222222222222222222222222");

      expect(folded[2].kind).toBe("flag");
      expect(folded[2].flag).toBe(1);
      expect(folded[2].flagLabel).toBe("Lost");
    });
  });

  describe("describeError", () => {
    it("formats AlreadyRegistered with title ID", () => {
      const err = new Error("revert: AlreadyRegistered(42)");
      expect(describeError(err)).toBe("That item is already registered as title #42.");
    });

    it("translates NotOwner error", () => {
      const err = new Error("revert: NotOwner()");
      expect(describeError(err)).toBe("Only the current owner can do that.");
    });

    it("translates BadRecipient error", () => {
      const err = new Error("revert: BadRecipient()");
      expect(describeError(err)).toBe(
        "Invalid recipient address (cannot be zero, self, or contract).",
      );
    });

    it("translates NoSuchTitle error", () => {
      const err = new Error("revert: NoSuchTitle()");
      expect(describeError(err)).toBe("No such title exists.");
    });

    it("translates user rejection", () => {
      const err = new Error("User rejected the request.");
      expect(describeError(err)).toBe("Transaction was dismissed in your wallet.");
    });
  });
});
