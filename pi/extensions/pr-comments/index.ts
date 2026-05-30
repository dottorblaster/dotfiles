/**
 * PR Comments Extension
 *
 * Provides a tool to fetch unresolved comments from the PR
 * associated with the current git branch, so the agent can
 * review and address them.
 *
 * Placement: ~/.pi/agent/extensions/pr-comments/index.ts
 *
 * Usage: The LLM can call `get_pr_comments` to discover open PR
 * comments, or you can invoke `/pr-comments` to fetch and
 * display them immediately.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a shell command and return trimmed stdout. */
async function run(cmd: string, args: string[], cwd?: string): Promise<string> {
	const { stdout } = await exec(cmd, args, { cwd, maxBuffer: 10 * 1024 * 1024 });
	return stdout.trim();
}

/** Parse JSON output from gh CLI. */
async function ghJson(args: string[], cwd?: string): Promise<unknown> {
	const out = await run("gh", [...args, "--json", "id,number,title,url,state,body,headRefName,baseRefName,repository,isDraft"], cwd);
	return JSON.parse(out);
}

/** Get current git branch. */
async function getCurrentBranch(cwd: string): Promise<string> {
	return run("git", ["branch", "--show-current"], cwd);
}

/** Check if gh CLI is authenticated. */
async function isGhAuthenticated(cwd: string): Promise<boolean> {
	try {
		await run("gh", ["auth", "status"], cwd);
		return true;
	} catch {
		return false;
	}
}

/** Fetch unresolved review (line) comments via gh API. */
interface ReviewComment {
	id: number;
	body: string;
	path: string;
	line: number | null;
	startLine: number | null;
	originalLine: number | null;
	diffHunk: string;
	user: { login: string };
	createdAt: string;
	inReplyToId: number | null;
	pullRequestReviewId: number | null;
	subjectType: "line" | "file" | null;
	resolved: boolean;
	outdated: boolean;
}

async function fetchReviewComments(prNumber: number, repo: string, cwd: string): Promise<ReviewComment[]> {
	const out = await run("gh", [
		"api",
		`repos/${repo}/pulls/${prNumber}/comments`,
		"--jq", ".",
	], cwd);

	const raw = JSON.parse(out) as Record<string, unknown>[];
	return raw
		.map((c) => ({
			id: c.id as number,
			body: (c.body as string) || "",
			path: (c.path as string) || "",
			line: (c.line as number | null) ?? null,
			startLine: (c.start_line as number | null) ?? null,
			originalLine: (c.original_line as number | null) ?? null,
			diffHunk: (c.diff_hunk as string) || "",
			user: { login: (c.user as Record<string, unknown>)?.login as string || "" },
			createdAt: (c.created_at as string) || "",
			inReplyToId: (c.in_reply_to_id as number | null) ?? null,
			pullRequestReviewId: (c.pull_request_review_id as number | null) ?? null,
			subjectType: (c.subject_type as "line" | "file" | null) ?? null,
			resolved: (c.resolved as boolean) ?? false,
			outdated: (c.outdated as boolean) ?? false,
		}))
		.filter((c) => !c.resolved);
}

/** Fetch PR-level (issue-style) comments via gh API. */
interface IssueComment {
	id: number;
	body: string;
	user: { login: string };
	createdAt: string;
}

async function fetchIssueComments(prNumber: number, repo: string, cwd: string): Promise<IssueComment[]> {
	const out = await run("gh", [
		"api",
		`repos/${repo}/issues/${prNumber}/comments`,
		"--jq", ".",
	], cwd);

	const raw = JSON.parse(out) as Record<string, unknown>[];
	return raw.map((c) => ({
		id: c.id as number,
		body: (c.body as string) || "",
		user: { login: (c.user as Record<string, unknown>)?.login as string || "" },
		createdAt: (c.created_at as string) || "",
	}));
}

/** Fetch reviews (REQUEST_FOR_CHANGES etc.) via gh API. */
interface Review {
	id: number;
	state: string;
	body: string;
	user: { login: string };
	submittedAt: string;
}

async function fetchReviews(prNumber: number, repo: string, cwd: string): Promise<Review[]> {
	const out = await run("gh", [
		"api",
		`repos/${repo}/pulls/${prNumber}/reviews`,
		"--jq", ".",
	], cwd);

	const raw = JSON.parse(out) as Record<string, unknown>[];
	return raw
		.filter((r) => (r.state as string) === "CHANGES_REQUESTED" || (r.state as string) === "COMMENTED")
		.map((r) => ({
			id: r.id as number,
			state: r.state as string,
			body: (r.body as string) || "",
			user: { login: (r.user as Record<string, unknown>)?.login as string || "" },
			submittedAt: (r.submitted_at as string) || "",
		}));
}

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

/** Group review comments by thread (same file + line range). */
interface CommentThread {
	file: string;
	line: number | null;
	startLine: number | null;
	diffHunk: string;
	comments: ReviewComment[];
	subjectType: "line" | "file" | null;
}

function groupReviewCommentsByThread(comments: ReviewComment[]): CommentThread[] {
	const threads = new Map<string, CommentThread>();

	for (const c of comments) {
		const key = `${c.path}::${c.startLine ?? "null"}::${c.line ?? "null"}`;
		if (!threads.has(key)) {
			threads.set(key, {
				file: c.path,
				line: c.line,
				startLine: c.startLine,
				diffHunk: c.diffHunk,
				comments: [],
				subjectType: c.subjectType,
			});
		}
		threads.get(key)!.comments.push(c);
	}

	return Array.from(threads.values()).sort((a, b) => {
		const fileCmp = a.file.localeCompare(b.file);
		if (fileCmp !== 0) return fileCmp;
		return (a.startLine ?? a.line ?? 0) - (b.startLine ?? b.line ?? 0);
	});
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatCommentsReport(
	prUrl: string,
	prTitle: string,
	prBody: string | null,
	prAuthor: string,
	reviewThreads: CommentThread[],
	issueComments: IssueComment[],
	reviews: Review[],
): string {
	const parts: string[] = [];

	parts.push(`## PR: ${prTitle}`);
	parts.push(`URL: ${prUrl}`);
	parts.push(`Author: ${prAuthor}`);
	parts.push("");

	const totalCount = reviewThreads.reduce((sum, t) => sum + t.comments.length, 0)
		+ issueComments.length
		+ reviews.filter((r) => r.body).length;

	if (totalCount === 0) {
		parts.push("No unresolved comments found. 🎉");
		return parts.join("\n");
	}

	// --- PR body (if it contains reviewer questions) ---
	if (prBody) {
		parts.push("### PR Body");
		parts.push(prBody);
		parts.push("");
	}

	// --- Reviews (CHANGES_REQUESTED / COMMENTED with body) ---
	const bodyReviews = reviews.filter((r) => r.body.trim());
	if (bodyReviews.length > 0) {
		parts.push("### Review Feedback");
		for (const r of bodyReviews) {
			parts.push(`**${r.user.login}** (${r.state}) on ${r.submittedAt}:`);
			parts.push(r.body);
			parts.push("");
		}
	}

	// --- Review comment threads ---
	if (reviewThreads.length > 0) {
		parts.push(`### Code Review Comments (${reviewThreads.length} thread${reviewThreads.length === 1 ? "" : "s"}, ${totalCount - issueComments.length - bodyReviews.length} comment${(totalCount - issueComments.length - bodyReviews.length) === 1 ? "" : "s"})`);
		parts.push("");

		for (const thread of reviewThreads) {
			const loc = thread.line
				? `${thread.file}${thread.startLine && thread.startLine !== thread.line ? `:${thread.startLine}-${thread.line}` : `:${thread.line}`}`
				: thread.file;
			parts.push(`#### ${loc}${thread.subjectType === "file" ? " (file-level)" : ""}`);
			if (thread.diffHunk) {
				parts.push("```diff");
				parts.push(thread.diffHunk);
				parts.push("```");
			}
			for (const c of thread.comments) {
				parts.push(`> **${c.user.login}** (${c.createdAt}):`);
				parts.push(`> ${c.body.replace(/\n/g, "\n> ")}`);
				parts.push("");
			}
			parts.push("---");
			parts.push("");
		}
	}

	// --- Issue-style (PR-level) comments ---
	if (issueComments.length > 0) {
		parts.push(`### PR-Level Comments (${issueComments.length})`);
		parts.push("");
		for (const c of issueComments) {
			parts.push(`**${c.user.login}** (${c.createdAt}):`);
			parts.push(c.body);
			parts.push("");
		}
	}

	return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// ---- Custom tool: get_pr_comments ----
	pi.registerTool({
		name: "get_pr_comments",
		label: "Get PR Comments",
		description:
			"Find the PR for the current branch and fetch all unresolved comments "
			+ "(code review comments, review feedback, and PR-level comments). "
			+ "Use this to discover what needs to be addressed. After reading comments, "
			+ "prepare code fixes but DO NOT commit or push — let the user handle commits.",
		promptGuidelines: [
			"Use get_pr_comments to discover unresolved PR review comments, then prepare fixes.",
			"After preparing fixes with get_pr_comments, DO NOT commit or push. Let the user commit and push themselves.",
		],
		parameters: Type.Object({
			branch: Type.Optional(Type.String({
				description: "Branch name to look up (default: current branch).",
			})),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const cwd = ctx.cwd;

			// 1. Check gh auth
			const authenticated = await isGhAuthenticated(cwd);
			if (!authenticated) {
				return {
					content: [{
						type: "text",
						text: "Error: `gh` is not authenticated. Run `gh auth login` first.",
					}],
					details: { error: "not_authenticated" },
				};
			}

			// 2. Get branch
			let branch = params.branch;
			if (!branch) {
				try {
					branch = await getCurrentBranch(cwd);
				} catch {
					return {
						content: [{ type: "text", text: "Error: Not in a git repository or no current branch." }],
						details: { error: "no_branch" },
					};
				}
			}
			if (!branch) {
				return {
					content: [{ type: "text", text: "Error: Could not determine current branch (detached HEAD?)." }],
					details: { error: "detached_head" },
				};
			}

			onUpdate?.({ content: [{ type: "text", text: `Looking up PR for branch "${branch}"…` }] });

			// 3. Find open PR for this branch
			let prList: unknown;
			try {
				const out = await run("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "id,number,title,url,body,headRefName,isDraft,author"], cwd);
				prList = JSON.parse(out);
			} catch {
				return {
					content: [{ type: "text", text: `Error: Failed to list PRs. Is \`gh\` installed and configured?` }],
					details: { error: "gh_error" },
				};
			}

			const prs = (prList as Record<string, unknown>[]) || [];
			if (prs.length === 0) {
				return {
					content: [{
						type: "text",
						text: `No open PR found for branch "${branch}". Create one with \`gh pr create\` or specify an existing branch with the \`branch\` parameter.`,
					}],
					details: { error: "no_pr", branch },
				};
			}

			const pr = prs[0] as Record<string, unknown>;
			const prNumber = pr.number as number;
			const prUrl = (pr.url as string) || "";
			const prTitle = (pr.title as string) || "";
			const prBody = (pr.body as string | null) ?? null;
			const prAuthor = ((pr.author as Record<string, unknown>)?.login as string) || "unknown";

			// Extract repo from PR URL (format: https://github.com/owner/repo/pull/N)
			const urlMatch = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
			const repo = urlMatch ? urlMatch[1] : "";

			onUpdate?.({ content: [{ type: "text", text: `Found PR #${prNumber}: ${prTitle}\nFetching comments…` }] });

			// 4. Fetch all comment types in parallel
			const [rawReviewComments, issueComments, reviews] = await Promise.all([
				fetchReviewComments(prNumber, repo, cwd),
				fetchIssueComments(prNumber, repo, cwd),
				fetchReviews(prNumber, repo, cwd),
			]);

			// Group review comments into threads
			const reviewThreads = groupReviewCommentsByThread(rawReviewComments);

			// 5. Build report
			const report = formatCommentsReport(prUrl, prTitle, prBody, prAuthor, reviewThreads, issueComments, reviews);

			return {
				content: [{ type: "text", text: report }],
				details: {
					prNumber,
					prUrl,
					prTitle,
					prAuthor,
					branch,
					reviewThreadCount: reviewThreads.length,
					reviewCommentCount: rawReviewComments.length,
					issueCommentCount: issueComments.length,
					reviewCount: reviews.length,
				},
			};
		},
	});

	// ---- Command: /pr-comments ----
	pi.registerCommand("pr-comments", {
		description: "Fetch unresolved comments from the PR for the current branch",
		handler: async (_args, ctx) => {
			// Trigger the tool via a follow-up message so the agent can act on it
			pi.sendUserMessage(
				"Please check for PR comments on this branch using get_pr_comments. "
				+ "Read each comment, prepare the necessary fixes, and show me what you would change. "
				+ "Do NOT commit or push — I will handle that myself.",
				{ deliverAs: "followUp" },
			);
			ctx.ui.notify("Fetching PR comments…", "info");
		},
	});
}
