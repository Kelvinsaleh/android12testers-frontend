import "server-only";
import { getAuth } from "@/lib/auth/server";
import { isSoleAdministrator } from "@/lib/access";

export type PortalUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
};

function isVerified(value: unknown): boolean {
  return value === true;
}

export async function getCurrentUser(): Promise<PortalUser | null> {
  // Neon Auth's Next.js adapter returns `{ data: session, error }`.
  // The user object is nested under `data.user`.
  const result = await getAuth().getSession();
  // Neon Auth's server adapter has exposed both `{ data: { user } }` and
  // `{ user, session }` result shapes across SDK releases. Accept either
  // shape, but take the identity only from the server-validated Auth session.
  const response = result as {
    data?: { user?: Record<string, unknown> | null; session?: { user?: Record<string, unknown> | null } | null } | null;
    user?: Record<string, unknown> | null;
    session?: { user?: Record<string, unknown> | null } | null;
  };
  const user = response.user ?? response.session?.user ?? response.data?.user ?? response.data?.session?.user;
  const id = typeof user?.id === "string" ? user.id : "";
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!id || !email) return null;

  const emailVerified = isVerified(user?.emailVerified);
  const name = typeof user?.name === "string" ? user.name.slice(0, 160) : null;
  const image = typeof user?.image === "string" ? user.image.slice(0, 1000) : null;

  return {
    id,
    email,
    emailVerified,
    name,
    image,
    isAdmin: isSoleAdministrator(email, emailVerified),
  };
}

export async function requireUser(): Promise<PortalUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function requireAdmin(): Promise<PortalUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}

export class AuthRequiredError extends Error {
  readonly status = 401;
  constructor() { super("Sign in with Google to continue."); }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() { super("You do not have permission to access this resource."); }
}
