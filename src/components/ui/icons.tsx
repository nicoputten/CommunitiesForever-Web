import type { SVGProps } from "react";

// Line icons of the boards, drawn in currentColor. Decorative: the text next to them names the action.

type IconProps = Omit<SVGProps<SVGSVGElement>, "viewBox">;

function Icon({ children, viewBox, strokeWidth = 1.5, ...rest }: IconProps & { viewBox: string }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Placeholder emblem: shield with cross (DESIGN.md §1; final emblem is an open item). */
export function EmblemIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 26 26" {...props}>
      <path d="M13 2l9 4v7c0 6-4 9-9 11C8 22 4 19 4 13V6z" />
      <path d="M13 7v12M8 12h10" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.6} {...props}>
      <path d="M8 11V2M4 5.5L8 2l4 3.5M2 11v3h12v-3" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 20 20" strokeWidth={1.6} {...props}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 5v5l3 2" />
    </Icon>
  );
}

/** Magnifier (roster-cards: search field). */
export function SearchIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 14 14" strokeWidth={1.5} {...props}>
      <circle cx="6" cy="6" r="4.5" />
      <path d="M9.5 9.5L13 13" />
    </Icon>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 28 28" strokeWidth={1.8} {...props}>
      <path d="M3 7l7-3 8 3 7-3v17l-7 3-8-3-7 3z M10 4v17 M18 7v17" />
    </Icon>
  );
}

export function RosterIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 28 28" strokeWidth={1.8} {...props}>
      <circle cx="10" cy="10" r="4" />
      <circle cx="19" cy="11" r="3" />
      <path d="M3 23c1-5 4-7 7-7s6 2 7 7 M16 17c3 0 6 2 7 6" />
    </Icon>
  );
}

export function ProfessionsIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 28 28" strokeWidth={1.8} {...props}>
      <path d="M5 23l10-10 M13 7l8 8 M16 4l8 8-3 3-8-8z M4 24l3-1-2-2z" />
    </Icon>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.5} {...props}>
      <path d="M6 2H3v12h3M10 5l3 3-3 3M13 8H6" />
    </Icon>
  );
}

/** Three lines narrowing: the phone map's Filters button (phone-map board). */
export function FiltersIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 20 20" strokeWidth={1.6} {...props}>
      <path d="M3 5h14M6 10h8M8.5 15h3" />
    </Icon>
  );
}

/** A chevron left: back (phone-character board). */
export function BackIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 18 18" strokeWidth={1.8} {...props}>
      <path d="M11 3L5 9l6 6" />
    </Icon>
  );
}

/** Two waves: the user menu's Motion setting (WEB-16; no board draws this item, the stroke matches SignOutIcon). */
export function MotionIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.5} {...props}>
      <path d="M2 6q1.5-2 3 0t3 0 3 0 3 0M2 11q1.5-2 3 0t3 0 3 0 3 0" />
    </Icon>
  );
}

/** A key: the user menu's Admin item (WEB-18; no board draws it, the stroke matches SignOutIcon). */
export function AdminIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.5} {...props}>
      <circle cx="5.5" cy="8" r="3" />
      <path d="M8.5 8H14.5M12.5 8v2.5M14.5 8v2" />
    </Icon>
  );
}

/** The ledger (upload board): a page with lines, a gold upload disc on its corner. `drag`: without the disc. */
export function LedgerIcon({ drag = false, ...props }: IconProps & { drag?: boolean }) {
  const page = drag ? "var(--gold-bright)" : "var(--gold)";
  return (
    <Icon viewBox="0 0 84 84" strokeWidth={drag ? 2.4 : 2} {...props}>
      <path d="M22 12h30l12 12v48H22z" style={{ fill: "var(--surface-raised)", stroke: page }} />
      <path d="M52 12v12h12" style={{ stroke: page }} />
      <path
        d="M30 38h26M30 46h26M30 54h18"
        strokeWidth={2}
        style={{ stroke: drag ? "var(--text-muted)" : "var(--text-dim)" }}
      />
      {!drag && (
        <>
          <circle cx="62" cy="64" r="13" style={{ fill: "var(--gold)", stroke: "none" }} />
          <path d="M62 70V58M57 63l5-5 5 5" strokeWidth={2.2} style={{ stroke: "var(--on-gold)" }} />
        </>
      )}
    </Icon>
  );
}

/** Reading spinner (upload-states): a track and a gold quarter arc; the caller spins it. */
export function SpinnerIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 56 56" strokeWidth={4} {...props}>
      <circle cx="28" cy="28" r="22" style={{ stroke: "var(--track)" }} />
      <path d="M28 6a22 22 0 0 1 22 22" style={{ stroke: "var(--gold)" }} />
    </Icon>
  );
}

/** Warning triangle (upload-states: wrong file and the other refusals). */
export function AlertIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 48 48" strokeWidth={2.4} {...props}>
      <path d="M24 6L44 40H4z" />
      <path d="M24 19v10M24 34v.01" strokeWidth={2.6} />
    </Icon>
  );
}

/** Clock (upload-states: newer addon version). */
export function NewerIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 48 48" strokeWidth={2.4} {...props}>
      <circle cx="24" cy="24" r="19" />
      <path d="M24 14v12l7 4" />
    </Icon>
  );
}

/** Circle with a dash (upload-states: nothing new). */
export function NothingNewIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 48 48" strokeWidth={2.4} {...props}>
      <circle cx="24" cy="24" r="19" />
      <path d="M15 24h18" />
    </Icon>
  );
}

/** Info (upload board: the /reload hint). */
export function InfoIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.5} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7v4M8 5v.01" />
    </Icon>
  );
}

/** Dungeon arch (map board: the dungeon badge on a marker or cluster). */
export function DungeonIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 12 12" strokeWidth={1.4} {...props}>
      <path d="M2 11V5a4 4 0 0 1 8 0v6M2 11h8M4.5 11V7.5M7.5 11V7.5" />
    </Icon>
  );
}

/** Compass rose over "The map is still empty" (empty-site board); colour from currentColor. */
export function CompassIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 64 64" strokeWidth={1} {...props}>
      <circle cx="32" cy="32" r="26" strokeOpacity={0.5} strokeDasharray="3 5" />
      <path d="M32 12 L36 32 L32 52 L28 32 Z" fill="currentColor" fillOpacity={0.25} />
      <path d="M12 32 L32 28 L52 32 L32 36 Z" fill="currentColor" fillOpacity={0.12} strokeOpacity={0.6} />
    </Icon>
  );
}
