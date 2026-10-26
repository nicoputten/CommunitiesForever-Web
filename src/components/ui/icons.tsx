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

/** Two waves: the user menu's Motion setting (WEB-16; no board draws this item, the stroke matches SignOutIcon). */
export function MotionIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" strokeWidth={1.5} {...props}>
      <path d="M2 6q1.5-2 3 0t3 0 3 0 3 0M2 11q1.5-2 3 0t3 0 3 0 3 0" />
    </Icon>
  );
}
