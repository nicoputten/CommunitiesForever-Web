import type { ReactNode } from "react";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { DriftingMap } from "@/components/atmosphere/DriftingMap";
import { EmblemIcon } from "@/components/ui/icons";
import styles from "./SignIn.module.css";

// The sign-in screens (WEB-17, boards sign-in and sign-in-states): one panel over the drifting map, fog and embers.
// The states (not on the list, Battle.net didn't answer, signing in) take the panel's place on the same scene.

/** The page: the sign-in atmosphere behind a centred panel. */
export function SignInScene({ children }: { children: ReactNode }) {
  return (
    <div className={styles.scene}>
      <Atmosphere variant="signin">
        <DriftingMap />
      </Atmosphere>
      <main className={styles.center}>{children}</main>
    </div>
  );
}

/** The sign-in panel: emblem, site name, tagline, the Battle.net button (a form posting to `action`). */
export function SignInPanel({ siteName, action }: { siteName: string; action: () => Promise<void> }) {
  return (
    <section className={styles.panel} aria-labelledby="signin-title">
      <EmblemIcon className={styles.emblem} strokeWidth={1.1} />
      <h1 id="signin-title" className={styles.siteName}>
        {siteName}
      </h1>
      <p className={styles.tagline}>Where is everyone in Azeroth tonight?</p>
      <form action={action} className={styles.form}>
        <button type="submit" className={styles.bnet}>
          <LockIcon />
          Sign in with Battle.net
        </button>
      </form>
      <p className={styles.note}>For the friends on the guest list. We only read your BattleTag, nothing else.</p>
    </section>
  );
}

export type StateIcon = "refused" | "error" | "busy";

export interface StatePanelProps {
  icon: StateIcon;
  title: string;
  children: ReactNode;
  /** What sits at the bottom of the panel: buttons, or the quiet last line. */
  actions?: ReactNode;
  /** alert: Battle.net didn't answer; status: signing in. */
  role?: "alert" | "status";
}

/** A state in the panel's place (sign-in-states board). */
export function StatePanel({ icon, title, children, actions, role }: StatePanelProps) {
  return (
    <section className={styles.state} aria-labelledby="state-title" role={role}>
      {icon === "refused" && <RefusedIcon />}
      {icon === "error" && <ErrorIcon />}
      {icon === "busy" && <SpinnerIcon />}
      <h1 id="state-title" className={styles.stateTitle}>
        {title}
      </h1>
      {children}
      <div className={styles.grow} />
      {actions}
    </section>
  );
}

/** State text; `small` for the second, quieter line. */
export function StateText({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <p className={small ? `${styles.text} ${styles.textSmall}` : styles.text}>{children}</p>;
}

/** A BattleTag in state text. */
export function Tag({ children }: { children: string }) {
  return <strong className={styles.tag}>{children}</strong>;
}

/** The last quiet line of a state ("Then straight to the map"). */
export function StateFoot({ children }: { children: ReactNode }) {
  return <p className={styles.foot}>{children}</p>;
}

/** A full-width state button in a form: `primary` is Battle.net blue ("Try again"), otherwise gold outline. */
export function StateButton({
  action,
  primary = false,
  children,
}: {
  action: () => Promise<void>;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <form action={action} className={styles.form}>
      <button type="submit" className={primary ? styles.btnPrimary : styles.btnOutline}>
        {children}
      </button>
    </form>
  );
}

/** The quiet text button under a state's main button ("Sign out"). */
export function StateQuiet({ action, children }: { action: () => Promise<void>; children: ReactNode }) {
  return (
    <form action={action}>
      <button type="submit" className={styles.quiet}>
        {children}
      </button>
    </form>
  );
}

// Icons of the boards. Decorative: the heading names the state.

function LockIcon() {
  return (
    <svg className={styles.lock} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <rect x="3" y="8" width="12" height="8" rx="2" />
      <path d="M6 8V5.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

function RefusedIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <path className={styles.iconShield} d="M26 5l17 7v13c0 11-7.5 17-17 21C16.5 42 9 36 9 25V12z" />
      <path className={styles.iconCross} d="M19 19l14 14M33 19L19 33" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <circle className={styles.iconRing} cx="26" cy="26" r="20" />
      <path className={styles.iconBang} d="M26 15v14M26 36v.01" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className={`${styles.icon} ${styles.spin}`} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <circle className={styles.spinTrack} cx="26" cy="26" r="20" />
      <path className={styles.spinArc} d="M26 6a20 20 0 0 1 20 20" />
    </svg>
  );
}
