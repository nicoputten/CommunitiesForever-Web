import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { isAdmin } from "@/app/viewer";
import { ComponentGallery } from "./gallery";

export const metadata: Metadata = { title: "Components" };

/** Every shared component in every state, next to the design-system board (WEB-15). Admin only. */
export default async function ComponentsPage() {
  if (!(await isAdmin())) notFound();
  return <ComponentGallery now={nowSeconds()} />;
}
