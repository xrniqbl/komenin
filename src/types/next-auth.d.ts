import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** True right after login when TOTP is enabled but not yet re-verified this session. */
      totpGate?: boolean;
    } & DefaultSession["user"];
    /** jti of the device session that produced this request — "current device" marker. */
    currentJti?: string;
  }

  interface User {
    /** Captured in credentials authorize() and persisted to LoginSession on sign-in. */
    deviceMeta?: { userAgent?: string; ip?: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** LoginSession row identifier (per-issued-token), used for device listing + revocation. */
    jti?: string;
    totpGate?: boolean;
    revoked?: boolean;
    /** Unix ms of the last revocation check — throttles the DB lookback. */
    rcAt?: number;
    /** Unix ms of the last lastSeenAt write — throttles DB updates. */
    lsAt?: number;
  }
}
