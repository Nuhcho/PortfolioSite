"use client";

import { useEffect, useState } from "react";
import type { DownloadProgress } from "./models";
import styles from "./WorldLoader.module.css";

export default function WorldLoader({ ready, download, preparing }: {
  ready: boolean;
  download: DownloadProgress;
  preparing: boolean;
}) {
  // Only downloaded bytes have a measurable total. Scene preparation has no
  // reliable percentage, so it uses an explicitly indeterminate indicator.
  const percent = !preparing && download.total !== null
    ? Math.min(100, Math.floor(download.loaded / download.total * 100)) : null;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timeout = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timeout);
  }, [ready]);

  return <div className={styles.loader} data-world-loader data-ready={ready}
    aria-hidden={ready} inert={ready}>
    <p className={styles.name}>Nicolas Villegas-Kirchman</p>
    <div className={styles.content}>
      <div className={styles.illustration} aria-hidden="true">
        <svg viewBox="0 0 320 240" fill="none">
          <circle className={styles.sun} cx="225" cy="68" r="34" fill="#FFCF54" />
          <circle cx="225" cy="68" r="45" stroke="#FFCF54" strokeOpacity=".2" />
          <path d="M65 69q8-9 16 0 8-9 16 0M117 42q6-7 12 0 6-7 12 0" stroke="#C2EFEC" strokeWidth="2.5" strokeLinecap="round" />
          <g className={styles.boat}>
            <path d="M158 48v127" stroke="#FFF4D9" strokeWidth="4" strokeLinecap="round" />
            <path d="M150 62C131 91 114 117 103 139c15 5 31 7 47 7Z" fill="#FFF4D9" />
            <path d="M168 80c18 22 35 42 47 62-17-2-33-2-47 1Z" fill="#E75A3B" />
            <path d="M113 123c12 4 24 6 37 6v9c-14 0-28-2-41-6Z" fill="#FFB56F" />
            <path d="M158 49v-9l23 5-23 7" fill="#E75A3B" />
            <path d="M90 159q69 13 143-2l-20 24q-47 17-101 0Z" fill="#E75A3B" />
            <path d="m104 173 8 8q54 17 101 0l8-10q-60 14-117 2" fill="#B63F2E" />
            <path d="M90 159q69 13 143-2" stroke="#FFF4D9" strokeWidth="4" strokeLinecap="round" />
            <circle cx="124" cy="174" r="3" fill="#294F62" />
            <circle cx="140" cy="177" r="3" fill="#294F62" />
          </g>
          <g className={styles.waves} stroke="#91DFD8" strokeWidth="2.5" strokeLinecap="round">
            <path d="M36 194q15-8 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" />
            <path d="M66 211q15-7 30 0t30 0t30 0t30 0t30 0t30 0t30 0" opacity=".4" />
          </g>
        </svg>
      </div>
      <p className={styles.eyebrow}>A little plaza. A world of work.</p>
      <h1 className={styles.title}>Setting sail<span className={styles.dots} aria-hidden="true">...</span></h1>
      <p className={styles.status} role="status" aria-live="polite">
        {ready ? "Your waterfront is ready." : slow
          ? "Taking a little longer. Your waterfront is on its way."
          : preparing ? "Bringing the waterfront to life." : "Downloading the waterfront."}
      </p>
      <div className={styles.progress}>
        <div className={styles.track} role="progressbar"
          aria-label={preparing ? "Preparing the waterfront" : "Downloading the waterfront model"}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}
          data-indeterminate={percent === null}>
          <span style={{ transform: percent === null ? undefined : `scaleX(${percent / 100})` }} />
        </div>
        <span className={styles.progressValue} aria-hidden="true">
          {ready ? "Ready" : preparing ? "Preparing scene…" : percent === null ? "Downloading model…" : `Model download · ${percent}%`}
        </span>
      </div>
    </div>
    <p className={styles.footer}>Applied ML <span>✦</span> Software engineering</p>
  </div>;
}
