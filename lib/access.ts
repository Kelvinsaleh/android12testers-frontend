/**
 * The only administrator is fixed to the owner-selected Google account.
 * Call this only with identity data returned by Neon Auth on the server.
 * No browser-supplied email or role is accepted as proof.
 */
export const SOLE_ADMIN_EMAIL = "sksalee071@gmail.com";

export function isSoleAdministrator(
  verifiedEmail: string | null | undefined,
  emailVerified: boolean,
): boolean {
  return emailVerified === true &&
    typeof verifiedEmail === "string" &&
    verifiedEmail.trim().toLowerCase() === SOLE_ADMIN_EMAIL;
}

export function canViewRetestQueue(email: string | null | undefined, verified: boolean): boolean {
  return isSoleAdministrator(email, verified);
}

export function canApproveRetest(email: string | null | undefined, verified: boolean): boolean {
  return isSoleAdministrator(email, verified);
}
