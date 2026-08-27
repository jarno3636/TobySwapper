"use client";

import Link from "next/link";
import styles from "./KeeperOfTobyGate.module.css";

export default function KeeperOfTobyGate() {
  return (
    <div className={styles.wrap}>
      <Link
        href="/keepers-of-toby"
        prefetch={false}
        className={styles.gate}
        aria-label="Enter The Keepers of Toby"
      >
        <span aria-hidden="true">◌</span>
        <strong>ΟΙ ΦΥΛΑΚΕΣ</strong>
        <i aria-hidden="true">→</i>
      </Link>
    </div>
  );
}
