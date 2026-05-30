/**
 * CardTrader Zero Core Logic
 *
 * Pure functions for the CardTrader Zero API — shared between the
 * Pi extension (index.ts) and the CLI runner (run.ts).
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const BASE_URL = "https://api.cardtrader.com/api/v2";
export const TOKEN_SETTINGS_URL = "https://www.cardtrader.com/en/profile/settings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CT0BoxItem {
	id: number;
	quantity: number | { ok?: number; pending?: number; missing?: number };
	product_id: number;
	blueprint_id: number;
	category_id: number;
	game_id: number;
	name: string;
	expansion: string;
	bundle_size: number;
	description?: string;
	graded?: string;
	properties?: Record<string, unknown>;
	buyer_price?: { cents: number; currency: string };
	formatted_price?: string;
	mkm_id?: string;
	tcg_player_id?: string;
	[key: string]: unknown;
}

export interface OrderItem {
	id: number;
	quantity: number;
	price?: { cents: number; currency: string };
	product_id?: number;
	blueprint_id?: number;
	hub_pending_order_id?: number;
	user_data_field?: string;
	product_name?: string;
	[key: string]: unknown;
}

export interface Order {
	id: number;
	code?: string;
	state: string;
	via_cardtrader_zero: boolean;
	order_as?: string;
	created_at?: string;
	tracking_code?: string;
	buyer?: { username?: string };
	buyer_username?: string;
	shipping_cost?: { cents: number; currency: string };
	order_items?: OrderItem[];
	items?: OrderItem[];
	[key: string]: unknown;
}

export interface Product {
	id: number;
	name_en?: string;
	blueprint_id: number;
	quantity: number;
	price_cents?: number;
	properties_hash?: Record<string, unknown>;
	properties?: Record<string, unknown>;
	user_data_field?: string;
	[key: string]: unknown;
}

export interface Issue {
	type: "missing_listing" | "insufficient_quantity" | "price_mismatch";
	orderId?: number;
	orderCode?: string;
	blueprintId?: number;
	cardName?: string;
	needed: number;
	have: number;
	details: string;
}

export interface CT0BoxSummary {
	totalEntries: number;
	arrivedEntries: number;
	arrivedCards: number;
	pendingEntries: number;
	pendingCards: number;
	missingCards: number;
	arrivedItems: CT0BoxItem[];
	pendingItems: CT0BoxItem[];
}

export interface CT0CheckResult {
	hubPendingOrders: Order[];
	ct0BoxItems: CT0BoxItem[];
	ct0BoxSummary: CT0BoxSummary;
	products: Product[];
	issues: Issue[];
	summary: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export function getToken(): string | null {
	return process.env.CARDTRADER_TOKEN || null;
}

/** Fetch a single page from the CardTrader API. */
export async function ctFetch(
	path: string,
	token: string,
	params: Record<string, string> = {},
	maxTime = 30,
): Promise<unknown> {
	const url = new URL(`${BASE_URL}${path}`);
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}

	const res = await fetch(url.toString(), {
		headers: {
			"Authorization": `Bearer ${token}`,
			"Accept": "application/json",
		},
		signal: AbortSignal.timeout(maxTime * 1000),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`CardTrader API ${res.status}: ${body.slice(0, 200)}`);
	}

	const data = await res.json();
	if (data && typeof data === "object" && "error" in data) {
		throw new Error(`CardTrader API error: ${(data as Record<string, string>).error}`);
	}
	return data;
}

/**
 * Paginate through results, with deduplication.
 * Some CT endpoints (like /ct0_box_items) don't paginate properly —
 * they return the same data on every page. We detect duplicates by ID.
 */
export async function ctPaginate<T extends { id?: number | string }>(
	path: string,
	token: string,
	baseParams: Record<string, string> = {},
	pageSize = 200,
	maxTime = 30,
): Promise<T[]> {
	const all: T[] = [];
	const seenIds = new Set<string>();
	let page = 1;
	const maxPages = 200;

	while (page <= maxPages) {
		const data = await ctFetch(path, token, { ...baseParams, page: String(page), limit: String(pageSize) }, maxTime);

		let items: unknown[];
		if (Array.isArray(data)) {
			items = data;
		} else if (data && typeof data === "object" && "data" in data) {
			items = Array.isArray((data as Record<string, unknown>).data)
				? (data as Record<string, unknown>).data as unknown[]
				: [];
		} else {
			items = [];
		}

		if (items.length === 0) break;

		let newCount = 0;
		for (const item of items) {
			const id = (item as Record<string, unknown>).id;
			const key = id !== undefined ? String(id) : JSON.stringify(item);
			if (!seenIds.has(key)) {
				seenIds.add(key);
				all.push(item as T);
				newCount++;
			}
		}

		if (newCount === 0) break;
		if (items.length < pageSize) break;
		page++;
		await new Promise((r) => setTimeout(r, 100));
	}

	return all;
}

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

export function getCT0BoxQuantities(item: CT0BoxItem): { ok: number; pending: number; missing: number } {
	if (typeof item.quantity === "number") return { ok: item.quantity, pending: 0, missing: 0 };
	if (item.quantity && typeof item.quantity === "object") {
		const q = item.quantity as { ok?: number; pending?: number; missing?: number };
		return { ok: q.ok ?? 0, pending: q.pending ?? 0, missing: q.missing ?? 0 };
	}
	return { ok: 0, pending: 0, missing: 0 };
}

export function summarizeCT0Box(items: CT0BoxItem[]): CT0BoxSummary {
	const arrivedItems: CT0BoxItem[] = [];
	const pendingItems: CT0BoxItem[] = [];
	let arrivedCards = 0;
	let pendingCards = 0;
	let missingCards = 0;

	for (const item of items) {
		const qty = getCT0BoxQuantities(item);
		if (qty.ok > 0) { arrivedItems.push(item); arrivedCards += qty.ok; }
		if (qty.pending > 0) { pendingItems.push(item); pendingCards += qty.pending; }
		missingCards += qty.missing;
	}

	return {
		totalEntries: items.length,
		arrivedEntries: arrivedItems.length,
		arrivedCards,
		pendingEntries: pendingItems.length,
		pendingCards,
		missingCards,
		arrivedItems,
		pendingItems,
	};
}

export function getOrderItems(order: Order): OrderItem[] {
	return (order.order_items ?? order.items ?? []) as OrderItem[];
}

export function getBuyerUsername(order: Order): string {
	return order.buyer?.username
		|| order.buyer_username
		|| "unknown";
}

export async function runCT0Check(): Promise<CT0CheckResult> {
	const token = getToken();
	if (!token) {
		throw new Error(
			`No CardTrader API token found.\nSet CARDTRADER_TOKEN env var with a token from ${TOKEN_SETTINGS_URL}`,
		);
	}

	const [hubPendingOrders, ct0BoxItems, allProducts] = await Promise.all([
		ctPaginate<Order>("/orders", token, { state: "hub_pending", order_as: "seller" }, 50),
		ctPaginate<CT0BoxItem>("/ct0_box_items", token, {}, 200),
		ctPaginate<Product>("/products/export", token, {}, 500, 120),
	]);

	const ct0BoxSummary = summarizeCT0Box(ct0BoxItems);
	const issues: Issue[] = [];

	const productsByBlueprint = new Map<number, Product[]>();
	for (const p of allProducts) {
		if (p.blueprint_id) {
			const list = productsByBlueprint.get(p.blueprint_id) || [];
			list.push(p);
			productsByBlueprint.set(p.blueprint_id, list);
		}
	}

	for (const order of hubPendingOrders) {
		if (!order.via_cardtrader_zero || order.state !== "hub_pending") continue;
		for (const item of getOrderItems(order)) {
			const bpId = item.blueprint_id;
			if (!bpId) {
				issues.push({ type: "missing_listing", orderId: order.id, orderCode: order.code, cardName: (item.product_name as string) || "Unknown", needed: item.quantity, have: 0, details: "No blueprint_id." });
				continue;
			}
			const matching = productsByBlueprint.get(bpId) || [];
			if (matching.length === 0) {
				issues.push({ type: "missing_listing", orderId: order.id, orderCode: order.code, blueprintId: bpId, cardName: (item.product_name as string) || `Blueprint #${bpId}`, needed: item.quantity, have: 0, details: `No listing for blueprint ${bpId}.` });
				continue;
			}
			const totalQty = matching.reduce((s, p) => s + (p.quantity || 0), 0);
			if (totalQty < item.quantity) {
				issues.push({ type: "insufficient_quantity", orderId: order.id, orderCode: order.code, blueprintId: bpId, cardName: (item.product_name as string) || `Blueprint #${bpId}`, needed: item.quantity, have: totalQty, details: `Need ${item.quantity} but only ${totalQty} in stock.` });
			}
		}
	}

	let summary = "";
	if (hubPendingOrders.length === 0 && ct0BoxItems.length === 0) {
		summary = "✅ No hub_pending CT0 orders and no CT0 box items.";
	} else if (issues.length === 0) {
		summary = `✅ All ${hubPendingOrders.length} hub_pending order(s) have sufficient inventory. Ready to ship!`;
	} else {
		const m = issues.filter(i => i.type === "missing_listing").length;
		const l = issues.filter(i => i.type === "insufficient_quantity").length;
		summary = `⚠️ ${issues.length} issue(s): ${m} missing listing(s), ${l} insufficient quantity.`;
	}

	return { hubPendingOrders, ct0BoxItems, ct0BoxSummary, products: allProducts, issues, summary };
}

export async function runCT0Box(): Promise<CT0BoxSummary> {
	const token = getToken();
	if (!token) {
		throw new Error(
			`No CardTrader API token found.\nSet CARDTRADER_TOKEN env var with a token from ${TOKEN_SETTINGS_URL}`,
		);
	}
	const ct0BoxItems = await ctPaginate<CT0BoxItem>("/ct0_box_items", token, {}, 200);
	return summarizeCT0Box(ct0BoxItems);
}

// ---------------------------------------------------------------------------
// Markdown formatting
// ---------------------------------------------------------------------------

export function formatItemLabel(item: CT0BoxItem): string {
	const name = item.name || `BP#${item.blueprint_id}`;
	const props = item.properties || {};
	const foil = props.mtg_foil === true || props.foil === true;
	return `${foil ? "🪙 " : ""}${name}`;
}

export function formatItemRow(item: CT0BoxItem, qtyField: "ok" | "pending"): string {
	const qty = getCT0BoxQuantities(item);
	const props = item.properties || {};
	const q = qtyField === "ok" ? qty.ok : qty.pending;
	const cond = (props.condition as string) || "—";
	const lang = ((props.mtg_language || props.language) as string) || "—";
	return `| ${formatItemLabel(item)} | ${item.expansion || "—"} | ${q} | ${cond} | ${lang} |`;
}

export function formatCT0BoxReport(summary: CT0BoxSummary): string {
	const lines: string[] = [];

	lines.push("## 📦 CardTrader Zero — Your CT0 Box");
	lines.push("");
	lines.push("| Status | Entries | Individual Cards |");
	lines.push("|--------|---------|--------------------|");
	lines.push(`| ✅ Arrived & checked | ${summary.arrivedEntries} | **${summary.arrivedCards}** |`);
	lines.push(`| 🚚 Still on the way | ${summary.pendingEntries} | ${summary.pendingCards} |`);
	if (summary.missingCards > 0) {
		lines.push(`| ❌ Missing/refunded | — | ${summary.missingCards} |`);
	}
	lines.push(`| **Total** | **${summary.totalEntries}** | **${summary.arrivedCards + summary.pendingCards + summary.missingCards}** |`);
	lines.push("");

	if (summary.arrivedItems.length > 0) {
		lines.push(`### ✅ Arrived & Checked (${summary.arrivedCards} cards in ${summary.arrivedItems.length} entries)`);
		lines.push("");
		lines.push("| Card | Set | Qty | Condition | Language |");
		lines.push("|------|-----|-----|-----------|----------|");
		const sorted = [...summary.arrivedItems].sort((a, b) => getCT0BoxQuantities(b).ok - getCT0BoxQuantities(a).ok || a.name.localeCompare(b.name));
		for (const item of sorted) {
			lines.push(formatItemRow(item, "ok"));
		}
		lines.push("");
	}

	if (summary.pendingItems.length > 0) {
		lines.push(`### 🚚 Still On The Way (${summary.pendingCards} cards in ${summary.pendingItems.length} entries)`);
		lines.push("");
		lines.push("| Card | Set | Qty | Condition | Language |");
		lines.push("|------|-----|-----|-----------|----------|");
		const sorted = [...summary.pendingItems].sort((a, b) => getCT0BoxQuantities(b).pending - getCT0BoxQuantities(a).pending || a.name.localeCompare(b.name));
		for (const item of sorted) {
			lines.push(formatItemRow(item, "pending"));
		}
		lines.push("");
	}

	return lines.join("\n");
}

export function formatCT0FullReport(result: CT0CheckResult): string {
	const lines: string[] = [];

	lines.push("## CardTrader Zero Check");
	lines.push("");
	lines.push(result.summary);
	lines.push("");

	// CT0 Box summary
	const box = result.ct0BoxSummary;
	if (result.ct0BoxItems.length > 0) {
		lines.push("### 📦 CT0 Box — Items You Bought");
		lines.push("");
		lines.push("| Status | Entries | Individual Cards |");
		lines.push("|--------|---------|--------------------|");
		lines.push(`| ✅ Arrived & checked | ${box.arrivedEntries} | **${box.arrivedCards}** |`);
		lines.push(`| 🚚 Still on the way | ${box.pendingEntries} | ${box.pendingCards} |`);
		if (box.missingCards > 0) lines.push(`| ❌ Missing/refunded | — | ${box.missingCards} |`);
		lines.push(`| **Total** | **${box.totalEntries}** | **${box.arrivedCards + box.pendingCards + box.missingCards}** |`);
		lines.push("");

		if (box.arrivedItems.length > 0) {
			lines.push(`#### ✅ Arrived & Checked (${box.arrivedCards} cards)`);
			lines.push("");
			lines.push("| Card | Set | Qty | Condition | Language |");
			lines.push("|------|-----|-----|-----------|----------|");
			for (const item of box.arrivedItems) lines.push(formatItemRow(item, "ok"));
			lines.push("");
		}
		if (box.pendingItems.length > 0) {
			lines.push(`#### 🚚 Still On The Way (${box.pendingCards} cards)`);
			lines.push("");
			lines.push("| Card | Set | Qty | Condition | Language |");
			lines.push("|------|-----|-----|-----------|----------|");
			for (const item of box.pendingItems) lines.push(formatItemRow(item, "pending"));
			lines.push("");
		}
	}

	if (result.hubPendingOrders.length > 0) {
		lines.push(`### Hub Pending Orders (${result.hubPendingOrders.length})`);
		lines.push("");
		for (const order of result.hubPendingOrders) {
			lines.push(`**Order #${order.id}**${order.code ? ` (${order.code})` : ""} — Buyer: ${getBuyerUsername(order)}`);
			if (order.created_at) lines.push(`  Created: ${order.created_at}`);
			lines.push(`  Items: ${getOrderItems(order).length}`);
			if (order.tracking_code) lines.push(`  Tracking: ${order.tracking_code}`);
			for (const item of getOrderItems(order)) {
				lines.push(`  - ${item.product_name || `Blueprint #${item.blueprint_id || "?"}`} × ${item.quantity}`);
			}
			lines.push("");
		}
	}

	if (result.issues.length > 0) {
		lines.push("### ⚠️ Issues");
		lines.push("");
		for (const issue of result.issues) {
			const icon = issue.type === "missing_listing" ? "🔴" : "🟡";
			lines.push(`${icon} **Order #${issue.orderId}** — ${issue.cardName || `Blueprint #${issue.blueprintId}`}`);
			lines.push(`   ${issue.details}`);
			lines.push(`   Need: ${issue.needed} | Have: ${issue.have}`);
			lines.push("");
		}
	} else if (result.hubPendingOrders.length > 0) {
		lines.push("### Next Steps");
		lines.push("");
		lines.push("1. Set tracking: `PUT /orders/{id}/tracking_code`");
		lines.push("2. Mark shipped: `PUT /orders/{id}/ship`");
		lines.push("3. Decrement stock for `hub_pending` CT0 orders only");
		lines.push("");
	}

	return lines.join("\n");
}
