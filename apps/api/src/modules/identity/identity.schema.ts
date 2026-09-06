import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const identityUsers = pgTable("identity_users", {
  id: text("id").primaryKey(),
  workosUserId: text("workos_user_id").notNull().unique(),
  email: text("email").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
  lastGlobalLogoutAt: instant("last_global_logout_at"),
  globalRevocationPending: boolean("global_revocation_pending").notNull().default(false),
  globalRevocationId: text("global_revocation_id"),
});

// A profile is personal. No household, organization, or email-based ownership is inferred.
export const identityProfiles = pgTable("identity_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => identityUsers.id),
  createdAt: instant("created_at").notNull().defaultNow(),
});

export const identitySessions = pgTable(
  "identity_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    workosSessionId: text("workos_session_id").notNull().unique(),
    tokenHash: text("token_hash").notNull().unique(),
    device: text("device").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    authenticatedAt: instant("authenticated_at"),
    lastSeenAt: instant("last_seen_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
    revokedAt: instant("revoked_at"),
    mfaVerifiedAt: instant("mfa_verified_at"),
    remoteRevocationPending: boolean("remote_revocation_pending").notNull().default(false),
  },
  (table) => [
    check("identity_sessions_hash", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check("identity_sessions_device_length", sql`length(${table.device}) <= 256`),
    check("identity_sessions_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
    index("identity_sessions_owner_list").on(table.userId, table.createdAt, table.id),
    index("identity_sessions_owner_pending").on(table.userId, table.remoteRevocationPending),
  ],
);

export const identityLogins = pgTable(
  "identity_logins",
  {
    stateHash: text("state_hash").primaryKey(),
    browserHash: text("browser_hash").notNull(),
    encryptedVerifier: text("encrypted_verifier").notNull(),
    surface: text("surface", { enum: ["client", "admin", "www"] }).notNull(),
    createdAt: instant("created_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    check("identity_logins_state_hash", sql`${table.stateHash} ~ '^[0-9a-f]{64}$'`),
    check("identity_logins_browser_hash", sql`${table.browserHash} ~ '^[0-9a-f]{64}$'`),
    check("identity_logins_surface", sql`${table.surface} in ('client', 'admin', 'www')`),
    check("identity_logins_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
    index("identity_logins_expiration_index").on(table.expiresAt),
  ],
);

// Deliberately no seed or public grant function. A grant needs an explicit identity and evidence.
export const identityAdminPermissions = pgTable(
  "identity_admin_permissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    permission: text("permission", { enum: ["administration.access"] }).notNull(),
    evidence: text("evidence").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    revokedAt: instant("revoked_at"),
  },
  (table) => [
    check("identity_admin_permission_name", sql`${table.permission} = 'administration.access'`),
    check("identity_admin_permission_evidence", sql`length(trim(${table.evidence})) > 0`),
    uniqueIndex("identity_admin_active_permission")
      .on(table.userId, table.permission)
      .where(sql`${table.revokedAt} is null`),
  ],
);

export const identityMfaChallenges = pgTable("identity_mfa_challenges", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => identitySessions.id),
  challengeId: text("challenge_id").notNull(),
  factorId: text("factor_id").notNull(),
  expiresAt: instant("expires_at").notNull(),
});

// A single owned enrollment prevents duplicate credentials. Only provider IDs are retained.
export const identityMfaEnrollments = pgTable(
  "identity_mfa_enrollments",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => identityUsers.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => identitySessions.id),
    operationId: text("operation_id").notNull().unique(),
    status: text("status", {
      enum: [
        "creating",
        "pending",
        "challenging",
        "verifying",
        "cancelling",
        "confirmed",
        "cancelled",
        "recovery",
      ],
    }).notNull(),
    factorId: text("factor_id"),
    challengeId: text("challenge_id"),
    challengeExpiresAt: instant("challenge_expires_at"),
    claimId: text("claim_id").notNull(),
    // An uncertain verification must never authorize deletion of a potentially confirmed factor.
    verificationUncertain: boolean("verification_uncertain").notNull().default(false),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  (table) => [
    check(
      "identity_mfa_enrollment_status",
      sql`${table.status} in ('creating', 'pending', 'challenging', 'verifying', 'cancelling', 'confirmed', 'cancelled', 'recovery')`,
    ),
    check(
      "identity_mfa_enrollment_factor",
      sql`${table.status} in ('creating', 'recovery', 'cancelled') or ${table.factorId} is not null`,
    ),
    check(
      "identity_mfa_enrollment_challenge",
      sql`(${table.challengeId} is null) = (${table.challengeExpiresAt} is null)`,
    ),
  ],
);

export const identityAuditEvents = pgTable(
  "identity_audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").references(() => identitySessions.id),
    action: text("action", {
      enum: [
        "login",
        "session.revoke",
        "sessions.revoke_all",
        "mfa.verify",
        "mfa.enrollment.start",
        "mfa.enrollment.challenge",
        "mfa.enrollment.verify",
        "mfa.enrollment.cancel_request",
        "mfa.enrollment.confirm",
        "mfa.enrollment.cancel",
      ],
    }).notNull(),
    requestId: text("request_id").notNull(),
    deduplicationKey: text("deduplication_key").notNull().unique(),
    revocationId: text("revocation_id"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [index("identity_audit_owner_date").on(table.userId, table.createdAt, table.id)],
);
