export type MeteredUsage = { cpuSeconds: number; memoryGiBSeconds: number; storageGiBHours: number; bandwidthGiB: number; buildMinutes: number; requestCount: number };
export type PriceBook = { cpuCentsPerSecond: number; memoryCentsPerGiBSecond: number; storageCentsPerGiBHour: number; bandwidthCentsPerGiB: number; buildCentsPerMinute: number; requestCentsPerMillion: number };

export function estimateUsageCents(usage: MeteredUsage, price: PriceBook): number {
  const cents = usage.cpuSeconds * price.cpuCentsPerSecond + usage.memoryGiBSeconds * price.memoryCentsPerGiBSecond + usage.storageGiBHours * price.storageCentsPerGiBHour + usage.bandwidthGiB * price.bandwidthCentsPerGiB + usage.buildMinutes * price.buildCentsPerMinute + (usage.requestCount / 1_000_000) * price.requestCentsPerMillion;
  return Math.max(0, Math.round(cents));
}
