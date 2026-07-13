import "server-only";

type FieldType = "string" | "number" | "int" | "date" | "boolean";

export type EntityConfig = {
  model: string; // prisma delegate name
  fields: Record<string, FieldType>;
  orderBy: Record<string, "asc" | "desc">;
};

export const ENTITIES: Record<string, EntityConfig> = {
  vehicles: {
    model: "vehicle",
    orderBy: { createdAt: "desc" },
    fields: {
      name: "string",
      make: "string",
      model: "string",
      year: "int",
      plate: "string",
      fuelSetup: "string",
      ownership: "string",
      purchasePrice: "number",
      estimatedValue: "number",
      monthlyInstallment: "number",
      dailyRentalFee: "number",
      targetOwnerShare: "number",
      depreciationPerKm: "number",
      initialOdometer: "number",
      notes: "string",
      isActive: "boolean",
    },
  },
  shifts: {
    model: "shift",
    orderBy: { startTime: "desc" },
    fields: {
      vehicleId: "string",
      startTime: "date",
      endTime: "date",
      startOdometer: "number",
      endOdometer: "number",
      startPhoto: "string",
      endPhoto: "string",
      notes: "string",
    },
  },
  trips: {
    model: "trip",
    orderBy: { startTime: "desc" },
    fields: {
      vehicleId: "string",
      shiftId: "string",
      platform: "string",
      startTime: "date",
      endTime: "date",
      distanceKm: "number",
      fare: "number",
      commission: "number",
      paymentType: "string",
      tip: "number",
      source: "string",
      notes: "string",
    },
  },
  tips: {
    model: "cashTip",
    orderBy: { date: "desc" },
    fields: {
      vehicleId: "string",
      shiftId: "string",
      date: "date",
      amount: "number",
      notes: "string",
    },
  },
  fuelups: {
    model: "fuelUp",
    orderBy: { date: "desc" },
    fields: {
      vehicleId: "string",
      date: "date",
      odometer: "number",
      fuelType: "string",
      quantity: "number",
      pricePerUnit: "number",
      totalCost: "number",
      fullTank: "boolean",
      station: "string",
      photo: "string",
      notes: "string",
    },
  },
  maintenance: {
    model: "maintenance",
    orderBy: { date: "desc" },
    fields: {
      vehicleId: "string",
      date: "date",
      odometer: "number",
      category: "string",
      description: "string",
      cost: "number",
      photo: "string",
      notes: "string",
    },
  },
  expenses: {
    model: "expense",
    orderBy: { date: "desc" },
    fields: {
      vehicleId: "string",
      date: "date",
      category: "string",
      amount: "number",
      odometer: "number",
      isWork: "boolean",
      notes: "string",
    },
  },
  reminders: {
    model: "reminder",
    orderBy: { createdAt: "desc" },
    fields: {
      vehicleId: "string",
      title: "string",
      dueDate: "date",
      dueOdometer: "number",
      repeatKm: "number",
      repeatMonths: "int",
      lastDoneDate: "date",
      lastDoneOdometer: "number",
      active: "boolean",
      notes: "string",
    },
  },
};

// Nullable columns where an empty value should explicitly clear/skip via null.
const NULLABLE_OK = new Set([
  "endTime",
  "endOdometer",
  "shiftId",
  "distanceKm",
  "commission",
  "dueDate",
  "dueOdometer",
  "repeatKm",
  "repeatMonths",
  "odometer:maintenance",
]);

/** Coerce a JSON body into typed prisma data; empty optional values are omitted. */
export function coerceBody(
  config: EntityConfig,
  body: Record<string, unknown>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [field, type] of Object.entries(config.fields)) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === "" || raw === null || raw === undefined) {
      // null only where the column is nullable; otherwise omit so Prisma
      // defaults apply (e.g. tip, fullTank) instead of erroring on null
      if (NULLABLE_OK.has(field)) data[field] = null;
      continue;
    }
    switch (type) {
      case "string":
        data[field] = String(raw);
        break;
      case "number":
        data[field] = Number(raw);
        break;
      case "int":
        data[field] = Math.trunc(Number(raw));
        break;
      case "date":
        data[field] = new Date(String(raw));
        break;
      case "boolean":
        data[field] = raw === true || raw === "true" || raw === "on" || raw === 1;
        break;
    }
  }
  return data;
}
