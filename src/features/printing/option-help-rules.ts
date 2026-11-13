import type { MessageKey } from "@/i18n/messages";

/**
 * Rules of the «شرح خيارات الطباعة» catalog: the staff-written explanations the student app shows in a bottom sheet next to
 * each print option. One entry belongs to a topic (paper size, colour, ...) and to one option code (`key`); an empty key is
 * the explanation of the whole topic. Everything here is pure so it can be tested without the screen.
 */

export const OPTION_HELP_PATH = "/api/v1/dashboard/printing/option-help/";
export function optionHelpPath(id: number | string): string {
  return `${OPTION_HELP_PATH}${encodeURIComponent(String(id))}/`;
}

export const FIXED_TOPICS = ["print_size", "print_colour", "print_sides", "binding", "cover", "spiral_wire"] as const;
export type FixedTopic = (typeof FIXED_TOPICS)[number];
export const EXTRA_TOPIC_PREFIX = "extra:";
/** All the sectioned paper options share one group on the screen. */
export const EXTRA_GROUP = "extra";
export type HelpGroupId = FixedTopic | typeof EXTRA_GROUP;

/** Option codes the app knows today, per topic; offered as a pick-list so a typo cannot hide an explanation. */
const KNOWN_KEYS: Readonly<Record<FixedTopic, readonly string[]>> = {
  print_size: ["A4", "A5", "A3"],
  print_colour: ["black_white", "color"],
  print_sides: ["one_sided", "double_sided"],
  binding: ["none", "staple", "spiral", "thermal", "beads", "other"],
  cover: [],
  spiral_wire: [],
};

/** Sections of the paper-options catalog; their slug follows `extra:`. */
export const KNOWN_EXTRA_SECTIONS = [
  "front_cover", "back_cover", "front_transparency_required", "front_transparency_optional",
  "back_transparency_required", "back_transparency_optional", "final_delivery", "finishing", "design_paper",
] as const;

export const TITLE_MAX = 150;
export const BODY_MAX = 4000;
export const BODY_NEAR = 3500;
export const CAPTION_MAX = 255;
export const KEY_MAX = 64;
export const SORT_MAX = 32767;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/u;
const SECTION_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/u;

export function isFixedTopic(value: string): value is FixedTopic {
  return (FIXED_TOPICS as readonly string[]).includes(value);
}
export function isExtraTopic(value: string): boolean {
  return value.startsWith(EXTRA_TOPIC_PREFIX) && SECTION_RE.test(value.slice(EXTRA_TOPIC_PREFIX.length));
}
export function isValidTopic(value: string): boolean {
  return isFixedTopic(value) || isExtraTopic(value);
}

/** The group a topic is drawn in, or null for a topic the screen does not know. */
export function groupOfTopic(topic: string): HelpGroupId | null {
  if (isFixedTopic(topic)) return topic;
  return isExtraTopic(topic) ? EXTRA_GROUP : null;
}

export function groupLabelKey(group: HelpGroupId): MessageKey {
  return `help.topic.${group}` as MessageKey;
}

/** Name of one extra section, or null when it is not one of the known sections (then the slug itself is shown). */
export function extraSectionLabelKey(topic: string): MessageKey | null {
  const slug = topic.slice(EXTRA_TOPIC_PREFIX.length);
  return (KNOWN_EXTRA_SECTIONS as readonly string[]).includes(slug) ? (`help.extra.${slug}` as MessageKey) : null;
}

/** The topics a new entry can be filed under: the fixed ones and the known extra sections. */
export function topicChoices(): string[] {
  return [...FIXED_TOPICS, ...KNOWN_EXTRA_SECTIONS.map((slug) => `${EXTRA_TOPIC_PREFIX}${slug}`)];
}

/** Option codes to suggest for a topic (empty for topics with no option list, such as extras or a whole-topic note). */
export function keyHints(topic: string): readonly string[] {
  return isFixedTopic(topic) ? KNOWN_KEYS[topic] : [];
}

export interface OptionHelpRow {
  id: number;
  topic: string;
  key: string;
  title: string;
  body: string;
  imageUrl: string | null;
  imageCaption: string;
  sortOrder: number;
  isActive: boolean;
}

/** Known option codes of the topic that have no explanation yet, so the editor can point at the gaps. */
export function missingKeys(topic: string, rows: readonly OptionHelpRow[]): string[] {
  const taken = new Set(rows.filter((row) => row.topic === topic).map((row) => row.key));
  return keyHints(topic).filter((key) => !taken.has(key));
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** One server row, or null when it cannot be drawn (no id or topic). */
export function parseOptionHelp(raw: unknown): OptionHelpRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  const topic = text(row.topic);
  if (!Number.isInteger(id) || id <= 0 || !topic) return null;
  const sort = Number(row.sort_order);
  return {
    id,
    topic,
    key: text(row.key),
    title: text(row.title),
    body: text(row.body),
    imageUrl: typeof row.image_url === "string" && row.image_url ? row.image_url : null,
    imageCaption: text(row.image_caption),
    sortOrder: Number.isFinite(sort) ? sort : 0,
    isActive: row.is_active !== false,
  };
}

export interface HelpGroup {
  id: HelpGroupId;
  rows: OptionHelpRow[];
}

function compareRows(a: OptionHelpRow, b: OptionHelpRow): number {
  // Within a topic the whole-topic note leads, then the options by their order, then by code.
  if (a.topic !== b.topic) return a.topic < b.topic ? -1 : 1;
  if ((a.key === "") !== (b.key === "")) return a.key === "" ? -1 : 1;
  return a.sortOrder - b.sortOrder || a.key.localeCompare(b.key) || a.id - b.id;
}

/** Rows in screen order, grouped by topic (fixed topics in their usual order, then the paper-options group). Empty groups are left out. */
export function groupByTopic(rows: readonly OptionHelpRow[]): HelpGroup[] {
  const order: HelpGroupId[] = [...FIXED_TOPICS, EXTRA_GROUP];
  const buckets = new Map<HelpGroupId, OptionHelpRow[]>();
  for (const row of rows) {
    const group = groupOfTopic(row.topic);
    if (!group) continue;
    buckets.set(group, [...(buckets.get(group) ?? []), row]);
  }
  return order.flatMap((id) => {
    const list = buckets.get(id);
    return list?.length ? [{ id, rows: [...list].sort(compareRows) }] : [];
  });
}

export type StatusFilter = "all" | "active" | "inactive";
export function isStatusFilter(value: string): value is StatusFilter {
  return value === "all" || value === "active" || value === "inactive";
}

export interface HelpFilters {
  query: string;
  status: StatusFilter;
  /** A group to show alone, or "all". */
  group: HelpGroupId | "all";
}

export function filterRows(rows: readonly OptionHelpRow[], filters: HelpFilters): OptionHelpRow[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status === "active" && !row.isActive) return false;
    if (filters.status === "inactive" && row.isActive) return false;
    if (filters.group !== "all" && groupOfTopic(row.topic) !== filters.group) return false;
    if (!needle) return true;
    return [row.title, row.body, row.key, row.topic, row.imageCaption].some((part) => part.toLowerCase().includes(needle));
  });
}

export interface HelpForm {
  topic: string;
  key: string;
  title: string;
  body: string;
  imageCaption: string;
  sortOrder: string;
  isActive: boolean;
}

export function emptyForm(topic: string = FIXED_TOPICS[0]): HelpForm {
  return { topic, key: "", title: "", body: "", imageCaption: "", sortOrder: "0", isActive: true };
}

export function formFromRow(row: OptionHelpRow): HelpForm {
  return { topic: row.topic, key: row.key, title: row.title, body: row.body, imageCaption: row.imageCaption, sortOrder: String(row.sortOrder), isActive: row.isActive };
}

export type HelpProblem = "required" | "tooLong" | "format" | "invalid";
export type HelpProblems = Partial<Record<"topic" | "key" | "title" | "body" | "imageCaption" | "sortOrder" | "duplicate", HelpProblem>>;

/** What is wrong with the form, field by field; empty when it can be sent. `others` are the existing rows (to catch a repeated topic + key). */
export function helpProblems(form: HelpForm, others: readonly OptionHelpRow[] = [], editingId: number | null = null): HelpProblems {
  const problems: HelpProblems = {};
  if (!isValidTopic(form.topic)) problems.topic = "invalid";
  const key = form.key.trim();
  if (key.length > KEY_MAX) problems.key = "tooLong";
  else if (key && !KEY_RE.test(key)) problems.key = "format";
  const title = form.title.trim();
  if (!title) problems.title = "required";
  else if (title.length > TITLE_MAX) problems.title = "tooLong";
  const body = form.body.trim();
  if (!body) problems.body = "required";
  else if (body.length > BODY_MAX) problems.body = "tooLong";
  if (form.imageCaption.trim().length > CAPTION_MAX) problems.imageCaption = "tooLong";
  const sort = form.sortOrder.trim();
  if (sort !== "" && !(/^\d{1,5}$/u.test(sort) && Number(sort) <= SORT_MAX)) problems.sortOrder = "invalid";
  if (!problems.topic && !problems.key && others.some((row) => row.id !== editingId && row.topic === form.topic && row.key === key)) problems.duplicate = "invalid";
  return problems;
}

/** Checks a picked image before it is sent: a type the server accepts and a size that is not wasteful. */
export function imageProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > IMAGE_MAX_BYTES) return "size";
  return null;
}

/** The text fields of a save, trimmed; sent as JSON, or as multipart fields next to the image. */
export function helpFields(form: HelpForm): { topic: string; key: string; title: string; body: string; image_caption: string; sort_order: number; is_active: boolean } {
  return {
    topic: form.topic,
    key: form.key.trim(),
    title: form.title.trim(),
    body: form.body.trim(),
    image_caption: form.imageCaption.trim(),
    sort_order: form.sortOrder.trim() === "" ? 0 : Number(form.sortOrder),
    is_active: form.isActive,
  };
}

export type ImageChange = { kind: "keep" } | { kind: "remove" } | { kind: "replace"; file: File };

/** Multipart fields for a save that touches the image (an empty `image` removes it); null when plain JSON is enough. */
export function multipartEntries(form: HelpForm, change: ImageChange): [string, string | File][] | null {
  if (change.kind === "keep") return null;
  const fields = helpFields(form);
  return [
    ["topic", fields.topic], ["key", fields.key], ["title", fields.title], ["body", fields.body],
    ["image_caption", fields.image_caption], ["sort_order", String(fields.sort_order)], ["is_active", fields.is_active ? "true" : "false"],
    ["image", change.kind === "replace" ? change.file : ""],
  ];
}

export interface BodyGuidance {
  length: number;
  remaining: number;
  lines: number;
  level: "ok" | "near" | "over";
}

/** Character count and a warning level while the body is typed. */
export function bodyGuidance(body: string): BodyGuidance {
  const trimmed = body.trim();
  const length = trimmed.length;
  return {
    length,
    remaining: BODY_MAX - length,
    lines: trimmed ? trimmed.split(/\r?\n/u).filter((line) => line.trim()).length : 0,
    level: length > BODY_MAX ? "over" : length >= BODY_NEAR ? "near" : "ok",
  };
}

/** The paragraphs the phone shows: each non-empty line is one paragraph. */
export function previewParagraphs(body: string): string[] {
  return body.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}
