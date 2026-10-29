import type { Metadata } from "next";
import Link from "next/link";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { AddGuestForm } from "@/components/admin/AddGuestForm";
import { AdminConfirm } from "@/components/admin/AdminConfirm";
import { AdminLog } from "@/components/admin/AdminLog";
import { GuestBadge, OnlineBadge, OwnerBar, RankBadge, RefusedLine, WhoTag } from "@/components/admin/CoAdmins";
import { DangerZone } from "@/components/admin/DangerZone";
import { AdminPanel, PanelEmpty, RowBadge, RowButton } from "@/components/admin/AdminPanel";
import rows from "@/components/admin/Admin.module.css";
import co from "@/components/admin/CoAdmins.module.css";
import { FilterChip } from "@/components/ui/FilterChip";
import { LocalTime } from "@/components/ui/LocalTime";
import { PageTitle } from "@/components/ui/PageTitle";
import { refusedText } from "@/core/views/admin";
import { loadAdminView } from "@/server/admin";
import { battleTagName } from "@/core/access";
import { getCutoff } from "@/server/cutoff";
import { getDb } from "@/server/db";
import {
  addGuestAction,
  blockAction,
  makeAdminAction,
  removeAdminAction,
  removeGuestAction,
  revokeDeviceAction,
  setMayUploadAction,
  startFreshAction,
  unblockAction,
  undoStartFreshAction,
} from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Admin" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The admin page (WEB-18, no board; layout decided with Nico, DESIGN.md §11), for the owner and admins (WEB-64,
 * boards `admin-coadmins`, `admin-as-admin`): the Admins box and members, guests and blocks on the left; the admin
 * changes log, and for the owner the uploader devices and the Danger zone (WEB-62), on the right. Owner-only controls
 * are left out for admins; the actions check again. layout.tsx checks the role.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const owner = (await getViewer())?.owner === true;
  const view = loadAdminView(getDb(), nowSeconds(), undefined, owner);
  const cutoff = owner ? getCutoff(getDb()) : undefined;
  const refused = refusedText(one(params.refused), one(params.who));
  const ownerName = view.ownerName ?? "the owner";
  return (
    <div className={styles.page}>
      <PageTitle sub="Who may sign in, who helps run the group, and what changed.">Admin</PageTitle>
      {!owner && <OwnerBar owner={view.ownerName} />}
      {refused !== undefined && <RefusedLine>{refused}</RefusedLine>}
      <div className={styles.columns}>
        <div className={styles.main}>
          <AdminPanel
            id="admin-admins"
            title="Admins"
            strong
            aside={view.adminCount}
            sub={
              owner
                ? "Admins help run the group: guests, blocks, Discord posts and runs. They can't touch the bot token, the launch reset or other admins."
                : `Who helps run the group. Only the owner (${ownerName}) appoints or removes admins.`
            }
          >
            {owner && view.admins.every((a) => a.rank !== "admin") && <PanelEmpty>No admins yet.</PanelEmpty>}
            <ul className={rows.list}>
              {view.admins.map((a) => (
                <li key={a.battleTag} className={rows.row} data-testid="admin-row">
                  <span className={rows.who}>
                    <span className={rows.name}>
                      {a.name}
                      <RankBadge rank={a.rank} />
                      {a.guest && <GuestBadge />}
                      {a.online && <OnlineBadge />}
                    </span>
                    <span className={rows.tag}>
                      {a.battleTag} · {a.seen}
                    </span>
                    <span className={rows.tag}>
                      {a.since !== undefined ? (
                        <>
                          Admin since <LocalTime at={a.since.at} day="date" />, made by {a.since.by}
                        </>
                      ) : (
                        a.line
                      )}
                    </span>
                  </span>
                  {owner && a.rank !== "owner" && (
                    <span className={rows.actions}>
                      <AdminConfirm
                        kind={a.rank === "admin" ? "remove" : "make"}
                        name={a.name}
                        battleTag={a.battleTag}
                        online={a.online}
                        action={a.rank === "admin" ? removeAdminAction : makeAdminAction}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className={co.hint}>
              {owner ? "Friends show up here after their first sign-in." : "The owner is set on the server."}
            </p>
          </AdminPanel>
          <AdminPanel
            id="admin-members"
            title="Members"
            aside={
              <>
                {view.members.length}
                <WhoTag />
              </>
            }
            sub="Everyone an accepted upload names. Membership never ends; a block keeps someone out. The owner and admins can't be blocked: an admin has to be removed as admin first."
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
                        <RankBadge rank={m.rank} />
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
                      {m.rank !== undefined ? (
                        <span className={co.hint}>Can&apos;t be blocked</span>
                      ) : m.blocked ? (
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
          <AdminPanel
            id="admin-guests"
            title="Guests"
            aside={
              <>
                {view.guests.length}
                <WhoTag />
              </>
            }
            sub="Friends outside the community who may sign in."
          >
            <AddGuestForm action={addGuestAction} />
            {view.guests.length === 0 ? (
              <PanelEmpty>No guests.</PanelEmpty>
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
          <AdminPanel
            id="admin-blocked"
            title="Blocked"
            aside={
              <>
                {view.blocks.length}
                <WhoTag />
              </>
            }
            sub="They can't sign in until someone unblocks them."
          >
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
        <div className={styles.side}>
          <AdminPanel
            id="admin-log"
            title="Admin changes"
            sub="Owner and admins see the same log. Nobody can edit or clear it."
            aside={`last ${view.log.length} · newest first`}
          >
            <AdminLog lines={view.log} />
          </AdminPanel>
          {owner && (
            <AdminPanel
              id="admin-devices"
              title="Uploader devices"
              aside={<WhoTag owner />}
              sub="Every friend's connected uploaders. Friends revoke their own on the Uploader page."
            >
              {view.devices.length === 0 ? (
                <PanelEmpty>No uploaders connected.</PanelEmpty>
              ) : (
                <ul className={rows.list}>
                  {view.devices.map((d) => (
                    <li key={d.id} className={rows.row} data-testid="device">
                      <span className={rows.who}>
                        <span className={`${rows.name} ${co.device}`}>{d.deviceName}</span>
                        <span className={rows.tag}>
                          {d.name} ·{" "}
                          {d.lastUploadAt !== undefined ? (
                            <>
                              last upload <LocalTime at={d.lastUploadAt} day="time" />
                            </>
                          ) : (
                            "no upload yet"
                          )}
                        </span>
                      </span>
                      <span className={rows.actions}>
                        <form action={revokeDeviceAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className={rows.button}>
                            Revoke
                            <span className="visually-hidden">
                              {" "}
                              {d.deviceName} of {d.battleTag}
                            </span>
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>
          )}
          {owner && (
            <DangerZone
              start={startFreshAction}
              undo={undoStartFreshAction}
              {...(cutoff !== undefined
                ? {
                    set: (
                      <>
                        Started fresh at <LocalTime at={cutoff.at} /> by {battleTagName(cutoff.setBy)}. Only uploads
                        after it count; Undo brings everything back.
                      </>
                    ),
                  }
                : {})}
            />
          )}
        </div>
      </div>
    </div>
  );
}
