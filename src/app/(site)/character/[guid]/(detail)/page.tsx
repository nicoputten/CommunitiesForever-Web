import Link from "next/link";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { characterPage, hereToo, miniMap } from "@/core/views";
import { CharacterHero } from "@/components/character/CharacterHero";
import { AtAGlance, OtherCharacters, ProfessionList } from "@/components/character/CharacterPanels";
import { MiniMap } from "@/components/character/MiniMap";
import { QuestLog } from "@/components/character/QuestLog";
import { TalentBars } from "@/components/character/TalentBars";
import styles from "./character.module.css";

interface Props {
  params: Promise<{ guid: string }>;
}

async function load({ params }: Props) {
  const guid = decodeURIComponent((await params).guid);
  const data = getDataset();
  const now = nowSeconds();
  const page = data === undefined ? undefined : characterPage(data, guid, now);
  return { data, page, now, guid };
}

/** Everything about one character (WEB-23, board `character`). */
export default async function CharacterDetail(props: Props) {
  const { data, page, now, guid } = await load(props);
  if (data === undefined || page === undefined) notFound();
  const c = page.character;
  return (
    <div className={styles.page}>
      <Link href="/roster" className={styles.back}>
        ← Roster
      </Link>
      <CharacterHero page={page} now={now} />
      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.glance}>
            <AtAGlance character={c} />
          </div>
          <div className={styles.talents}>
            <TalentBars talents={page.talents} classFile={c.classFile} />
          </div>
        </div>
        <div className={styles.column}>
          <div className={styles.professions}>
            <ProfessionList professions={c.professions} />
          </div>
          <div className={styles.quests}>
            <QuestLog quests={c.quests} recordedAt={c.updatedAt} now={now} />
          </div>
        </div>
        <div className={styles.aside}>
          <div className={styles.seen}>
            <MiniMap character={c} view={miniMap(data, guid, now)} hereToo={hereToo(page.sameZone)} now={now} />
          </div>
          <div className={styles.others}>
            <OtherCharacters page={page} now={now} />
          </div>
        </div>
      </div>
    </div>
  );
}
