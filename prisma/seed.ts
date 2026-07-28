import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Curated, not exhaustive — the makes/models that actually show up on
// Egyptian ride-hailing roads (Uber/Careem/inDrive), skewed toward compact
// sedans/hatchbacks that dominate the fleet. Grows over time as drivers hit
// "Other" and ask for a model that's missing; no need to be complete on day one.
const MODELS: { make: string; model: string; category: string }[] = [
  // Toyota
  { make: "Toyota", model: "Corolla", category: "SEDAN" },
  { make: "Toyota", model: "Yaris", category: "HATCHBACK" },
  { make: "Toyota", model: "Camry", category: "SEDAN" },
  { make: "Toyota", model: "Corona", category: "SEDAN" },
  { make: "Toyota", model: "Rav4", category: "SUV" },
  // Hyundai
  { make: "Hyundai", model: "Elantra", category: "SEDAN" },
  { make: "Hyundai", model: "Accent", category: "SEDAN" },
  { make: "Hyundai", model: "Verna", category: "SEDAN" },
  { make: "Hyundai", model: "Avante", category: "SEDAN" },
  { make: "Hyundai", model: "i10", category: "HATCHBACK" },
  { make: "Hyundai", model: "i20", category: "HATCHBACK" },
  { make: "Hyundai", model: "Tucson", category: "SUV" },
  // Kia
  { make: "Kia", model: "Cerato", category: "SEDAN" },
  { make: "Kia", model: "Rio", category: "SEDAN" },
  { make: "Kia", model: "Picanto", category: "HATCHBACK" },
  { make: "Kia", model: "Sportage", category: "SUV" },
  // Nissan
  { make: "Nissan", model: "Sunny", category: "SEDAN" },
  { make: "Nissan", model: "Sentra", category: "SEDAN" },
  { make: "Nissan", model: "Tiida", category: "HATCHBACK" },
  // Chevrolet
  { make: "Chevrolet", model: "Lanos", category: "SEDAN" },
  { make: "Chevrolet", model: "Optra", category: "SEDAN" },
  { make: "Chevrolet", model: "Aveo", category: "SEDAN" },
  { make: "Chevrolet", model: "Cruze", category: "SEDAN" },
  // MG
  { make: "MG", model: "MG5", category: "SEDAN" },
  { make: "MG", model: "MG6", category: "SEDAN" },
  { make: "MG", model: "ZS", category: "SUV" },
  // Fiat
  { make: "Fiat", model: "Tipo", category: "SEDAN" },
  { make: "Fiat", model: "128", category: "SEDAN" },
  { make: "Fiat", model: "Punto", category: "HATCHBACK" },
  // Skoda
  { make: "Skoda", model: "Octavia", category: "SEDAN" },
  { make: "Skoda", model: "Rapid", category: "SEDAN" },
  // Renault
  { make: "Renault", model: "Logan", category: "SEDAN" },
  { make: "Renault", model: "Fluence", category: "SEDAN" },
  { make: "Renault", model: "Megane", category: "SEDAN" },
  // Peugeot
  { make: "Peugeot", model: "301", category: "SEDAN" },
  { make: "Peugeot", model: "508", category: "SEDAN" },
  { make: "Peugeot", model: "208", category: "HATCHBACK" },
  // BYD
  { make: "BYD", model: "F3", category: "SEDAN" },
  { make: "BYD", model: "e2", category: "HATCHBACK" },
  { make: "BYD", model: "Han", category: "SEDAN" },
  // Geely
  { make: "Geely", model: "Emgrand", category: "SEDAN" },
  // Chery
  { make: "Chery", model: "Tiggo", category: "SUV" },
  { make: "Chery", model: "Arrizo", category: "SEDAN" },
  // Great Wall / Haval
  { make: "Haval", model: "Jolion", category: "SUV" },
  // Suzuki
  { make: "Suzuki", model: "Swift", category: "HATCHBACK" },
  { make: "Suzuki", model: "Alto", category: "HATCHBACK" },
  // Mitsubishi
  { make: "Mitsubishi", model: "Lancer", category: "SEDAN" },
  { make: "Mitsubishi", model: "Attrage", category: "SEDAN" },
  // Volkswagen
  { make: "Volkswagen", model: "Jetta", category: "SEDAN" },
  { make: "Volkswagen", model: "Passat", category: "SEDAN" },
  // Daihatsu (older, still common)
  { make: "Daihatsu", model: "Charade", category: "HATCHBACK" },
];

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
