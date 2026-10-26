import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { recordCharacters } from "@/core/views";
import { Placeholder } from "../../placeholder";

interface Props {
  params: Promise<{ guid: string }>;
}

function find(guid: string) {
  const data = getDataset();
  return data === undefined ? undefined : recordCharacters(data, nowSeconds()).find((c) => c.guid === guid);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const character = find(decodeURIComponent((await params).guid));
  return { title: character?.name ?? "Character" };
}

// Placeholder until the character page (WEB-23): the roster rows link here.
export default async function CharacterPage({ params }: Props) {
  const character = find(decodeURIComponent((await params).guid));
  if (character === undefined) notFound();
  return <Placeholder title={character.name ?? "Character"} story="WEB-23" />;
}
