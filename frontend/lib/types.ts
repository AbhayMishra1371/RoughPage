/** Shared types mirroring backend/app/schemas. */

export type NoteStyle = "detailed" | "topper" | "last_minute";

export interface NotebookMetadata {
  title: string;
  subject?: string | null;
  source_url?: string | null;
  video_id?: string | null;
  style: NoteStyle;
  total_pages: number;
  created_at: string;
}

export interface NotebookElement {
  type: string;
  importance?: "high" | "medium" | "low";
  [key: string]: unknown;
}

export interface NotebookPage {
  page_number: number;
  topic: string;
  elements: NotebookElement[];
}

export interface NotebookDocument {
  metadata: NotebookMetadata;
  pages: NotebookPage[];
}
