"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { motionOn, setMotion, subscribeMotion } from "@/components/atmosphere/motion";
import { AdminIcon, ChatIcon, MotionIcon, SignOutIcon, UploadIcon } from "@/components/ui/icons";
import type { Viewer } from "./viewer";
import styles from "./UserMenu.module.css";

const ROLE_NAMES = { admin: "Admin", member: "Member", guest: "Guest" } as const;

export interface UserMenuProps {
  viewer: Viewer;
  signOut: () => Promise<void>;
}

/**
 * The signed-in user: avatar and BattleTag, opening a panel with Discord (WEB-39), Admin (admin only, WEB-18), the
 * Motion switch and sign out (and Upload on phone).
 * A disclosure, not an ARIA menu: a short list reached with Tab; Escape and a click outside close it.
 */
export function UserMenu({ viewer, signOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // Server render: on; the client corrects it on hydration from the stored setting or the system (motion.ts).
  const motion = useSyncExternalStore(subscribeMotion, motionOn, () => true);

  // Close on navigation (adjusting state during render instead of in an effect).
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={styles.root} data-user-menu="">
      <button
        ref={button}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className={styles.avatar}>
          {Array.from(viewer.battleTag)[0]?.toUpperCase()}
        </span>
        {/* The name comes from the visible text ("Account" for screen readers only), so it contains what is shown. */}
        <span className={styles.tag}>
          <span className="visually-hidden">Account </span>
          {viewer.battleTag}
        </span>
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.who}>
          <span className={styles.whoTag}>{viewer.battleTag}</span>
          <span className={styles.role}>{ROLE_NAMES[viewer.role]}</span>
        </div>
        <ul className={styles.items}>
          {viewer.mayUpload && (
            <li className={styles.phoneOnly}>
              <Link href="/uploader" className={styles.item}>
                <UploadIcon className={styles.icon} />
                Uploader
              </Link>
            </li>
          )}
          <li>
            <Link href="/discord" className={styles.item} aria-current={pathname === "/discord" ? "page" : undefined}>
              <ChatIcon className={styles.icon} />
              Discord
            </Link>
          </li>
          {viewer.role === "admin" && (
            <li>
              <Link href="/admin" className={styles.item} aria-current={pathname === "/admin" ? "page" : undefined}>
                <AdminIcon className={styles.icon} />
                Admin
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              role="switch"
              aria-checked={motion}
              className={styles.item}
              onClick={() => setMotion(!motion)}
            >
              <MotionIcon className={styles.icon} />
              Motion
              <span aria-hidden="true" className={styles.state}>
                {motion ? "On" : "Off"}
              </span>
            </button>
          </li>
          <li>
            <form action={signOut}>
              <button type="submit" className={styles.item}>
                <SignOutIcon className={styles.icon} />
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  );
}
