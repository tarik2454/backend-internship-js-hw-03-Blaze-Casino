import { z } from "zod";

export const userSignupSchema = z.object({
  username: z
    .string({ error: '"username" is a required field' })
    .min(2, { message: '"username" should have a minimum length of 2' })
    .max(20, { message: '"username" should have a maximum length of 20' }),
  password: z
    .string({ error: '"password" is a required field' })
    .min(6, { message: '"password" should have a minimum length of 6' }),
  email: z
    .string({ error: '"email" is a required field' })
    .pipe(z.email({ message: '"email" must be a valid email' })),
  avatarURL: z.string().optional(),
});

export const userSigninSchema = z.object({
  password: z
    .string({ error: '"password" is a required field' })
    .min(6, { message: '"password" should have a minimum length of 6' }),
  email: z
    .string({ error: '"email" is a required field' })
    .pipe(z.email({ message: '"email" must be a valid email' })),
});

export const userUpdateSchema = z.object({
  username: z
    .string()
    .min(2, { message: '"username" should have a minimum length of 2' })
    .max(20, { message: '"username" should have a maximum length of 20' })
    .optional(),
  avatarURL: z.string().optional(),
  balance: z.number().optional(),
  totalWagered: z.number().optional(),
  gamesPlayed: z.number().int().optional(),
  totalWon: z.number().optional(),
});

export type UserSignupDTO = z.infer<typeof userSignupSchema>;
export type UserSigninDTO = z.infer<typeof userSigninSchema>;
export type UserUpdateDTO = z.infer<typeof userUpdateSchema>;
