import { Skeleton } from "@/components/ui/Skeleton";
import styles from "@/components/dungeon/Dungeon.module.css";
import runs from "@/components/runs/Runs.module.css";

const LINES = ["70%", "55%", "80%"];

function SkeletonBox() {
  return (
    <div className={runs.box}>
      <Skeleton width="40%" />
      {LINES.map((w) => (
        <Skeleton key={w} width={w} height="var(--s-2-5)" />
      ))}
    </div>
  );
}

/** While the dungeon page renders: the hero and boxes as skeletons keep the layout still (WEB-42). */
export default function DungeonLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading the dungeon
      </p>
      <Skeleton width="30%" />
      <Skeleton width="100%" height="var(--size-dungeon-hero)" />
      <div className={styles.columns}>
        <SkeletonBox />
        <div className={styles.aside}>
          <SkeletonBox />
          <SkeletonBox />
        </div>
      </div>
    </div>
  );
}
