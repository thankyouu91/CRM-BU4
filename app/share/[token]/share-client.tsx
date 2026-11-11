"use client";

import { Presenter } from "@/components/deck/presenter";
import type { Deck } from "@/lib/deck-model";

/** Only the finished slides reach the browser: the data they were built from stays on the server. */
export function ShareClient({ deck }: { deck: Deck }) {
  return <Presenter deck={deck} />;
}
