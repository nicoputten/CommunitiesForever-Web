"use client";

import { useState, type ReactNode } from "react";
import { Banner } from "@/components/ui/Banner";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { DataAgeBadge } from "@/components/ui/DataAgeBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FactionTag } from "@/components/ui/FactionTag";
import { FilterChip } from "@/components/ui/FilterChip";
import { PageTitle } from "@/components/ui/PageTitle";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { CLASSES, type ClassFile } from "@/core/gamedata/classes";
import styles from "./gallery.module.css";

// Sample data: the invented friends of the design prompt, never real people.
const H = 3600;
const D = 24 * H;
const SAMPLE_NAMES: Record<ClassFile, string> = {
  WARRIOR: "Grom Ashfeller",
  PALADIN: "Kel Dawnhammer",
  HUNTER: "Ruk Bloodhoof",
  ROGUE: "Bob Example",
  PRIEST: "Lia Thornwhisper",
  SHAMAN: "Tok Ironhide",
  MAGE: "Mira Sunstrider",
  WARLOCK: "Ves Doombringer",
  DRUID: "Sela Moonbrook",
};
const LEVELS = [24, 18, 27, 41, 37, 33, 60, 39, 12];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      {note !== undefined && <p className={styles.note}>{note}</p>}
      {children}
    </section>
  );
}

function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.example}>
      <div className={styles.row}>{children}</div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export function ComponentGallery({ now, seaPreview }: { now: number; seaPreview: ReactNode }) {
  const [continent, setContinent] = useState<"azeroth" | "kalimdor" | "eastern">("azeroth");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [chips, setChips] = useState<Record<string, boolean>>({ All: true, Bob: false, Mira: false });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      <PageTitle sub="Every shared component in every state. Reference: design/boards/design-system.">
        Components
      </PageTitle>

      <Section title="Type" note="DESIGN.md §3 type scale. Inter carries all data, with tabular numbers.">
        <div className={styles.type}>
          <span className={styles.displayXl}>Session report</span>
          <span className={styles.display}>Roster</span>
          <span className={styles.title}>Roll call</span>
          <span className={styles.sectionType}>Skill gains</span>
          <span className={styles.name}>Ves Doombringer</span>
          <span className={styles.body}>Level 39 Undead Warlock · Destruction · 1,234,567</span>
          <span className={styles.meta}>Stranglethorn Vale · Nico · 2 h ago</span>
          <span className={styles.overline}>Last 24 hours</span>
        </div>
      </Section>

      <Section title="Class disc" note="Initials on the class fill, level badge; glow when live; sm without badge.">
        <Example label="All classes, level badge">
          {(Object.keys(CLASSES) as ClassFile[]).map((c, i) => (
            <ClassDisc key={c} name={SAMPLE_NAMES[c]} classFile={c} level={LEVELS[i]} />
          ))}
        </Example>
        <Example label="Live (glow) · small · unknown class · stub without name">
          <ClassDisc name="Ves Doombringer" classFile="WARLOCK" level={39} live />
          <ClassDisc name="Lia Thornwhisper" classFile="PRIEST" level={37} live />
          <ClassDisc name="Tok Ironhide" classFile="SHAMAN" size="sm" />
          <ClassDisc name="Bob Example" classFile="ROGUE" size="sm" />
          <ClassDisc name="Odd One" classFile="DEATHKNIGHT" level={55} />
          <ClassDisc />
        </Example>
      </Section>

      <Section title="Data age badge" note="One scale (DESIGN.md §4): fresh green when live, amber at 7 days.">
        <Example label="Live · today · days with via · week+ · no addon · no data">
          <DataAgeBadge hasAddon dataAt={now - 60} dataAge="live" old={false} now={now} />
          <DataAgeBadge hasAddon dataAt={now - 9 * H} dataAge="today" old={false} now={now} />
          <DataAgeBadge
            hasAddon
            dataAt={now - 2 * D}
            dataAge="days"
            old={false}
            via={{ key: "Bob#2002", name: "Bob" }}
            now={now}
          />
          <DataAgeBadge
            hasAddon
            dataAt={now - 9 * D}
            dataAge="week"
            old
            daysOld={9}
            via={{ key: "Mira#1188", name: "Mira" }}
            now={now}
          />
          <DataAgeBadge hasAddon={false} dataAge="unknown" old={false} now={now} />
          <DataAgeBadge hasAddon dataAge="unknown" old={false} now={now} />
        </Example>
      </Section>

      <Section title="Faction tag">
        <Example label="Horde · Alliance">
          <FactionTag faction="Horde" />
          <FactionTag faction="Alliance" />
        </Example>
      </Section>

      <Section title="Filter chip" note="Toggles carry aria-pressed; menu chips aria-haspopup and aria-expanded.">
        <Example label="Toggles (click them)">
          {Object.entries(chips).map(([name, pressed]) => (
            <FilterChip key={name} pressed={pressed} onClick={() => setChips({ ...chips, [name]: !pressed })}>
              {name}
            </FilterChip>
          ))}
        </Example>
        <Example label="Menu chip · menu chip with a value · disabled">
          <FilterChip menu expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            Class
          </FilterChip>
          <FilterChip menu active>
            Last played
          </FilterChip>
          <FilterChip pressed={false} disabled>
            Sanne
          </FilterChip>
        </Example>
      </Section>

      <Section title="Segmented" note="One of n, aria-pressed: continent switch, cards or table.">
        <Example label="Continent">
          <Segmented
            label="Continent"
            value={continent}
            onChange={setContinent}
            options={[
              { value: "azeroth", label: "Azeroth" },
              { value: "kalimdor", label: "Kalimdor" },
              { value: "eastern", label: "Eastern Kingdoms" },
            ]}
          />
        </Example>
        <Example label="View">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: "Cards" },
              { value: "table", label: "Table" },
            ]}
          />
        </Example>
      </Section>

      <Section title="Banner" note="Under the top bar when the last upload is 7 days old or more.">
        <Banner>
          Last upload was <b>9 days ago</b>. Positions and levels may be behind.
        </Banner>
        <Banner detail="A quieter second line.">
          Last upload was <b>12 days ago</b>. Positions and levels may be behind.
        </Banner>
      </Section>

      <Section title="Empty state" note="Centre card for a screen without data.">
        <div className={styles.empties}>
          <EmptyState
            title="The map is still empty"
            action={{ href: "/upload", label: "Upload the first file" }}
            note="With an action and a note."
          >
            Upload the addon&apos;s file after your next play session. Everyone&apos;s characters appear here, on the
            roster and in professions.
          </EmptyState>
          <EmptyState title="No addon yet">Without an action: text only.</EmptyState>
        </div>
      </Section>

      <Section title="Skeleton" note="Keeps the layout still while loading; the region sets aria-busy.">
        <div className={styles.skeletonPanel} role="group" aria-busy="true" aria-label="Loading example">
          <div className={styles.skeletonHead}>
            <Skeleton shape="circle" width="var(--s-8)" height="var(--s-8)" />
            <Skeleton width="var(--size-menu)" />
            <span className={styles.grow} />
            <Skeleton shape="pill" />
          </div>
          {["60%", "50%", "65%"].map((w) => (
            <div key={w} className={styles.skeletonRow}>
              <Skeleton shape="circle" />
              <div className={styles.skeletonLines}>
                <Skeleton width={w} />
                <Skeleton width="80%" height="var(--s-2-5)" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Atmosphere"
        note="The map's sea (SeaLayers): glint, two wave groups, Maelstrom, surf, foam. Fog and shafts: the map page; fog, embers and the drifting map: sign-in. The Motion switch in the account menu stops all of it."
      >
        {seaPreview}
      </Section>

      <Section
        title="Shell"
        note="TopBar, UserMenu and the phone TabBar are the ones around this page: open the account menu, resize to 375 px."
      >
        <p className={styles.meta}>
          Signed out, the user menu and Upload are gone; guests without &quot;may upload&quot; see no Upload.
        </p>
      </Section>
    </div>
  );
}
