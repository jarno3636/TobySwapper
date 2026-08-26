"use client";

import styles from "./CommunitySites.module.css";

const sites = [
  {
    name: "TOBYWORLD",
    eyebrow: "OFFICIAL",
    href: "https://tobyworld.app",
    copy: "The official home of Tobyworld.",
    featured: true,
    mark: "◎",
  },
  {
    name: "Tobyisms",
    eyebrow: "LORE IRL",
    href: "https://tobyisms.com",
    copy: "Dedicated to recording & spreading toad lore IRL.",
    featured: false,
    mark: "✦",
  },
  {
    name: "ToadVault",
    eyebrow: "COMMUNITY ARCHIVE",
    href: "https://toadvault.xyz",
    copy:
      "Community speculation profiles, consensus theories, predictions, reactions and Toad Gang history.",
    featured: false,
    mark: "◇",
  },
  {
    name: "Toad Merch",
    eyebrow: "COMMUNITY GOODS",
    href: "https://slice.so/store/2223",
    copy: "Community-made Tobyworld goods and merch.",
    featured: false,
    mark: "▱",
  },
] as const;

export default function CommunitySites() {
  return (
    <section
      className={styles.shell}
      aria-labelledby="community-sites-title"
    >
      <header className={styles.heading}>
        <div>
          <span className="land-section-kicker">
            BEYOND THIS POND
          </span>

          <h2 id="community-sites-title">
            The wider Tobyworld.
          </h2>

          <p>
            Official lore and community-built places worth carrying with you.
          </p>
        </div>

        <span className={styles.fieldNote}>
          COMMUNITY PATHS
        </span>
      </header>

      <div className={styles.grid}>
        {sites.map((site) => (
          <a
            key={site.href}
            href={site.href}
            target="_blank"
            rel="noreferrer"
            className={`${styles.card} ${
              site.featured ? styles.featured : ""
            }`}
          >
            <span
              className={styles.mark}
              aria-hidden="true"
            >
              {site.mark}
            </span>

            <div className={styles.copy}>
              <small>
                {site.eyebrow}
              </small>

              <strong>
                {site.name}
              </strong>

              <p>
                {site.copy}
              </p>
            </div>

            <span
              className={styles.arrow}
              aria-hidden="true"
            >
              ↗
            </span>
          </a>
        ))}
      </div>

      <p className={styles.note}>
        Tobyworld is the official destination. The other paths above are
        community-created resources.
      </p>
    </section>
  );
}
