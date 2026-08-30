/**
 * types.ts
 * ========
 * Hand-written mirror of `backend/app/schemas/notebook.py` (NotebookDocument v1).
 *
 * Hand-written rather than generated from Pydantic's JSON Schema: the contract is
 * explicitly frozen at v1, so a codegen build step would cost more than it saves.
 * If notebook.py ever changes, this file must change with it.
 *
 * No runtime validation here (no zod) — the backend already validates with
 * Pydantic before the document ever reaches us. The only defence the renderer
 * needs is the `UnknownElement` fallback arm, so an unrecognised `type` renders
 * a visible placeholder instead of throwing or silently vanishing.
 */

export type Importance = 'low' | 'medium' | 'high';

export type NoteStyle = 'detailed' | 'topper' | 'last_minute';

/** Present on every element (see the `_BaseElement` note in notebook.py). */
interface ElementBase {
  /**
   * Optional on the TS side even though the backend now always sends it, so the
   * renderer degrades gracefully against documents captured before that fix.
   */
  importance?: Importance;
}

// ── The core six ────────────────────────────────────────────────────────────

export interface HeadingElement extends ElementBase {
  type: 'heading';
  text: string;
  /** 1 = topic title, 2 = subtopic */
  level: 1 | 2;
}

export interface BulletListElement extends ElementBase {
  type: 'bullet_list';
  title?: string | null;
  items: string[];
}

export interface DefinitionElement extends ElementBase {
  type: 'definition';
  term: string;
  meaning: string;
  example?: string | null;
}

export interface ImportantNoteElement extends ElementBase {
  type: 'important_note';
  text: string;
}

export interface StickyFormulaElement extends ElementBase {
  type: 'sticky_formula';
  label: string;
  formula: string;
  is_latex: boolean;
}

export interface SummaryElement extends ElementBase {
  type: 'summary';
  points: string[];
}

// ── The eight added in v2 ───────────────────────────────────────────────────

export interface ParagraphElement extends ElementBase {
  type: 'paragraph';
  text: string;
}

export interface ExampleElement extends ElementBase {
  type: 'example';
  context: string;
  walkthrough: string;
}

export interface CodeBlockElement extends ElementBase {
  type: 'code_block';
  language: string;
  code: string;
}

export interface ComparisonElement extends ElementBase {
  type: 'comparison';
  title: string;
  left_label: string;
  right_label: string;
  /** `[left cell, right cell]` per row — Pydantic's `tuple[str, str]` in JSON. */
  rows: [string, string][];
}

export interface FlowchartElement extends ElementBase {
  type: 'flowchart';
  title?: string | null;
  steps: string[];
}

/**
 * The backend types this as a bare `list[dict]`, so nothing guarantees these
 * keys are present. The component reads both fields defensively.
 */
export interface TimelineEvent {
  label?: string | null;
  description?: string | null;
}

export interface TimelineElement extends ElementBase {
  type: 'timeline';
  title?: string | null;
  events: TimelineEvent[];
}

export interface DiagramElement extends ElementBase {
  type: 'diagram';
  title?: string | null;
  nodes: string[];
  /** `[from, to]` pairs naming nodes. Names not in `nodes` are ignored. */
  edges: [string, string][];
  /** Parallel to `edges` when present. */
  edge_labels?: string[] | null;
}

export interface MindMapElement extends ElementBase {
  type: 'mind_map';
  center: string;
  branches: string[];
  sub_branches?: Record<string, string[]> | null;
}

// ── Still not rendered ──────────────────────────────────────────────────────

/**
 * `screenshot` needs a capability the backend does not have yet: the video is
 * never downloaded, so there is no frame to paste. `timestamp_seconds` exists in
 * the schema and in the system prompt, and nothing acts on it. Until that lands,
 * a screenshot renders as a visible placeholder rather than silently vanishing.
 */
export type UnimplementedElementType = 'screenshot';

export interface UnimplementedElement extends ElementBase {
  type: UnimplementedElementType;
  [key: string]: unknown;
}

/** Anything the schema does not know about at all. */
export interface UnknownElement extends ElementBase {
  type: string;
  [key: string]: unknown;
}

export type ImplementedElement =
  | HeadingElement
  | BulletListElement
  | DefinitionElement
  | ImportantNoteElement
  | StickyFormulaElement
  | SummaryElement
  | ParagraphElement
  | ExampleElement
  | CodeBlockElement
  | ComparisonElement
  | FlowchartElement
  | TimelineElement
  | DiagramElement
  | MindMapElement;

export type NotebookElement =
  | ImplementedElement
  | UnimplementedElement
  | UnknownElement;

// ── Document ────────────────────────────────────────────────────────────────

/**
 * NOTE: a `NotebookPage` is a TOPIC SECTION, not a physical page.
 *
 * The AI is explicitly told it does not decide page breaks; `page_number` is
 * overwritten server-side and `total_pages` ends up as the topic-group count.
 * The renderer reflows everything into real pages and recomputes the count.
 * Treat `page_number` as advisory and `topic` as the meaningful field.
 */
export interface NotebookTopicGroup {
  page_number: number;
  topic: string;
  elements: NotebookElement[];
}

export interface NotebookMetadata {
  title: string;
  subject?: string | null;
  source_url?: string | null;
  video_id?: string | null;
  style: NoteStyle;
  /** Unreliable on input — recomputed after pagination. */
  total_pages: number;
  created_at?: string | null;
}

export interface NotebookDocument {
  metadata: NotebookMetadata;
  pages: NotebookTopicGroup[];
}

// ── Renderer-internal shapes ────────────────────────────────────────────────

/** One element flattened out of its topic group, with a stable identity. */
export interface FlatElement {
  /** Stable key — no `id` exists in the schema, so we derive one. */
  key: string;
  element: NotebookElement;
  /** Index of the originating topic group. */
  groupIndex: number;
  topic: string;
  /** True for the first element of a topic group (used by `breakOnTopic`). */
  startsTopic: boolean;
}

/** A page after reflow lives in `paginate.ts` — see `PhysicalPage` there. */

export const IMPORTANCE_FALLBACK: Importance = 'low';

export function importanceOf(el: NotebookElement): Importance {
  const v = el.importance;
  return v === 'high' || v === 'medium' || v === 'low' ? v : IMPORTANCE_FALLBACK;
}

/**
 * Flattens topic groups into a single ordered stream for pagination.
 * Keys are derived from position, which is stable for a given document.
 */
export function flatten(doc: NotebookDocument): FlatElement[] {
  const out: FlatElement[] = [];
  doc.pages.forEach((group, groupIndex) => {
    group.elements.forEach((element, i) => {
      out.push({
        key: `g${groupIndex}-e${i}-${element.type}`,
        element,
        groupIndex,
        topic: group.topic,
        startsTopic: i === 0,
      });
    });
  });
  return out;
}
