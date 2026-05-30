/**
 * CardTrader Zero Check Extension
 *
 * Placement: ~/.pi/agent/extensions/cardtrader-check/index.ts
 *
 * Usage:
 *   /ct0           — Check hub_pending CT0 orders against inventory
 *   /ct0box        — View your CT0 box: arrived vs still on the way
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runCT0Check, runCT0Box, formatCT0FullReport, formatCT0BoxReport } from "./ct0-core";

export default function (pi: ExtensionAPI) {
	// ---- Tool: cardtrader_check ----
	pi.registerTool({
		name: "cardtrader_check",
		label: "CardTrader Zero Check",
		description:
			"Check CardTrader Zero (CT0) hub_pending orders against your inventory. "
			+ "Finds missing listings, insufficient quantity, and other issues. "
			+ "Also shows your CT0 box summary. Requires CARDTRADER_TOKEN env var.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, onUpdate, _ctx) {
			try {
				onUpdate?.({ content: [{ type: "text", text: "🃏 Connecting to CardTrader API…" }] });
				const result = await runCT0Check();
				const box = result.ct0BoxSummary;
				onUpdate?.({ content: [{ type: "text", text: `📦 ${result.hubPendingOrders.length} pending orders | CT0 box: ${box.arrivedCards} arrived, ${box.pendingCards} on the way, ${result.issues.length} issue(s)` }] });
				return {
					content: [{ type: "text", text: formatCT0FullReport(result) }],
					details: { hubPendingCount: result.hubPendingOrders.length, ct0BoxSummary: box, issueCount: result.issues.length, issues: result.issues },
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: `❌ Error: ${message}` }], details: { error: message }, isError: true };
			}
		},
	});

	// ---- Tool: cardtrader_box ----
	pi.registerTool({
		name: "cardtrader_box",
		label: "CardTrader Zero Box View",
		description:
			"Show your CT0 box items — cards you bought via CardTrader Zero. "
			+ "Displays arrived & checked cards vs still on the way with individual card counts. "
			+ "Requires CARDTRADER_TOKEN env var.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, onUpdate, _ctx) {
			try {
				onUpdate?.({ content: [{ type: "text", text: "📦 Fetching CT0 box items…" }] });
				const summary = await runCT0Box();
				onUpdate?.({ content: [{ type: "text", text: `📦 CT0 box: ${summary.arrivedCards} arrived, ${summary.pendingCards} on the way, ${summary.missingCards} missing` }] });
				return {
					content: [{ type: "text", text: formatCT0BoxReport(summary) }],
					details: { ct0BoxSummary: summary },
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: `❌ Error: ${message}` }], details: { error: message }, isError: true };
			}
		},
	});

	// ---- Command: /ct0 ----
	pi.registerCommand("ct0", {
		description: "Check CardTrader Zero orders — find missing listings and stock issues",
		handler: async (_args, ctx) => {
			pi.sendUserMessage("Please run the cardtrader_check tool to check my CT0 orders. Show the full report and tell me what I need to fix. Do NOT create listings or make changes.", { deliverAs: "followUp" });
			ctx.ui.notify("🃏 Checking CardTrader Zero orders…", "info");
		},
	});

	// ---- Command: /ct0box ----
	pi.registerCommand("ct0box", {
		description: "View your CT0 box — arrived & checked vs still on the way",
		handler: async (_args, ctx) => {
			pi.sendUserMessage("Please run the cardtrader_box tool to show my CT0 box items. Show arrived & checked cards vs the ones still on the way with individual card counts.", { deliverAs: "followUp" });
			ctx.ui.notify("📦 Loading CT0 box items…", "info");
		},
	});
}
