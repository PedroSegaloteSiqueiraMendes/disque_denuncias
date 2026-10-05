import { z } from "zod";

export const complaintSchema = z.object({
  companySlug: z.string().min(1), category: z.string().min(1), unit: z.string().optional(),
  department: z.string().optional(), occurredPeriod: z.enum(["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "OVER_30_DAYS", "UNKNOWN"]),
  isRecurring: z.boolean().nullable(), isStillOccurring: z.boolean().nullable(), description: z.string().trim().min(20).max(12000), goodFaith: z.literal(true)
});
