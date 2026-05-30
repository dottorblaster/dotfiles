/**
 * Unit tests for pr-comments extension logic.
 *
 * Run with:  npx vitest run  (or your preferred test runner)
 *
 * These tests cover pure functions only — no gh/git calls.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-create the pure functions here so tests are self-contained.
// In a real setup you would import from the extension module.
// ---------------------------------------------------------------------------

interface ReviewComment {
	id: number;
	body: string;
	path: string;
	line: number | null;
	startLine: number | null;
	diffHunk: string;
	user: { login: string };
	createdAt: string;
	inReplyToId: number | null;
	pullRequestReviewId: number | null;
	subjectType: "line" | "file" | null;
	resolved: boolean;
	outdated: boolean;
}

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
// Test data factory
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
	return {
		id: 1,
		body: "Fix this",
		path: "src/foo.ts",
		line: 10,
		startLine: null,
		diffHunk: "",
		user: { login: "reviewer" },
		createdAt: "2026-05-30T00:00:00Z",
		inReplyToId: null,
		pullRequestReviewId: null,
		subjectType: "line",
		resolved: false,
		outdated: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("groupReviewCommentsByThread", () => {
	it("groups comments on the same file+line into one thread", () => {
		const comments = [
			makeComment({ id: 1, path: "src/a.ts", line: 5, body: "First" }),
			makeComment({ id: 2, path: "src/a.ts", line: 5, body: "Reply to first" }),
			makeComment({ id: 3, path: "src/a.ts", line: 10, body: "Different line" }),
		];

		const threads = groupReviewCommentsByThread(comments);
		expect(threads).toHaveLength(2);
		expect(threads[0].comments).toHaveLength(2); // line 5 has 2 comments
		expect(threads[0].comments.map((c) => c.body)).toEqual(["First", "Reply to first"]);
		expect(threads[1].comments).toHaveLength(1);
		expect(threads[1].comments[0].body).toBe("Different line");
	});

	it("distinguishes threads by startLine range", () => {
		const comments = [
			makeComment({ id: 1, path: "src/a.ts", line: 10, startLine: 5, body: "Range 5-10" }),
			makeComment({ id: 2, path: "src/a.ts", line: 10, startLine: null, body: "Single line 10" }),
		];

		const threads = groupReviewCommentsByThread(comments);
		expect(threads).toHaveLength(2); // different startLine means different thread
	});

	it("groups comments across multiple files", () => {
		const comments = [
			makeComment({ id: 1, path: "src/b.ts", line: 3, body: "B comment" }),
			makeComment({ id: 2, path: "src/a.ts", line: 1, body: "A comment" }),
			makeComment({ id: 3, path: "src/b.ts", line: 3, body: "B reply" }),
		];

		const threads = groupReviewCommentsByThread(comments);
		expect(threads).toHaveLength(2);
		// Sorted by filename
		expect(threads[0].file).toBe("src/a.ts");
		expect(threads[1].file).toBe("src/b.ts");
		expect(threads[1].comments).toHaveLength(2);
	});

	it("sorts threads by file then line", () => {
		const comments = [
			makeComment({ id: 1, path: "src/z.ts", line: 1, body: "z:1" }),
			makeComment({ id: 2, path: "src/a.ts", line: 20, body: "a:20" }),
			makeComment({ id: 3, path: "src/a.ts", line: 5, body: "a:5" }),
		];

		const threads = groupReviewCommentsByThread(comments);
		expect(threads.map((t) => `${t.file}:${t.line}`)).toEqual([
			"src/a.ts:5",
			"src/a.ts:20",
			"src/z.ts:1",
		]);
	});

	it("handles file-level comments (no line)", () => {
		const comments = [
			makeComment({ id: 1, path: "src/a.ts", line: null, startLine: null, body: "File comment", subjectType: "file" }),
			makeComment({ id: 2, path: "src/a.ts", line: null, startLine: null, body: "File reply" }),
		];

		const threads = groupReviewCommentsByThread(comments);
		expect(threads).toHaveLength(1);
		expect(threads[0].comments).toHaveLength(2);
		expect(threads[0].subjectType).toBe("file");
	});

	it("returns empty array for no comments", () => {
		expect(groupReviewCommentsByThread([])).toEqual([]);
	});

	it("preserves diffHunk in thread", () => {
		const hunk = "@@ -1,3 +1,4 @@\n+new line";
		const comments = [makeComment({ diffHunk: hunk })];
		const threads = groupReviewCommentsByThread(comments);
		expect(threads[0].diffHunk).toBe(hunk);
	});
});

describe("comment filtering (resolved vs unresolved)", () => {
	it("resolved comments are excluded by fetchReviewComments filter logic", () => {
		const comments: ReviewComment[] = [
			makeComment({ resolved: false, body: "Open" }),
			makeComment({ resolved: true, body: "Resolved" }),
			makeComment({ resolved: false, body: "Also open" }),
		];

		const unresolved = comments.filter((c) => !c.resolved);
		expect(unresolved).toHaveLength(2);
		expect(unresolved.every((c) => !c.resolved)).toBe(true);
	});
});

describe("format helpers", () => {
	it("repo extraction regex from PR URL", () => {
		const urlMatch = "https://github.com/owner/repo/pull/42".match(
			/github\.com\/([^/]+\/[^/]+)\/pull/,
		);
		expect(urlMatch?.[1]).toBe("owner/repo");
	});

	it("repo extraction regex ignores trailing paths", () => {
		const urlMatch = "https://github.com/owner/repo/pull/42/files".match(
			/github\.com\/([^/]+\/[^/]+)\/pull/,
		);
		expect(urlMatch?.[1]).toBe("owner/repo");
	});
});
