/**
 * Unit tests for cardtrader-check extension logic.
 * Tests the pure functions exported from ct0-core.ts.
 *
 * Run with:  npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
	getCT0BoxQuantities,
	summarizeCT0Box,
	formatItemLabel,
	formatItemRow,
} from "./ct0-core";
import type { CT0BoxItem, CT0BoxSummary } from "./ct0-core";

// ---------------------------------------------------------------------------
// Tests: getCT0BoxQuantities
// ---------------------------------------------------------------------------

describe("getCT0BoxQuantities", () => {
	it("handles plain number quantity", () => {
		const item: CT0BoxItem = mkItem({ quantity: 5 });
		expect(getCT0BoxQuantities(item)).toEqual({ ok: 5, pending: 0, missing: 0 });
	});

	it("handles object quantity with all states", () => {
		const item: CT0BoxItem = mkItem({ quantity: { ok: 3, pending: 1, missing: 0 } });
		expect(getCT0BoxQuantities(item)).toEqual({ ok: 3, pending: 1, missing: 0 });
	});

	it("handles object quantity with only pending", () => {
		const item: CT0BoxItem = mkItem({ quantity: { pending: 2 } });
		expect(getCT0BoxQuantities(item)).toEqual({ ok: 0, pending: 2, missing: 0 });
	});

	it("handles empty quantity object", () => {
		const item: CT0BoxItem = mkItem({ quantity: {} });
		expect(getCT0BoxQuantities(item)).toEqual({ ok: 0, pending: 0, missing: 0 });
	});
});

// ---------------------------------------------------------------------------
// Tests: summarizeCT0Box
// ---------------------------------------------------------------------------

describe("summarizeCT0Box", () => {
	it("summarizes mixed items correctly", () => {
		const items: CT0BoxItem[] = [
			mkItem({ id: 1, name: "Arrived A", quantity: { ok: 3, pending: 0 } }),
			mkItem({ id: 2, name: "Arrived B", quantity: { ok: 1, pending: 0 } }),
			mkItem({ id: 3, name: "Pending C", quantity: { ok: 0, pending: 2 } }),
			mkItem({ id: 4, name: "Both D", quantity: { ok: 1, pending: 1 } }),
			mkItem({ id: 5, name: "Missing E", quantity: { ok: 0, pending: 0, missing: 1 } }),
		];

		const s = summarizeCT0Box(items);
		expect(s.totalEntries).toBe(5);
		expect(s.arrivedEntries).toBe(3);
		expect(s.arrivedCards).toBe(5);
		expect(s.pendingEntries).toBe(2);
		expect(s.pendingCards).toBe(3);
		expect(s.missingCards).toBe(1);
	});

	it("matches real-world scenario (199 arrived)", () => {
		const items: CT0BoxItem[] = [
			mkItem({ id: 1, name: "Forest (LOTR)", quantity: { ok: 18 } }),
			mkItem({ id: 2, name: "Plains (TMNT)", quantity: { ok: 13 } }),
			mkItem({ id: 3, name: "Mountain (SCD)", quantity: { ok: 10 } }),
			mkItem({ id: 4, name: "Ancient Den", quantity: { ok: 0, pending: 4 } }),
			mkItem({ id: 5, name: "Kor Skyfisher", quantity: { ok: 0, pending: 4 } }),
		];

		const s = summarizeCT0Box(items);
		expect(s.arrivedCards).toBe(41);
		expect(s.pendingCards).toBe(8);
		expect(s.arrivedEntries).toBe(3);
		expect(s.pendingEntries).toBe(2);
	});

	it("handles empty list", () => {
		const s = summarizeCT0Box([]);
		expect(s.totalEntries).toBe(0);
		expect(s.arrivedCards).toBe(0);
	});

	it("handles plain number quantities", () => {
		const items: CT0BoxItem[] = [
			mkItem({ id: 1, name: "A", quantity: 5 }),
			mkItem({ id: 2, name: "B", quantity: 3 }),
		];
		const s = summarizeCT0Box(items);
		expect(s.arrivedCards).toBe(8);
	});
});

// ---------------------------------------------------------------------------
// Tests: Formatting
// ---------------------------------------------------------------------------

describe("formatItemLabel", () => {
	it("includes foil emoji for foil cards", () => {
		const item = mkItem({ name: "Island", properties: { mtg_foil: true } });
		expect(formatItemLabel(item)).toBe("🪙 Island");
	});

	it("no foil emoji for non-foil", () => {
		const item = mkItem({ name: "Forest" });
		expect(formatItemLabel(item)).toBe("Forest");
	});
});

describe("formatItemRow", () => {
	it("formats arrived item correctly", () => {
		const item = mkItem({
			name: "Island", expansion: "Ravnica",
			quantity: { ok: 3, pending: 0 },
			properties: { condition: "Near Mint", mtg_language: "en" },
		});
		expect(formatItemRow(item, "ok")).toBe("| Island | Ravnica | 3 | Near Mint | en |");
	});

	it("formats pending item correctly", () => {
		const item = mkItem({
			name: "Ancient Den", expansion: "Edge of Eternities",
			quantity: { ok: 0, pending: 4 },
			properties: { condition: "Near Mint", mtg_language: "en" },
		});
		expect(formatItemRow(item, "pending")).toBe("| Ancient Den | Edge of Eternities | 4 | Near Mint | en |");
	});
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mkItem(overrides: Partial<CT0BoxItem> = {}): CT0BoxItem {
	return {
		id: 1, blueprint_id: 100, product_id: 1, name: "Card",
		expansion: "Set", bundle_size: 1, category_id: 1, game_id: 1,
		...overrides,
	};
}
