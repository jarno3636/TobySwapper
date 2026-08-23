import { dormantProductionAdapter } from "@/lib/production-adapter";

export default function ProductionPanel() {
  return <section className="production-panel">
    <span>PRODUCTION</span>
    <div className="production-waterline"><i /><i /><i /></div>
    <h2>Production systems remain beneath the water.</h2>
    <p>No production or rewards contract is configured. Nothing is presented as earned, claimable, or yielding until an official adapter exists.</p>
    <small>ADAPTER · {dormantProductionAdapter.id.toUpperCase()} · NOT CONFIGURED</small>
  </section>;
}
