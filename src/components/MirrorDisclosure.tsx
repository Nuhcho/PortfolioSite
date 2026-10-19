"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  getActiveEntry,
  getServerActiveEntry,
  setActiveEntry,
  subscribeActiveEntry,
} from "./world/worldState";

/* In the world these are blocks with their words cut into the stone, and
   pressing one flies the camera to it. This is the same control as a real
   button for anyone reaching it by keyboard or screen reader — both read the
   same cell, so operating either one moves the same camera. Only one is held
   at a time, in the world and here.

   The copy is always present in this mirror; what the control changes is where
   the camera is looking, which is why it reads "focus" rather than "show". */
export default function MirrorDisclosure({
  name,
  worldId,
  verb,
  children,
}: {
  name: string;
  worldId: string;
  /** what slides out of this object, named in the control's own words */
  verb: string;
  children: ReactNode;
}) {
  const active = useSyncExternalStore(
    subscribeActiveEntry,
    getActiveEntry,
    getServerActiveEntry
  );
  const open = active === name;
  const detailId = `${worldId}-detail`;

  return (
    <>
      <button
        type="button"
        data-world={worldId}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setActiveEntry(open ? null : name)}
      >
        {open ? `Leave the ${name} ${verb}` : `Focus the ${name} ${verb}`}
      </button>
      <div id={detailId}>{children}</div>
    </>
  );
}
