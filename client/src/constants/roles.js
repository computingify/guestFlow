// Client-side mirror of server/src/constants/roles.js. The server is the single source of truth
// (a server unit test snapshots ROLES + ROLE_LABELS to catch drift); this file is the read-only
// projection used by the UI (sidebar gating, role multi-select, status chips).

export const ADMIN = 'admin';
export const ACCOUNTANT = 'accountant';

export const ROLES = Object.freeze([ADMIN, ACCOUNTANT]);

export const ROLE_LABELS = Object.freeze({
  [ADMIN]: 'Admin',
  [ACCOUNTANT]: 'Comptable',
});

export function userHasRole(user, role) {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.includes(role);
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
