import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface FirstUploadStateProps {
  title: string;
  /** Where else the characters appear, e.g. "on the roster and in professions". */
  elsewhere: string;
  /** The admin: "Upload the first file". Everyone else waits for `adminName`. */
  canUpload: boolean;
  adminName: string;
  as?: "h1" | "h2";
  icon?: ReactNode;
}

/** A screen before the first upload (empty-site board, WEB-29): the way to upload for the admin, who to wait for
 * for everyone else. */
export function FirstUploadState({ title, elsewhere, canUpload, adminName, as, icon }: FirstUploadStateProps) {
  return canUpload ? (
    <EmptyState title={title} as={as} icon={icon} action={{ href: "/upload", label: "Upload the first file" }}>
      Upload the addon&apos;s file after your next play session. Everyone&apos;s characters appear here, {elsewhere}.
    </EmptyState>
  ) : (
    <EmptyState title={title} as={as} icon={icon}>
      {adminName} hasn&apos;t uploaded any data yet. Check back after the next session.
    </EmptyState>
  );
}
