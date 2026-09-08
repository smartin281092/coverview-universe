import { z } from "zod";

export const adminUserIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
export const adminUsersQuerySchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,1000}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();
export const adminUserSchema = z.object({
  id: adminUserIdSchema,
  email: z.email(),
  displayName: z.string().max(320).nullable(),
  createdAt: z.iso.datetime(),
});
export const adminUsersSchema = z.object({
  users: z.array(adminUserSchema).max(50),
  nextCursor: z.string().max(1000).nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUsers = z.infer<typeof adminUsersSchema>;
export type AdminUsersQuery = z.input<typeof adminUsersQuerySchema>;
