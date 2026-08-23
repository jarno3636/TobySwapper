"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

import MiniAppGate from "@/components/MiniAppGate";
import ConnectPill from "@/components/ConnectPill";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";

import LoreActivationCard from "@/components/activation/LoreActivationCard";
import AwakeningStats from "@/components/activation/AwakeningStats";
import ProductionPanel from "@/components/activation/ProductionPanel";

import { useLoreActivationReads } from "@/hooks/useLoreActivationReads";
import { useLoreActivationActions } from "@/hooks/useLoreActivationActions";

export default function AwakeningPage() {
  const { address, isConnected } = useAccount();

  const reads = useLoreActivationReads(address);

  const actions = useLoreActivationActions(
    address,
    reads.refetch,
  );

  return (
    <MiniAppGate>
      <main className="awakening-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <div className="awakening-topline">
          <Link
            prefetch={false}
            href="/taboshi1"
          >
            ← My Tobyworld
          </Link>

          <span>
            CANONICAL LORE · BASE
          </span>
        </div>

        <section className="awakening-hero">
          <img
            src="/tokens/new-lore.png"
            alt=""
          />

          <div>
            <span>
              LORE LAND ACTIVATION
            </span>

            <h1>
              Awaken the land.
            </h1>

            <p>
              Commit TOBY, offer PATIENCE,
              and let the official onchain
              manager determine the rest.
            </p>
          </div>

          <ConnectPill />
        </section>

        <AwakeningStats
          totalActivations={
            reads.totalActivations
          }
          totalLockedX={
            reads.totalLockedX
          }
          activationXAmount={
            reads.activationXAmount
          }
          activationYCost={
            reads.activationYCost
          }
          lockDuration={
            reads.lockDuration
          }
          solvent={
            reads.solvent
          }
        />

        {!isConnected ? (
          <section className="awakening-empty">
            <span>
              YOUR LORE LAND
            </span>

            <h2>
              Connect the keeper wallet.
            </h2>

            <p>
              Only Canonical Lore Deeds
              currently owned by the
              connected wallet are loaded
              here.
            </p>
          </section>
        ) : reads.deedsLoading ? (
          <section className="awakening-empty">
            <span>
              YOUR LORE LAND
            </span>

            <h2>
              Finding your land…
            </h2>

            <p>
              Reading the Canonical Lore
              Deeds held by this wallet.
            </p>
          </section>
        ) : reads.deeds.length === 0 ? (
          <section className="awakening-empty">
            <span>
              NO CANONICAL DEED FOUND
            </span>

            <h2>
              The awakening waits.
            </h2>

            <p>
              This connected wallet does
              not currently hold a
              Canonical Lore Land.
            </p>

            <Link
              prefetch={false}
              href="/world"
            >
              Explore the World ↗
            </Link>
          </section>
        ) : (
          <section className="awakening-deeds">
            {reads.deeds.map(
              (deed) => (
                <LoreActivationCard
                  key={
                    deed.tokenId
                  }
                  tokenId={
                    deed.tokenId
                  }
                  name={
                    deed.communityName
                  }
                  owner={
                    deed.owner
                  }
                  transferNonce={
                    deed.transferNonce
                  }
                  active={
                    deed.isActive
                  }
                  lockId={
                    deed.lockId
                  }
                  lock={
                    deed.lock
                  }
                  activationStarted={
                    reads.activationStarted
                  }
                  paused={
                    reads.activationPaused
                  }
                  xAmount={
                    reads.activationXAmount
                  }
                  yCost={
                    reads.activationYCost
                  }
                  lockDuration={
                    reads.lockDuration
                  }
                  tobyBalance={
                    reads.tobyBalance
                  }
                  patienceBalance={
                    reads.patienceBalance
                  }
                  stage={
                    actions.stage
                  }
                  message={
                    actions.message
                  }
                  hashes={
                    actions.hashes
                  }
                  onActivate={() =>
                    actions.activate(
                      BigInt(
                        deed.tokenId,
                      ),
                    )
                  }
                  onWithdraw={() =>
                    actions.withdraw(
                      deed.lockId,
                    )
                  }
                />
              ),
            )}
          </section>
        )}

        <ProductionPanel />

        <section className="awakening-trust">
          <strong>
            Onchain truth first.
          </strong>

          <p>
            Activation status comes from{" "}
            <code>
              isActive(tokenId)
            </code>
            . Economic requirements,
            pause state, balances, lock
            duration and exact lock state
            are read from the official
            contracts.
          </p>

          <p>
            A Lore Deed transfer can
            invalidate the current
            activation even while the
            original locker&apos;s TOBY
            remains locked until that
            lock&apos;s own{" "}
            <code>
              unlockTime
            </code>
            .
          </p>
        </section>
      </main>

      <Footer />

      <PondDock active="world" />
    </MiniAppGate>
  );
}
