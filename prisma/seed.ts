/**
 * Database seed. The full seed (loading the assignment's sample shipment and
 * document through the real services) is implemented in a later step.
 */
async function main(): Promise<void> {
  console.log('Seed placeholder — implemented in the seed step.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
