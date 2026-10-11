import { z } from "zod";
const common = { id: z.number().int().min(1).max(32767).nullable(), is_active: z.boolean() };
export const lookupSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("colleges"), name: z.string().trim().min(3).max(150), code: z.string().trim().regex(/^[A-Z0-9-]{2,15}$/, "Use 2–15 uppercase letters, digits or hyphens.") }),
  z.object({ ...common, kind: z.literal("programs"), name: z.string().trim().min(2).max(120), college_id: z.number().int().min(1).max(32767) }),
  z.object({ ...common, kind: z.literal("event_categories"), name: z.string().trim().min(2).max(60), slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."), sort_order: z.number().int().min(-32768).max(32767) }),
]);
export type LookupInput = z.infer<typeof lookupSchema>;
export type LookupKind = LookupInput["kind"];
