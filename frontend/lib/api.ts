/**
 * Typed client for the RoughPage backend. Every call attaches the Supabase
 * access token; the backend verifies it against Supabase's JWKS.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

import { getAccessToken } from "@/lib/supabase/client";
import type { NotebookDocument } from "@/lib/types";

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token ?? ""}`,
      ...init.headers,
    },
  });
  if (!res.ok && res.status !== 204) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res;
}

export interface NotebookSummary {
  id: string;
  title: string;
  subject: string | null;
  style: string;
  source_url: string | null;
  video_id: string | null;
  page_count: number;
  pdf_ready: boolean;
  created_at: string;
}

export async function saveNotebook(document: NotebookDocument) {
  const res = await apiFetch("/notebooks", {
    method: "POST",
    body: JSON.stringify({ document }),
  });
  return (await res.json()) as NotebookSummary;
}

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const res = await apiFetch("/notebooks");
  return (await res.json()) as NotebookSummary[];
}

export async function deleteNotebook(id: string) {
  await apiFetch(`/notebooks/${id}`, { method: "DELETE" });
}

export async function getPdfUrl(id: string): Promise<string> {
  const res = await apiFetch(`/notebooks/${id}/pdf-url`);
  const { url } = (await res.json()) as { url: string };
  return url;
}
