import "server-only";
import { auth } from "./auth";

/**
 * Guard for admin server actions and API routes.
 *
 * Every admin mutation calls this first — the /admin layout guard protects
 * pages, but server actions are independently invokable endpoints and must
 * enforce the role themselves.
 */
export async function requireAdminActor() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.role !== "ADMIN") {
    throw new Error("Not authorised.");
  }
  return user;
}
