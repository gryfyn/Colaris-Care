// Per-request tenant / user context.
//
// Previously this module simply re-exported getRequestContext from
// lib/auth-guard.js. That guard also pulls in RBAC (roles) and a Redis-backed
// token blacklist, which belong to the later RBAC / auth-API tasks — so to keep
// this lib-foundation task self-contained, the dependency-free context builder
// is inlined here. When auth-guard lands it should import getRequestContext from
// this module rather than redefining it.

/**
 * Build a request context object from a Next.js request + authenticated user.
 * This is the shape passed to the audit logger and to tenant-scoped DB helpers
 * (organization_id / facility_id live on `user`).
 *
 * @param {Request} request  Next.js / Web request
 * @param {object} [user]    authenticated user resolved from the access token
 * @returns {{ user: object, id: string|null, ip: string }}
 */
export function getRequestContext(request, user) {
  return {
    user: {
      id:             user?.id,
      staffId:        user?.staffId,
      tenantId:       user?.tenantId,
      organizationId: user?.organizationId,
      facilityId:     user?.facilityId,
      role:           user?.role,
      jti:            user?.jti,
    },
    id:  request.headers.get('x-request-id'),
    ip:  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
  };
}
