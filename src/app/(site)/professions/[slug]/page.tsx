import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { professionInfo } from "@/core/gamedata";
import { professions, recordCharacters } from "@/core/views";
import { professionRecipes, recipeSkillLine } from "@/core/views/recipes";
import { CrafterBars } from "@/components/professions/ProfessionCard";
import { StatusBadge } from "@/components/professions/StatusBadge";
import { ProfessionRecipes } from "@/components/recipes/ProfessionRecipes";
import { ItemsProvider } from "@/components/recipes/itemsContext";
import { getDb } from "@/server/db";
import { onlineGuids, recipeRows, tooltipItems } from "@/server/recipeViews";
import { ProfessionsEmpty } from "../empty";
import styles from "./profession.module.css";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const line = recipeSkillLine((await params).slug);
  if (line === undefined) return {};
  return { title: professionInfo(line)?.name ?? "Professions" };
}

/** Every recipe of one profession, who knows it and where it's learned (WEB-92, handoff C4, board recipes-page). */
export default async function ProfessionPage({ params }: Props) {
  const line = recipeSkillLine((await params).slug);
  if (line === undefined) notFound();
  const data = getDataset();
  const now = nowSeconds();
  if (data === undefined || recordCharacters(data, now).length === 0) return <ProfessionsEmpty />;

  const db = getDb();
  const characters = recordCharacters(data, now);
  const rows = recipeRows(db, line, true);
  const view = professionRecipes({ ...rows, skillLine: line, characters, online: onlineGuids(data, now), now });
  const summary = professions(data, now).professions.find((p) => p.skillLine === String(line));
  const itemIds = [...rows.items.keys()];
  const items = tooltipItems(db, itemIds);

  const title = (
    <>
      <h1 className={styles.title}>{view.name}</h1>
      <StatusBadge status={view.status} />
    </>
  );
  const count = (
    <span className={styles.count}>
      {view.known} of {view.total} {view.total === 1 ? "recipe" : "recipes"} known
    </span>
  );
  const crafters =
    summary !== undefined && summary.entries.length > 0 ? (
      <div className={styles.crafters}>
        <CrafterBars entries={summary.entries} />
      </div>
    ) : undefined;

  return (
    <div className={styles.page}>
      <Link href="/professions" className={styles.back}>
        ← Professions
      </Link>
      <NuqsAdapter>
        <ItemsProvider items={items}>
          <ProfessionRecipes view={view} title={title} count={count} crafters={crafters} />
        </ItemsProvider>
      </NuqsAdapter>
    </div>
  );
}
