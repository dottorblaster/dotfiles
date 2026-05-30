#!/usr/bin/env npx tsx
/**
 * CardTrader Zero CLI runner
 *
 * Usage:
 *   npx tsx run.ts          — Full check (orders + CT0 box)
 *   npx tsx run.ts box      — CT0 box view only (arrived vs pending)
 *
 * Requires: CARDTRADER_TOKEN env var
 */

import { runCT0Check, runCT0Box, formatCT0FullReport, formatCT0BoxReport } from "./ct0-core";

const mode = process.argv[2] || "check";

if (mode === "box") {
	try {
		const summary = await runCT0Box();
		console.log(formatCT0BoxReport(summary));
	} catch (err) {
		console.error(`❌ ${err instanceof Error ? err.message : err}`);
		process.exit(1);
	}
} else {
	try {
		const result = await runCT0Check();
		console.log(formatCT0FullReport(result));
	} catch (err) {
		console.error(`❌ ${err instanceof Error ? err.message : err}`);
		process.exit(1);
	}
}
