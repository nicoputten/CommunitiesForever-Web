import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/viewer";

/**
 * Admin only (CLAUDE.md rule 6). Checked here, above the page and its loading state (in the (panel) group), so anyone else gets a 404 instead of a
 * streamed 200 (as the character layout does).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if ((await getViewer())?.role !== "admin") notFound();
  return children;
}
