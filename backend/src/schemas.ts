import { z } from "zod";

export const filingsQuerySchema = z.object({
  form: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export type FilingsQuery = z.infer<typeof filingsQuerySchema>;
