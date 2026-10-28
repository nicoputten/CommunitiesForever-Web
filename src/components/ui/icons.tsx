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

/** A speech bubble: the Discord page (WEB-39). Not Discord's logo. */
export function ChatIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.6} {...props}>
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
      <path d="M5.5 7h.01M8 7h.01M10.5 7h.01" />
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

/** Runs (WEB-40): a calendar, in the tab bar's line style. */
export function RunsIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 28 28" strokeWidth={1.8} {...props}>
      <path d="M5 8h18v15H5z M5 13h18 M10 5v5 M18 5v5 M10 18h3" />
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

/** Plus before "Plan a run" (dungeon-page board). */
export function PlusIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 14 14" strokeWidth={2} {...props}>
      <path d="M7 1v12M1 7h12" />
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

/** uploader-page: "Download for Windows". */
export function DownloadIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.8} {...props}>
      <path d="M8 2v9M4 7.5L8 11l4-3.5M2 14h12" />
    </Icon>
  );
}

/** uploader-page: an uploader's computer. */
export function DeviceIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 32 32" {...props}>
      <rect x="4" y="6" width="24" height="16" rx="2" />
      <path d="M12 26h8M16 22v4" />
    </Icon>
  );
}

/** Doomsday (E8, board doomsday-names): the sun rising over a shield, in the tab bar's line style. */
export function DoomsdayIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 28 28" strokeWidth={1.8} {...props}>
      <path d="M14 15V5 M14 15l7-6 M14 15L7 9 M3 15h22 M7 15c2 8 12 8 14 0 M12 19h4 M14 17v4" />
    </Icon>
  );
}

/** doomsday-today: the crown of the first to finish, filled gold. */
export function CrownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M2 12h12l1-8-4 3-3-5-3 5-4-3z"
        fill="var(--gold-bright)"
        stroke="var(--crown-line)"
        strokeWidth=".8"
        strokeLinejoin="round"
      />
      <rect x="2" y="12.5" width="12" height="2" rx="1" fill="var(--gold)" />
    </svg>
  );
}

/** doomsday-today: the streak's flame. */
export function FlameIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false" {...props}>
      <path d="M7 1c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 2 1 2 0-2 0-4 1-6z" fill="var(--streak-flame)" />
    </svg>
  );
}

/** doomsday-today: a goal swapped for one friend. */
export function SwapIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 14 14" strokeWidth={1.4} {...props}>
      <path d="M2 5h9l-2-2M12 9H3l2 2" />
    </Icon>
  );
}

/** doomsday-today: the big emblem next to the page title (sun over the shield-shaped bowl). */
export function DoomsdayEmblem(props: IconProps) {
  const rays = [
    [52.8, 22],
    [44, 13.2],
    [32, 10],
    [20, 13.2],
    [11.2, 22],
  ];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...props}>
      {rays.map(([x, y]) => (
        <path
          key={`${x}`}
          d={`M32 34 L${x} ${y}`}
          stroke="var(--gold)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".8"
        />
      ))}
      <circle cx="32" cy="34" r="14" fill="var(--gold-bright)" />
      <path d="M6 40h52" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 40c4 14 32 14 36 0z" fill="var(--surface-raised)" stroke="var(--gold-bright)" strokeWidth="2.4" />
      <path d="M27 46h10M32 41v10" stroke="var(--gold-bright)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** doomsday-feats: a sword (first epic, watch-list items, PvP feats). */
export function SwordIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth={1.8} {...props}>
      <path d="M14 4h6v6L9 21l-6-6z" />
      <path d="M5 13l6 6" />
    </Icon>
  );
}

/** doomsday-feats: a mount. */
export function MountIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth={1.8} {...props}>
      <path d="M4 18c2-6 6-8 10-8l3-4 2 2-1 3c2 1 3 3 3 7" />
      <path d="M8 18v3M17 18v3" />
    </Icon>
  );
}

/** doomsday-feats: a fish (Fishing). */
export function FishIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth={1.8} {...props}>
      <path d="M3 12c4-6 12-6 16 0-4 6-12 6-16 0z" />
      <path d="M19 12l3-3v6z" />
    </Icon>
  );
}

/** doomsday-feats: a skull (deaths). */
export function SkullIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth={1.8} {...props}>
      <circle cx="12" cy="10" r="7" />
      <path d="M9 21v-4M15 21v-4" />
      <circle cx="9.5" cy="10" r="1.5" fill="currentColor" />
      <circle cx="14.5" cy="10" r="1.5" fill="currentColor" />
    </Icon>
  );
}

/** doomsday-feats: a cooking pot (profession caps). */
export function PotIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth={1.8} {...props}>
      <path d="M5 10h14l-1 9H6z" />
      <path d="M8 10V7M12 10V5M16 10V7" />
    </Icon>
  );
}

/**
 * doomsday-ladder: a PvP rank insignia, a gold shield: ranks 1 to 5 as that many chevrons, from rank 6 a dot over
 * the rank's number (the board shows rank 2 and rank 6 only). None at rank 0.
 */
export function RankInsignia({ rank, ...props }: IconProps & { rank: number }) {
  const chevrons = rank >= 1 && rank <= 5 ? rank : 0;
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M13 2l9 4v7c0 6-4 9-9 11C8 22 4 19 4 13V6z"
        fill="var(--gold)"
        stroke="var(--card-badge-line)"
        strokeWidth=".8"
      />
      {Array.from({ length: chevrons }, (_, i) => (
        <path
          key={i}
          d={`M7 ${(9.3 - (chevrons - 1) * 1.3 + i * 2.6).toFixed(1)}l6 3 6-3`}
          fill="none"
          stroke="var(--on-gold)"
          strokeWidth="1.4"
        />
      ))}
      {rank >= 6 && (
        <>
          <circle cx="13" cy="8.5" r="1.4" fill="var(--on-gold)" />
          <text x="13" y="17.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--on-gold)">
            {rank}
          </text>
        </>
      )}
    </svg>
  );
}
