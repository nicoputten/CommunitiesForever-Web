import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { runDungeon } from "@/core/runs";
import { dungeonHref, dungeonPageId } from "@/core/views/dungeon";

interface Props {
  params: Promise<{ id: string }>;
}

async function asked({ params }: Props) {
  return dungeonPageId(decodeURIComponent((await params).id));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const id = await asked(props);
  return { title: (id === undefined ? undefined : runDungeon(id.id)?.name) ?? "Dungeon not found" };
}

/**
 * Checks the dungeon above the page's loading state (page, loading and error sit in the (detail) group under this
 * layout), so a raid or an unknown id answers 404 instead of a streamed 200, and `/dungeons/sm` redirects to its first
 * wing (WEB-42).
 */
export default async function DungeonLayout(props: Props & { children: ReactNode }) {
  const id = await asked(props);
  if (id === undefined) notFound();
  if (id.redirect) redirect(dungeonHref(id.id));
  return props.children;
}
