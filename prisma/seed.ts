import { prisma } from "../lib/db";

import { CATALOG } from "../lib/carCatalog";

const MODELS = CATALOG;

async function main() {
  for (const m of MODELS) {
    await prisma.carModel.upsert({
      where: { make_model: { make: m.make, model: m.model } },
      create: m,
      update: { category: m.category },
    });
  }
  console.log(`seeded ${MODELS.length} car models`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
