import LinkMaybeMini from "@/components/LinkMaybeMini";

export default function Footer() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-6xl px-4 pb-10 text-center text-xs text-inkSub">
      <div className="border-t border-[var(--line)] pt-6">
        <p>Community-built Tobyworld utility · Base mainnet · Non-custodial swaps.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 font-semibold">
          <LinkMaybeMini href="https://basescan.org/address/0xfC098D8d13CD4583715ECc2eFC1894F39947599d" className="hover:text-[var(--ink)]">TobySwap contract ↗</LinkMaybeMini>
        </div>
      </div>
    </footer>
  );
}
