import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { characterPage } from "@/core/views";

interface Props {
  params: Promise<{ guid: string }>;
}

async function find({ params }: Props) {
  const data = getDataset();
  const guid = decodeURIComponent((await params).guid);
  return data === undefined ? undefined : characterPage(data, guid, nowSeconds());
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return { title: (await find(props))?.character.name ?? "Character not found" };
}

/**
 * Checks the character exists above the page's loading state (page, loading and error sit in the (detail) group under
 * this layout), so an unknown GUID answers 404 with
 * character/not-found.tsx instead of a streamed 200.
 */
export default async function CharacterLayout(props: Props & { children: ReactNode }) {
  if ((await find(props)) === undefined) notFound();
  return props.children;
}
