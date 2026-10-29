import type { Metadata } from "next";
import Link from "next/link";
import { nowSeconds } from "@/app/clock";
import { AddGuestForm } from "@/components/admin/AddGuestForm";
import { DangerZone } from "@/components/admin/DangerZone";
import { AdminPanel, PanelEmpty, RowBadge, RowButton } from "@/components/admin/AdminPanel";
import rows from "@/components/admin/Admin.module.css";
import { FilterChip } from "@/components/ui/FilterChip";
import { LocalTime } from "@/components/ui/LocalTime";
import { PageTitle } from "@/components/ui/PageTitle";
import { loadAdminView } from "@/server/admin";
import { battleTagName } from "@/core/access";
import { getCutoff } from "@/server/cutoff";
import { getDb } from "@/server/db";
import {
  addGuestAction,
  blockAction,
  removeGuestAction,
  setMayUploadAction,
  startFreshAction,
  unblockAction,
  undoStartFreshAction,
} from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Admin" };

/**
 * The admin page (WEB-18, no board; layout decided with Nico, DESIGN.md §11): members from the data, the guest list
 * and blocks, each with when they were last seen; the Danger zone (WEB-62) at the bottom. Admin only: layout.tsx
 * checks.
 */
export default function AdminPage() {
  const view = loadAdminView(getDb(), nowSeconds());
  const cutoff = getCutoff(getDb());
  return (
    <div className={styles.page}>
      <PageTitle sub="Who may sign in: members come from the uploads, guests from your list.">Admin</PageTitle>
      <div className={styles.columns}>
        <div className={styles.main}>
          <AdminPanel
            id="admin-members"
            title="Members"
            sub="Everyone an accepted upload names. Membership never ends; a block keeps someone out."
          >
            {view.members.length === 0 ? (
              <PanelEmpty>No members yet. Members appear with the first upload.</PanelEmpty>
            ) : (
              <ul className={rows.list}>
                {view.members.map((m) => (
                  <li key={m.battleTag} className={rows.row} data-blocked={m.blocked || undefined} data-testid="member">
                    <span className={rows.who}>
                      <span className={rows.name}>
                        {m.name}
                        {m.isAdmin && <RowBadge>Admin</RowBadge>}
                        {m.blocked && <RowBadge>Blocked</RowBadge>}
                      </span>
                      <span className={rows.tag}>{m.battleTag}</span>
                    </span>
                    <span className={rows.meta}>
                      {m.added !== undefined && (
                        <Link href={`/upload/${m.added.uploadId}`} className={rows.link}>
                          {/* One span: the link is a flex box, which would drop the space after the comma. */}
                          <span>
                            {m.added.text}, <LocalTime at={m.added.at} />
                          </span>
                        </Link>
                      )}
                      <span>{m.seen}</span>
                    </span>
                    <span className={rows.actions}>
                      {m.isAdmin ? null : m.blocked ? (
                        <RowButton action={unblockAction} battleTag={m.battleTag} label="Unblock" />
                      ) : (
                        <RowButton action={blockAction} battleTag={m.battleTag} label="Block" danger />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
        <div className={styles.side}>
          <AdminPanel id="admin-guests" title="Guests" sub="Friends outside the community who may sign in.">
            <AddGuestForm action={addGuestAction} />
            {view.guests.length === 0 ? (
              <PanelEmpty>No guests. Add a BattleTag to let someone in who isn&apos;t in the community.</PanelEmpty>
            ) : (
              <ul className={rows.list}>
                {view.guests.map((g) => (
                  <li key={g.battleTag} className={rows.row} data-blocked={g.blocked || undefined} data-testid="guest">
                    <span className={rows.who}>
                      <span className={rows.name}>
                        {g.battleTag}
                        {g.blocked && <RowBadge>Blocked</RowBadge>}
                      </span>
                      <span className={rows.tag}>
                        {g.added}, <LocalTime at={g.addedAt} /> · {g.seen}
                      </span>
                    </span>
                    <span className={rows.actions}>
                      <form action={setMayUploadAction}>
                        <input type="hidden" name="battleTag" value={g.battleTag} />
                        <input type="hidden" name="mayUpload" value={String(!g.mayUpload)} />
                        <FilterChip type="submit" pressed={g.mayUpload} aria-label={`May upload: ${g.battleTag}`}>
                          May upload
                        </FilterChip>
                      </form>
                      {!g.blocked && <RowButton action={blockAction} battleTag={g.battleTag} label="Block" danger />}
                      <RowButton action={removeGuestAction} battleTag={g.battleTag} label="Remove" danger />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
          <AdminPanel id="admin-blocked" title="Blocked" sub="They can't sign in until you unblock them.">
            {view.blocks.length === 0 ? (
              <PanelEmpty>Nobody is blocked.</PanelEmpty>
            ) : (
              <ul className={rows.list}>
                {view.blocks.map((b) => (
                  <li key={b.battleTag} className={rows.row} data-testid="blocked">
                    <span className={rows.who}>
                      <span className={rows.name}>{b.name}</span>
                      <span className={rows.tag}>
                        {b.battleTag} · {b.blocked}, <LocalTime at={b.blockedAt} />
                      </span>
                    </span>
                    <span className={rows.actions}>
                      <RowButton action={unblockAction} battleTag={b.battleTag} label="Unblock" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
      </div>
      <DangerZone
        start={startFreshAction}
        undo={undoStartFreshAction}
        {...(cutoff !== undefined
          ? {
              set: (
                <>
                  Started fresh at <LocalTime at={cutoff.at} /> by {battleTagName(cutoff.setBy)}. Only uploads after it
                  count; Undo brings everything back.
                </>
              ),
            }
          : {})}
      />
    </div>
  );
}
