"use client";

import { useEffect, useState } from "react";
import runs from "@/components/runs/Runs.module.css";
import styles from "./Dungeon.module.css";

// The Bosses jump list (WEB-102, board DL04): at the top of the side column, sticky while the page scrolls; the boss
// in view is bold. Left out on a phone, where the bosses follow Who fits in one column.

export function BossJump({ bosses }: { bosses: readonly { n: number; name: string; anchor: string }[] }) {
  const [current, setCurrent] = useState(bosses[0]?.anchor);

  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = bosses.find((b) => seen.get(b.anchor) === true);
        if (first !== undefined) setCurrent(first.anchor);
      },
      { rootMargin: "-90px 0px -40% 0px" },
    );
    for (const b of bosses) {
      const el = document.getElementById(b.anchor);
      if (el !== null) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [bosses]);

  return (
    <nav className={`${runs.box} ${styles.jump}`} aria-labelledby="boss-jump">
      <h2 id="boss-jump" className={runs.boxTitle}>
        Bosses
      </h2>
      <ol className={styles.jumpList}>
        {bosses.map((b) => (
          <li key={b.anchor}>
            <a href={`#${b.anchor}`} aria-current={b.anchor === current ? "location" : undefined}>
              <span className={styles.jumpN}>{b.n}</span>
              {b.name}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
