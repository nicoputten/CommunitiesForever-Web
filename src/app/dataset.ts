import type { Dataset } from "@/core/model";
import { getDb } from "@/server/db";
import { loadState } from "@/server/uploads";

/** The merged data of every accepted upload, as the view models take it; undefined before the first upload. */
export function getDataset(): Dataset | undefined {
  return loadState(getDb())?.data;
}
