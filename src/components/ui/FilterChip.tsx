import type { ButtonHTMLAttributes } from "react";
import styles from "./FilterChip.module.css";

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  /** A toggle: true or false sets aria-pressed. Leave undefined for a chip that opens a menu. */
  pressed?: boolean;
  /** The chip opens a menu: shows ▾ and sets aria-haspopup / aria-expanded. */
  menu?: boolean;
  expanded?: boolean;
  /** The chip has a value set (a menu chip with a choice made): gold border. */
  active?: boolean;
}

/** Pill filter button (design-system and roster-cards boards). */
export function FilterChip({ pressed, menu, expanded, active, children, className, ...rest }: FilterChipProps) {
  return (
    <button
      type="button"
      {...rest}
      className={className === undefined ? styles.chip : `${styles.chip} ${className}`}
      aria-pressed={pressed}
      aria-haspopup={menu ? "menu" : undefined}
      aria-expanded={menu ? (expanded ?? false) : undefined}
      data-active={active || undefined}
    >
      {children}
      {menu && (
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      )}
    </button>
  );
}
