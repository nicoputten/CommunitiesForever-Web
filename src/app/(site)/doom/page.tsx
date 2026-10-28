import { redirect } from "next/navigation";

/** /doom, the short alias of /doomsday (board doomsday-names). */
export default function DoomAlias() {
  redirect("/doomsday");
}
