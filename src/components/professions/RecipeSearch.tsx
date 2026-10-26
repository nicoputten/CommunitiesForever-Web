import { SearchIcon } from "@/components/ui/icons";
import styles from "./RecipeSearch.module.css";

/** Recipe search, not yet working (professions board): it arrives when the addon shares known recipes. */
export function RecipeSearch() {
  return (
    <div className={styles.frame}>
      <label className={styles.field}>
        <SearchIcon className={styles.icon} />
        <span className="visually-hidden">Recipe search (not available yet)</span>
        <input type="search" disabled tabIndex={-1} placeholder="Who can craft… e.g. Bolt of Silk Cloth" />
      </label>
      <p className={styles.note}>Recipe search arrives when the addon shares known recipes.</p>
    </div>
  );
}
