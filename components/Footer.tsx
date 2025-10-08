// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="mt-12 text-center text-xs text-ink-sub py-6 border-t border-white/10 glass rounded-t-2xl">
      <p className="mb-2">
        Fan Project · Not affiliated with the $TOBY project or its creator.
      </p>
      <p className="mb-2">
        <a
          href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-accent"
        >
          Swapper Contract
        </a>
      </p>
      <p>Created in 2025 🐸</p>
    </footer>
  );
}
