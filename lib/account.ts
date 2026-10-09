import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";

export const MIN_PASSWORD_LENGTH = 8; // same rule as sign-up

// Change the signed-in person's OWN password (the caller passes the session's
// user id, never a client-supplied one). The current password must match; the
// new one must differ from it, so an account made with a password someone else
// chose (mustChangePassword) really ends up with one only its owner knows.
export async function changeOwnPassword(
  userId: number,
  input: { current: string; next: string; confirm: string },
): Promise<{ ok: true } | { error: string }> {
  if (input.next.length < MIN_PASSWORD_LENGTH) {
    return { error: `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (input.next !== input.confirm) return { error: "The two new passwords don't match." };
  if (input.next === input.current) return { error: "Pick a password different from the current one." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await verifyPassword(input.current, user.passwordHash))) {
    return { error: "Your current password isn't right." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.next), mustChangePassword: false },
  });
  return { ok: true };
}
