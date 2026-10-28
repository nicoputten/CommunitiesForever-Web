# Claude Design prompt: co-admins (WEB-64)

Paste everything below the line into the Doombringers canvas.

---

We're letting the site's **owner** (one fixed person, set on the server) appoint other friends as **admins**, so they can help run the group. Admins must never be able to break things or lock anyone out.

**Important: don't change any existing board.** Duplicate the admin-page board you build on and work in the copy, named "<original name> · co-admins". New screens get new boards.

Use the existing design system everywhere (Night over Azeroth: tokens, Marcellus SC / Marcellus / Inter, gold trim, class colours, 44 px touch targets, reduced motion). Desktop 1440 px and phone 375 px. All names are made up (Ada, Bob, Mira, Tok…). The admin page is the one place BattleTags may show; use made-up ones (Ada#2101).

## Roles (binding)
- **Owner:** one person. Can never be demoted or removed through the site. Shown with a crown and no buttons.
- **Admin:** appointed by the owner. Runs the group day to day: the guest list, blocks (never the owner's or another admin's), the Discord page's post settings (including the Doomsday reset time), deleting any run, marking runs done, test posts.
- **Owner only:** "Start fresh from launch" (the Danger zone) and its Undo, the bot token, appointing and removing admins, revoking other friends' uploader devices. For admins these controls are **not shown at all** (not greyed out), so the page stays calm.

## Screens to make
1. **The admin page as the owner sees it,** with a new **Admins** box:
   - every friend who has signed in, with their display name, BattleTag and last seen
   - the owner first, with a crown and "Owner"; admins with an "Admin" badge
   - **Make admin** and **Remove admin** buttons, each with a confirm dialog ("Make Mira an admin? Mira can manage guests, blocks, Discord posts and runs, but not the bot token, the launch reset or other admins.")
2. **The same page as an admin sees it:** the same boxes without the owner-only ones (no Admins buttons, no Danger zone, no bot token), plus a short line at the top: "You're an admin. Some settings are for the owner only."
3. **The Discord page as an admin sees it:** the post settings are usable, and the bot token card shows only its online state, without create, replace or revoke.
4. **An "Admin changes" log:** a compact list on the admin page (who, what, when): "Mira made Bob an admin", "Ada blocked Tok#3307", "Mira changed the Doomsday reset to 20:00", "Ada started fresh from launch". Last 50, newest first.
5. **States:**
   - no admins yet (only the owner)
   - removing an admin who is signed in right now
   - an admin trying an owner-only action through an old link (a short "Only the owner can do this" message)
6. **Phone:** the Admins box and the log stacked, every control 44 px.
