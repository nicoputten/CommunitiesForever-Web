import { Skeleton } from "@/components/ui/Skeleton";
import panel from "@/components/character/Panel.module.css";
import styles from "./character.module.css";

const PANEL_LINES = ["70%", "55%", "80%"];

function SkeletonPanel() {
  return (
    <div className={panel.box}>
      <Skeleton width="40%" />
      {PANEL_LINES.map((w) => (
        <Skeleton key={w} width={w} height="var(--s-2-5)" />
      ))}
    </div>
  );
}

/** While the character renders (loading board style): the hero and panels as skeletons keep the layout still. */
export default function CharacterLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading the character
      </p>
      <div className={styles.loadingHero}>
        <Skeleton shape="circle" width="var(--size-hero-disc)" height="var(--size-hero-disc)" />
        <div className={styles.loadingText}>
          <Skeleton width="60%" height="var(--fs-hero)" />
          <Skeleton width="40%" />
        </div>
      </div>
      <div className={styles.columns}>
        <div className={styles.column}>
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
        <div className={styles.column}>
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
        <div className={styles.aside}>
          <SkeletonPanel />
        </div>
      </div>
    </div>
  );
}
