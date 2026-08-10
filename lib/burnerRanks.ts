export type BurnerTitleKey = "crown" | "keeper" | "inferno" | "guardian" | "ripple" | "spark" | "ember";

export type BurnerTitle = {
  key: BurnerTitleKey;
  title: string;
  short: string;
};

export function burnerTitleForRank(rank: number): BurnerTitle {
  if (rank <= 1) return { key: "crown", title: "Crown of the Pond", short: "Pond Crown" };
  if (rank <= 3) return { key: "keeper", title: "Flame Keeper", short: "Flame Keeper" };
  if (rank <= 10) return { key: "inferno", title: "Inferno Toad", short: "Inferno Toad" };
  if (rank <= 25) return { key: "guardian", title: "Ember Guardian", short: "Ember Guardian" };
  if (rank <= 50) return { key: "ripple", title: "Ripple Burner", short: "Ripple Burner" };
  if (rank <= 100) return { key: "spark", title: "Pond Spark", short: "Pond Spark" };
  return { key: "ember", title: "First Flame", short: "First Flame" };
}
