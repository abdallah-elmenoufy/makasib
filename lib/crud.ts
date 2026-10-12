import "server-only";

type FieldType = "string" | "number" | "int" | "date" | "boolean";

export type EntityConfig = {
  model: string; // prisma delegate name
  fields: Record<string, FieldType>;
  orderBy: Record<string, "asc" | "desc">;
  /** NOT-NULL columns (schema requires a value): empty input is ignored so
   *  Prisma defaults/existing values stand. Every other field: empty = clear. */
  required: string[];
};

export const ENTITIES: Record<string, EntityConfig> = {
  vehicles: {
    model: "vehicle",
    orderBy: { createdAt: "desc" },
    required: ["name", "fuelSetup", "ownership", "initialOdometer", "isActive", "depreciationMethod", "depreciationEnabled"],
    fields: {
      name: "string",
      make: "string",
      model: "string",
      carModelId: "string",
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
      depreciationMethod: "string",
      depreciationEnabled: "boolean",
      mileageSensitivityPct: "number",
      lifetimeKm: "number",
      initialOdometer: "number",
      notes: "string",
      isActive: "boolean",
      weeklyHoursGoal: "number",
      weeklyProfitGoal: "number",
    },
  },
  shifts: {
    model: "shift",
    orderBy: { startTime: "desc" },
    required: ["vehicleId", "startTime", "startOdometer"],
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
    required: ["vehicleId", "platform", "startTime", "fare", "paymentType", "tip", "source"],
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
      pickupKm: "number",
      pickupMin: "number",
      durationMin: "number",
      pickupLat: "number",
      pickupLng: "number",
      dropoffLat: "number",
      dropoffLng: "number",
      pickupAddress: "string",
      dropoffAddress: "string",
      source: "string",
      notes: "string",
    },
  },
  tips: {
    model: "cashTip",
    orderBy: { date: "desc" },
    required: ["vehicleId", "date", "amount"],
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
    required: ["vehicleId", "date", "odometer", "fuelType", "quantity", "pricePerUnit", "totalCost", "fullTank"],
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
    required: ["vehicleId", "date", "category", "cost"],
    fields: {
      vehicleId: "string",
      date: "date",
      odometer: "number",
      category: "string",
      description: "string",
      cost: "number",
      lifetimeKm: "number",
      photo: "string",
      notes: "string",
    },
  },
  expenses: {
    model: "expense",
    orderBy: { date: "desc" },
    required: ["vehicleId", "date", "category", "amount", "isWork"],
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
    required: ["vehicleId", "title", "active"],
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

/** Coerce a JSON body into typed prisma data. Empty values CLEAR nullable
 *  columns (null) and are ignored for required ones — so a user emptying a
 *  field like depreciationPerKm genuinely removes the stored value. */
export function coerceBody(
  config: EntityConfig,
  body: Record<string, unknown>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [field, type] of Object.entries(config.fields)) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === "" || raw === null || raw === undefined) {
      if (!config.required.includes(field)) data[field] = null;
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
