"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { itemQuality, type ItemQuality } from "@/core/gamedata/items";
import { itemFallbackName } from "@/core/views/itemTooltip";
import type { TooltipItem } from "@/core/views/recipes";

// The items a page sent for its tooltips (WEB-92), by ID.

export const ItemsContextValue = createContext<ReadonlyMap<number, TooltipItem>>(new Map());

export function ItemsProvider({ items, children }: { items: readonly TooltipItem[]; children: ReactNode }) {
  const [map] = useState(() => new Map(items.map((i) => [i.id, i])));
  return <ItemsContextValue.Provider value={map}>{children}</ItemsContextValue.Provider>;
}

/** An item's name (or "Item 279972"), quality and icon from the page's items. */
export function useItemName(id: number): { name: string; quality: ItemQuality; icon?: string } {
  const item = useContext(ItemsContextValue).get(id);
  const look = { name: item?.name ?? itemFallbackName(id), quality: itemQuality(item?.quality) };
  return item?.icon === undefined ? look : { ...look, icon: item.icon };
}
