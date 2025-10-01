export default function AboutPage(){
  const pills = [
    "Base-native swapping, Toby style",
    "1% fee auto-buys $TOBY → burn",
    "Dark glass + playful color pips",
    "USDC / ETH ↔️ TOBY · PATIENCE · TABOSHI",
    "Open-source front-end; verified contract",
    "Links out to the Tobyworld community",
  ];
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">About</h1>
      <div className="flex flex-wrap gap-3">
        {pills.map(p=> (
          <span key={p} className="pill glass text-sm">{p}</span>
        ))}
      </div>
      <p className="text-inkSub">This UI calls your deployed Toby Swapper contract and constructs paths that buy-burn TOBY from the 1% fee.</p>
    </section>
  );
}
