export function assertDemoSeedAllowed(source: NodeJS.ProcessEnv) {
  if (source.NODE_ENV !== "development" || source.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Seed de demonstração exige NODE_ENV=development e ALLOW_DEMO_SEED=true em banco descartável.",
    );
  }
}
