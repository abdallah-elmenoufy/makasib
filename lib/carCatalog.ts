// The car catalog: the makes/models that actually show up on Egyptian
// ride-hailing roads (Uber/Careem/inDrive), skewed toward the compact sedans
// and hatchbacks that dominate the fleet. Shared by the seed script, the
// catalog API (which tops the table up automatically, so a new entry here
// appears without re-seeding) and the car renders (body type by name).
// Grows as drivers hit "Other" and ask for a missing model.

export type CatalogEntry = { make: string; model: string; category: "SEDAN" | "HATCHBACK" | "SUV" | "MPV" };

export const CATALOG: CatalogEntry[] = [
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
  // Speranza (Modern Motors, Egypt)
  { make: "Speranza", model: "A516", category: "SEDAN" },
  { make: "Speranza", model: "A113", category: "HATCHBACK" },
  { make: "Speranza", model: "A620", category: "SEDAN" },
  { make: "Speranza", model: "Tiggo", category: "SUV" },
  // more of what Egyptian riders actually get
  { make: "Kia", model: "Pegas", category: "SEDAN" },
  { make: "Proton", model: "Saga", category: "SEDAN" },
  { make: "Toyota", model: "Belta", category: "SEDAN" },
  { make: "Citroen", model: "C-Elysee", category: "SEDAN" },
  { make: "Opel", model: "Astra", category: "SEDAN" },
  { make: "Renault", model: "Duster", category: "SUV" },
  { make: "Nissan", model: "Qashqai", category: "SUV" },
  { make: "Mitsubishi", model: "Xpander", category: "MPV" },
  { make: "Suzuki", model: "Ertiga", category: "MPV" },
  { make: "Toyota", model: "Innova", category: "MPV" },
];

/** Body category for a make/model pair, from the catalog (case-insensitive). */
export function catalogCategory(make: string | null | undefined, model: string | null | undefined): CatalogEntry["category"] | null {
  if (!make && !model) return null;
  const mk = (make ?? "").trim().toLowerCase();
  const md = (model ?? "").trim().toLowerCase();
  const hit = CATALOG.find((c) => c.make.toLowerCase() === mk && c.model.toLowerCase() === md) ?? CATALOG.find((c) => md && c.model.toLowerCase() === md);
  return hit?.category ?? null;
}
