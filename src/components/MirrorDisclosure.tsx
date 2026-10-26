"use client";

import { Children, useState, type ReactNode } from "react";

export default function MirrorDisclosure({ name, worldId, children }: {
  name: string;
  worldId: string;
  verb: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const content = Children.toArray(children);
  const detailId = `${worldId}-detail`;
  return (
    <>
      {content.slice(0, 2)}
      {content.length > 2 && (
        <>
          <div id={detailId} hidden={!open}>{content.slice(2)}</div>
          <button type="button" aria-expanded={open} aria-controls={detailId}
            aria-label={`${open ? "Show less" : "Read more"} about ${name}`}
            onClick={() => setOpen(!open)}>
            {open ? "Show less" : "Read more"}
          </button>
        </>
      )}
    </>
  );
}
