/**
 * Ask Tool - Unified single/multi-question tool
 * - Always multi-select (Space toggle, Enter confirm)
 * - "Type something" option for custom input, works alongside checkbox selections
 * - Beautified: rounded dialog frame, progress dots, nicer glyphs (▸ ◉ ○), Chinese hints
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	Editor,
	type EditorTheme,
	type Focusable,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

interface AskOption {
	value: string;
	label: string;
	description?: string;
}

interface AskQuestion {
	id: string;
	label: string;
	prompt: string;
	options: AskOption[];
}

interface Answer {
	id: string;
	value: string;
	label: string;
	multiValues: { value: string; label: string }[];
	customText?: string;
}

interface AskResult {
	questions: AskQuestion[];
	answers: Answer[];
	cancelled: boolean;
	error?: string;
}

const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option (required)" }),
	value: Type.Optional(Type.String({ description: "Optional machine-readable value. Defaults to label when omitted." })),
	description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
});

const QuestionSchema = Type.Object({
	id: Type.Optional(Type.String({ description: "Optional unique identifier. Defaults to q1, q2, etc. when omitted." })),
	label: Type.Optional(Type.String({ description: "Optional short label for the tab bar, e.g. 'Scope' or 'Priority'" })),
	prompt: Type.String({ description: "Question text shown to the user (required)" }),
	options: Type.Array(OptionSchema, {
		description: "Selectable options. Each option requires label; value and description are optional.",
	}),
});

const AskParams = Type.Object({
	questions: Type.Array(QuestionSchema, {
		description: "Questions to ask. Each question requires prompt and options; id and label are optional.",
	}),
});

export default function ask(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask",
		label: "Ask",
		// Deferred: not declared until `tool_search` loads it, so a session that
		// never asks a question pays nothing for it. The description is the BM25
		// document the search ranks, so it carries the words a query would use.
		exposure: "deferred",
		description:
			"Ask the user one or more questions with selectable options and optional freeform input. Use when a decision, preference, or missing detail needs the user's answer instead of a guess. " +
			"Keywords: ask, question, clarify, confirm, choose, select, pick, options, prompt, user input, decision.",

		parameters: AskParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text", text: "Error: UI not available (running in non-interactive mode)" }],
					details: { questions: [], answers: [], cancelled: true, error: "UI not available" } as AskResult,
				};
			}
			if (params.questions.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No questions provided" }],
					details: { questions: [], answers: [], cancelled: true, error: "No questions provided" } as AskResult,
				};
			}

			const questions: AskQuestion[] = params.questions.map((q, i) => ({
				...q,
				id: q.id?.trim() || `q${i + 1}`,
				label: q.label?.trim() || `Q${i + 1}`,
				options: q.options.map(option => ({
					...option,
					value: option.value?.trim() || option.label,
				})),
			}));
			const seenIds = new Set<string>();
			for (const q of questions) {
				if (seenIds.has(q.id)) {
					return {
						content: [{ type: "text", text: `Error: Duplicate question id: ${q.id}` }],
						details: { questions: [], answers: [], cancelled: true, error: `Duplicate question id: ${q.id}` } as AskResult,
					};
				}
				seenIds.add(q.id);
			}

			const isMultiPage = questions.length > 1;
			const totalPages = questions.length + 1;

			const result = await ctx.ui.custom<AskResult>((tui, theme, _kb, done) => {
				let page = 0;
				let cursor = 0;
				let cachedWidth: number | undefined;
				let cachedLines: string[] | undefined;
				const selected = new Map<string, Set<number>>();
				const customTexts = new Map<string, string>();
				const answers = new Map<string, Answer>();
				let customInputActive = false;

				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg("accent", s),
					selectList: {
						selectedPrefix: (t) => theme.fg("accent", t),
						selectedText: (t) => theme.fg("accent", t),
						description: (t) => theme.fg("muted", t),
						scrollInfo: (t) => theme.fg("dim", t),
						noMatch: (t) => theme.fg("warning", t),
					},
				};
				const editor = new Editor(tui, editorTheme);
				editor.onSubmit = (value) => {
					const qid = questions[page]?.id;
					if (!qid) return;
					const trimmed = value.trim();
					if (trimmed) {
						customTexts.set(qid, trimmed);
					} else {
						customTexts.delete(qid);
					}
					customInputActive = false;
					editor.setText("");
					saveAnswer(questions[page]);
					refresh();
				};

				function refresh() {
					cachedWidth = undefined;
					cachedLines = undefined;
					tui.requestRender();
				}

				function totalLines(q: AskQuestion): number {
					return q.options.length + 1; // options + "Type something"
				}

				function isCustomSlot(q: AskQuestion, idx: number): boolean {
					return idx === q.options.length;
				}

				function buildAnswer(q: AskQuestion): Answer | null {
					const indices = selected.get(q.id);
					const custom = customTexts.get(q.id);
					const hasOptions = indices && indices.size > 0;
					const hasCustom = custom !== undefined && custom.length > 0;

					if (!hasOptions && !hasCustom) return null;

					const items = hasOptions
						? Array.from(indices!).sort((a, b) => a - b).map(i => ({
							value: q.options[i]?.value ?? `__${i}__`,
							label: q.options[i]?.label ?? `Option ${i + 1}`,
						}))
						: [];

					const allValues = hasOptions ? items.map(v => v.value) : [];
					const allLabels = hasOptions ? items.map(v => v.label) : [];
					if (hasCustom) {
						allValues.push(custom!);
						allLabels.push(`✎ ${custom!}`);
					}

					return {
						id: q.id,
						value: allValues.join(", "),
						label: allLabels.join(", "),
						multiValues: items,
						customText: hasCustom ? custom : undefined,
					};
				}

				function saveAnswer(q: AskQuestion) {
					const ans = buildAnswer(q);
					if (ans) answers.set(q.id, ans);
					else answers.delete(q.id);
				}

				function allDone() {
					return questions.every(q => buildAnswer(q) !== null);
				}

				function orderedAnswers(): Answer[] {
					return questions
						.map(q => answers.get(q.id))
						.filter((answer): answer is Answer => answer !== undefined);
				}

				function advance() {
					if (!isMultiPage) { done({ questions, answers: orderedAnswers(), cancelled: false }); return; }
					if (page < questions.length - 1) { page++; cursor = 0; refresh(); }
					else { page = questions.length; refresh(); }
				}

				function handleInput(data: string) {
					// If custom input editor is active, route to editor
					if (customInputActive) {
						if (matchesKey(data, Key.escape)) {
							customInputActive = false;
							editor.setText("");
							refresh();
							return;
						}
						editor.handleInput(data);
						refresh();
						return;
					}

					const q = questions[page];
					const total = q ? totalLines(q) : 1;

					// Up
					if (matchesKey(data, Key.up)) { cursor = Math.max(0, cursor - 1); refresh(); return; }
					// Down
					if (matchesKey(data, Key.down)) { cursor = Math.min(total - 1, cursor + 1); refresh(); return; }

					// Page nav
					if (isMultiPage) {
						if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
							page = (page + 1) % totalPages; cursor = 0; customInputActive = false; refresh(); return;
						}
						if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
							page = (page - 1 + totalPages) % totalPages; cursor = 0; customInputActive = false; refresh(); return;
						}
					}

					// Submit page
					if (page === questions.length) {
						if (matchesKey(data, Key.enter) && allDone()) {
							done({ questions, answers: orderedAnswers(), cancelled: false });
						} else if (matchesKey(data, Key.escape)) {
							done({ questions, answers: [], cancelled: true });
						}
						return;
					}

					// Space toggle (on question page)
					if (matchesKey(data, Key.space) && q) {
						if (isCustomSlot(q, cursor)) {
							// Toggle "Type something" -> open editor
							customInputActive = true;
							editor.setText(customTexts.get(q.id) ?? "");
							refresh();
							return;
						}
						// Toggle regular option
						if (!selected.has(q.id)) selected.set(q.id, new Set());
						const s = selected.get(q.id)!;
						if (s.has(cursor)) { s.delete(cursor); saveAnswer(q); }
						else { s.add(cursor); saveAnswer(q); }
						refresh();
						return;
					}

					// Enter confirm
					if (matchesKey(data, Key.enter) && q && answers.has(q.id)) { advance(); return; }

					// Esc cancel
					if (matchesKey(data, Key.escape)) { done({ questions, answers: [], cancelled: true }); }
				}

				function render(width: number): string[] {
					if (cachedLines && cachedWidth === width) return cachedLines;
					const lines: string[] = [];
					const safeWidth = Math.max(1, width);
					const add = (s: string) => lines.push(...wrapTextWithAnsi(s, safeWidth));
					const addClipped = (s: string) => lines.push(truncateToWidth(s, safeWidth));
					const addHanging = (prefix: string, body: string) => {
						const prefixWidth = visibleWidth(prefix);
						const bodyWidth = safeWidth - prefixWidth;
						if (bodyWidth < 1) {
							add(prefix);
							add(body);
							return;
						}
						const wrapped = wrapTextWithAnsi(body, bodyWidth);
						if (wrapped.length === 0) {
							lines.push(prefix);
							return;
						}
						lines.push(prefix + wrapped[0]);
						const continuation = " ".repeat(prefixWidth);
						for (const line of wrapped.slice(1)) lines.push(continuation + line);
					};
					const q = questions[page];

					// ---------- top border ----------
					const border = (s: string) => theme.fg("borderMuted", s);
					addClipped(border("╭") + border("─".repeat(Math.max(0, safeWidth - 2))) + border("╮"));

					// ---------- header with progress dots ----------
					const answeredCount = questions.filter(qq => answers.has(qq.id)).length;
					const dots = questions
						.map(qq => answers.has(qq.id) ? theme.fg("success", "●") : theme.fg("dim", "○"))
						.join(" ");
					const headerParts: string[] = [
						" ",
						theme.fg("borderAccent", "●"),
						" ",
						theme.fg("accent", theme.bold("Ask")),
					];
					if (isMultiPage) {
						const pos = page < questions.length ? `${page + 1}/${questions.length}` : "提交";
						headerParts.push(theme.fg("muted", `  ·  ${pos}`));
					} else {
						headerParts.push(theme.fg("muted", "  ·  1/1"));
					}
					headerParts.push("   ");
					headerParts.push(dots);
					if (answeredCount > 0) {
						headerParts.push(theme.fg("muted", `  ·  已答 ${answeredCount}/${questions.length}`));
					}
					addClipped(headerParts.join(""));
					lines.push("");

					// ---------- tab bar (multi-page only) ----------
					if (isMultiPage) {
						const tabs: string[] = ["← "];
						for (let i = 0; i < questions.length; i++) {
							const ans = answers.get(questions[i].id);
							const doneQ = ans !== undefined;
							const box = doneQ ? "■" : "□";
							const active = i === page;
							const text = ` ${box} ${questions[i].label} `;
							const styled = active ? theme.bg("selectedBg", theme.fg("text", text)) : theme.fg(doneQ ? "success" : "muted", text);
							tabs.push(`${styled} `);
						}
						const canSub = allDone();
						const subText = " ✓ 提交 ";
						tabs.push(page === questions.length ? theme.bg("selectedBg", theme.fg("text", subText)) : theme.fg(canSub ? "success" : "dim", subText));
						tabs.push(" →");
						addClipped(` ${tabs.join("")}`);
						lines.push("");
					}

					// ---------- submit page ----------
					if (page === questions.length) {
						add(` ${theme.fg("success", theme.bold("✓ 确认提交"))}${theme.fg("muted", `  ·  已答 ${answeredCount}/${questions.length}`)}`);
						lines.push("");
						addClipped(border("─".repeat(safeWidth)));
						lines.push("");
						for (const qa of questions) {
							const ans = answers.get(qa.id);
							if (ans) {
								const parts: string[] = ans.multiValues.map(m => m.label);
								if (ans.customText) parts.push(`✎ ${ans.customText}`);
								const items = parts.join(", ");
								const cnt = theme.fg("success", ` [${parts.length}]`);
								addHanging(` ${theme.fg("success", "✓")} ${theme.fg("accent", qa.label + ":")}${cnt} `, theme.fg("text", items));
							} else {
								add(` ${theme.fg("dim", "○")} ${theme.fg("muted", qa.label + ":")} ${theme.fg("warning", "(未回答)")}`);
							}
						}
						lines.push("");
						if (allDone()) add(` ${theme.fg("success", " Enter 提交确认")}`);
						else {
							const missing = questions.filter(qq => !buildAnswer(qq)).map(qq => qq.label).join(", ");
							add(` ${theme.fg("warning", ` 未回答: ${missing}`)}`);
						}
						lines.push("");
						add(` ${theme.fg("dim", `${isMultiPage ? "Tab/←→ 翻页 ·" : ""} Enter 提交 · Esc 取消`)}`);
						addClipped(border("╰") + border("─".repeat(Math.max(0, safeWidth - 2))) + border("╯"));
						cachedWidth = width;
						cachedLines = lines;
						return lines;
					}

					// ---------- question page ----------
					if (q) {
						addHanging(" ", theme.fg("text", theme.bold(q.prompt)));
						lines.push("");

						// Render regular options
						for (let i = 0; i < q.options.length; i++) {
							const opt = q.options[i];
							const sel = i === cursor && !customInputActive;
							const checked = selected.get(q.id)?.has(i) ?? false;
							const ck = checked ? theme.fg("success", "◉") : theme.fg("muted", "○");
							const prefix = sel ? theme.fg("accent", "▸ ") : "  ";
							const label = sel
								? theme.fg("accent", theme.bold(opt.label))
								: theme.fg("text", opt.label);
							addHanging(`${prefix}${ck} `, label);
							if (opt.description) addHanging("   ", theme.fg("muted", opt.description));
						}

						// Render "Type something." line
						{
							const i = q.options.length;
							const sel = i === cursor && !customInputActive;
							const hasCustom = customTexts.has(q.id) && (customTexts.get(q.id)?.trim() ?? "") !== "";
							const ck = hasCustom ? theme.fg("success", "◉") : theme.fg("muted", "○");
							const prefix = sel ? theme.fg("accent", "▸ ") : "  ";
							const rawLabel = hasCustom ? `✎ ${customTexts.get(q.id)!}` : "✎ 输入自定义答案…";
							const label = sel
								? theme.fg("accent", theme.bold(rawLabel))
								: hasCustom
									? theme.fg("accent", rawLabel)
									: theme.fg("muted", rawLabel);
							addHanging(`${prefix}${ck} `, label);
						}

						// Custom input editor
						if (customInputActive) {
							lines.push("");
							add(` ${theme.fg("muted", "你的回答:")}`);
							for (const line of editor.render(Math.max(1, safeWidth - 2))) {
								add(` ${line}`);
							}
							lines.push("");
							add(` ${theme.fg("dim", " Enter 提交 · Esc 取消")}`);
						}

						lines.push("");

						if (!customInputActive) {
							const ans = answers.get(q.id);
							const count = ans ? (ans.multiValues.length + (ans.customText ? 1 : 0)) : 0;
							if (count > 0) add(` ${theme.fg("success", ` 已选 ${count} 项 — Enter 确认`)}`);
							const nav = isMultiPage ? "Tab/←→ 翻页 · " : "";
							add(` ${theme.fg("dim", ` ${nav}↑↓ 选择 · Space 勾选 · Enter 确认 · Esc 取消`)}`);
						}
					}

					addClipped(border("╰") + border("─".repeat(Math.max(0, safeWidth - 2))) + border("╯"));
					cachedWidth = width;
					cachedLines = lines;
					return lines;
				}

				const component: Component & Focusable = {
					get focused() { return editor.focused; },
					set focused(value: boolean) { editor.focused = value; },
					render,
					handleInput,
					invalidate: () => {
						cachedWidth = undefined;
						cachedLines = undefined;
						editor.invalidate();
					},
				};
				return component;
			});

			if (result.cancelled) {
				return { content: [{ type: "text", text: "User cancelled" }], details: result };
			}

			const lines = result.answers.map(a => {
				const ql = questions.find(q => q.id === a.id)?.label || a.id;
				const parts: string[] = a.multiValues.map((mv, i) => `${i + 1}. ${mv.label}`);
				if (a.customText) parts.push(`✎ ${a.customText}`);
				return `${ql}: ${parts.join("; ")}`;
			});

			return { content: [{ type: "text", text: lines.join("\n") }], details: result };
		},

		renderCall(args, theme, _ctx) {
			const qs = (args.questions as AskQuestion[]) || [];
			const text = theme.fg("toolTitle", theme.bold("ask ")) + theme.fg("muted", `${qs.length} 个问题`);
			return new Text(text, 0, 0);
		},

		renderResult(result, _opts, theme, _ctx) {
			const d = result.details as AskResult | undefined;
			if (!d) return new Text("", 0, 0);
			if (d.error) return new Text(theme.fg("error", `✗ ${d.error}`), 0, 0);
			if (d.cancelled) return new Text(theme.fg("warning", "已取消"), 0, 0);
			const lines = d.answers.map(a => {
				const parts: string[] = a.multiValues.map(mv => mv.label);
				if (a.customText) parts.push(`✎ ${a.customText}`);
				return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: [${parts.length}] ${parts.join(", ")}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
