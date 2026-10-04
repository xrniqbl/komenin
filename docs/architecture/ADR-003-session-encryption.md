# ADR-003: Session Encryption & Data Protection

## Status

**Accepted** - 2026-08-24

## Context

Komenin menyimpan sensitive data dari multiple social media platforms:

1. **OAuth tokens**: Access tokens, refresh tokens untuk Instagram, Threads, TikTok
2. **Session blobs**: Encrypted session data untuk proxy routing
3. **Webhook secrets**: Signing keys untuk webhook verification
4. **API credentials**: Platform-specific API keys

Security requirements:
- **At rest**: All sensitive data must be encrypted in database
- **Key rotation**: Must support rotating encryption keys without re-enrolling users
- **Breach resistance**: If DB is compromised, attacker cannot easily decrypt data
- **Audit trail**: Track who accessed what encrypted data when

## Decision

Menerapkan **Multi-Version Encrypted Storage Pattern** dengan Key Rotation Support:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Protection Layer                      │
├──────────────────────────────────────┬──────────────────────┤
│          Encryption Service          │     Key Manager      │
├──────────────────────────────────────┼──────────────────────┤
│                                      │                       │
│  ┌────────────────────────────────┐  │  ┌──────────────┐   │
│  │ ENCRYPTION_KEY (ENV)           │  │  │   Key Ver    │   │
│  │ 64-char hex string             │──┼──│   sion No.   │   │
│  │                                │  │  └──────────────┘   │
│  │ AES-256-GCM Algorithm          │  │       |             │
│  │ Nonce-based per-record         │  │  ┌──────────────┐   │
│  │ Auth tags for integrity        │  │  │   Key Vault   │   │
│  │                                │  │  │ (Planned)    │   │
│  └────────────────────────────────┘  │  └──────────────┘   │
│                                      │                       │
│  ┌────────────────────────────────┐  │  ┌──────────────┐   │
│  │ Per-field Encryption Strategy  │  │  │ Key Rotation  │   │
│  │ • Refresh tokens               │  │  │   Handler     │   │
│  │ • Session blobs                │  │  └──────────────┘   │
│  │ • Webhook secrets              │  │                       │
│  └────────────────────────────────┘  └──────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Design

```prisma
// Example: ConnectorCredential model
model ConnectorCredential {
  id                 String   @id @default(cuid())
  workspaceId        String
  socialAccountId    String?
  provider           String
  label              String?
  accessTokenEnc     String   @db.Text  // Always encrypted
  refreshTokenEnc    String?  @db.Text  // Optional, always encrypted
  apiBaseUrl         String?
  scopes             String[]
  expiresAt          DateTime?
  keyVersion         Int      @default(1) // Which key version used
  isActive           Boolean  @default(true)
}
```

### Encryption Service Implementation

```typescript
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // bytes
const NONCE_LENGTH = 12; // bytes
const TAG_LENGTH = 16; // bytes

export class EncryptionService {
  private key: Buffer;
  private keyVersion: number;
  
  constructor(encryptionKey: string, currentVersion?: number) {
    // Validate and load encryption key
    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters');
    }
    
    this.key = Buffer.from(encryptionKey, 'hex');
    this.keyVersion = currentVersion ?? 1;
  }
  
  /**
   * Encrypt plaintext using AES-256-GCM
   */
  encrypt(plaintext: string, customKeyVersion?: number): EncryptedData {
    const version = customKeyVersion ?? this.keyVersion;
    const nonce = crypto.randomBytes(NONCE_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, nonce);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext: encrypted,
      nonce: nonce.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: version,
    };
  }
  
  /**
   * Decrypt encrypted data
   */
  decrypt(data: EncryptedData): string {
    const { ciphertext, nonce, authTag, keyVersion } = data;
    
    // Verify key version
    if (keyVersion > this.keyVersion) {
      throw new Error(`Encryption key version ${keyVersion} not supported`);
    }
    
    const nonceBuf = Buffer.from(nonce, 'hex');
    const tagBuf = Buffer.from(authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, nonceBuf);
    decipher.setAuthTag(tagBuf);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Rotate encryption key (planned feature)
   */
  async rotateKey(newKey: string): Promise<void> {
    // 1. Generate new key pair
    const newBuffer = Buffer.from(newKey, 'hex');
    
    // 2. Start dual-read mode (old + new keys available)
    this.oldKey = this.key;
    this.oldKeyVersion = this.keyVersion;
    
    // 3. Update to new key
    this.key = newBuffer;
    this.keyVersion++;
    
    // 4. Queue background job to re-encrypt all records with new key
    await queueKeyRotationJob(this.oldKeyVersion, this.keyVersion);
  }
}

interface EncryptedData {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: number;
}
```

### Field-Level Encryption Strategy

```typescript
// src/lib/encryption.ts

export function encryptConnectorCredential(
  credential: Omit<ConnectorCredential, 'accessTokenEnc' | 'refreshTokenEnc' | 'keyVersion'>
): CreateConnectorCredentialInput {
  const encryption = getEncryptionService();
  
  return {
    ...credential,
    accessTokenEnc: encryption.encrypt(credential.accessToken),
    refreshTokenEnc: credential.refreshToken 
      ? encryption.encrypt(credential.refreshToken) 
      : null,
    keyVersion: 1, // Initial version
  };
}

export function decryptConnectorCredential(
  credential: ConnectorCredential & { accessTokenEnc: string; refreshTokenEnc?: string }
): DecryptedConnectorCredential {
  const encryption = getEncryptionService();
  
  return {
    ...credential,
    accessToken: encryption.decrypt({
      ciphertext: credential.accessTokenEnc,
      nonce: '', // Would need to store separately
      authTag: '',
      keyVersion: credential.keyVersion,
    }),
    refreshToken: credential.refreshTokenEnc 
      ? encryption.decrypt({
          ciphertext: credential.refreshTokenEnc,
          nonce: '',
          authTag: '',
          keyVersion: credential.keyVersion,
        })
      : undefined,
  };
}
```

### Key Management Strategy

#### Current Approach (Simple)

All encryption keys stored in environment variable `ENCRYPTION_KEY`:

```bash
# Generate secure key
openssl rand -hex 32

# Set in production
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

**Pros:**
- Simple implementation
- No external dependencies
- Keys rotate with deployment

**Cons:**
- Manual key rotation process
- Downtime during rotation
- No audit trail for key access

#### Future Enhancement (Vault Integration)

```typescript
// Future: integrate with HashiCorp Vault or AWS KMS
interface KeyVault {
  getKey(version: number): Promise<Buffer>;
  generateNewKey(): Promise<{ key: Buffer; version: number }>;
  rotateKey(oldVersion: number, newKey: Buffer): Promise<number>;
  auditAccess(keyId: string, userId: string, timestamp: Date): void;
}
```

### Migration Strategy for Key Rotation

When `ENCRYPTION_KEY` needs to change:

```bash
# Step 1: Set both old and new key temporarily (via app config)
NEW_ENCRYPTION_KEY="new-key-here"
OLD_ENCRYPTION_KEY="current-key-here"

# Step 2: Restart app with dual-read capability
# App can now read with both keys

# Step 3: Run migration to re-encrypt with new key
npm run migrate:rekey --from-version=1 --to-version=2

# Step 4: Verify no errors, then remove old key
# Remove OLD_ENCRYPTION_KEY from config
```

### Security Controls

#### 1. Access Control

```typescript
// Middleware to validate access to encrypted data
export async function requireEncryptionAccess(
  user: User,
  resource: ConnectorCredential
): Promise<boolean> {
  // Check user has permission to view workspace
  const membership = await db.membership.findFirst({
    where: {
      userId: user.id,
      workspaceId: resource.workspaceId,
      status: 'active',
    },
  });
  
  if (!membership) {
    throw new ForbiddenError('Cannot access encrypted credentials');
  }
  
  // Log access attempt (without exposing data)
  await auditLog({
    userId: user.id,
    action: 'accessed_encrypted_data',
    resourceId: resource.id,
    metadata: { dataType: 'connector_credential' },
  });
  
  return true;
}
```

#### 2. Audit Logging

```typescript
// Track all decryption operations
async function logDecryptionAttempt(
  userId: string,
  resourceId: string,
  success: boolean,
  error?: string
) {
  await auditLog({
    action: success ? 'decrypted_encrypted_data' : 'failed_decryption_attempt',
    userId,
    resourceId,
    metadata: {
      success,
      errorMessage: error,
      ip: request.ip,
      userAgent: request.userAgent,
    },
  });
}
```

#### 3. Rate Limiting on Decryption

```typescript
// Prevent brute-force attempts
const RATE_LIMIT_WINDOW = 1000 * 60 * 5; // 5 minutes
const MAX_DECRYPTION_ATTEMPTS = 100;

async function checkDecryptionRateLimit(userId: string, resourceType: string) {
  const key = `rate_limit:${userId}:${resourceType}:decryption`;
  
  const count = await rateLimiter.increment(key, RATE_LIMIT_WINDOW);
  
  if (count > MAX_DECRYPTION_ATTEMPTS) {
    throw new TooManyRequestsError('Too many decryption attempts');
  }
}
```

### Environment Configuration

```bash
# Required in ALL environments
ENCRYPTION_KEY="<64-hex-characters>"  # Generate with openssl rand -hex 32

# Optional: For key rotation support
OLD_ENCRYPTION_KEY="<previous-key>"    # Only set during rotation window

# Version tracking (auto-incremented by application)
ENCRYPTION_KEY_VERSION=1

# Feature flags
ENABLE_KEY_ROTATION=true
ENABLE_DECRYPTION_AUDIT=true
```

### Testing Strategy

```typescript
// tests/unit/encryption.test.ts
import { EncryptionService } from '@/lib/encryption';

describe('Encryption Service', () => {
  const testKey = 'a'.repeat(64);
  const encryption = new EncryptionService(testKey);
  
  it('should encrypt and decrypt successfully', () => {
    const original = 'sensitive-data';
    const encrypted = encryption.encrypt(original);
    const decrypted = encryption.decrypt(encrypted);
    
    expect(decrypted).toBe(original);
  });
  
  it('should produce different ciphertext for same plaintext', () => {
    const original = 'same-data';
    const enc1 = encryption.encrypt(original);
    const enc2 = encryption.encrypt(original);
    
    // Nonce ensures different output each time
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });
  
  it('should reject tampered ciphertext', () => {
    const original = 'test-data';
    const encrypted = encryption.encrypt(original);
    
    // Tamper with ciphertext
    encrypted.ciphertext = 'tampered-' + encrypted.ciphertext;
    
    expect(() => encryption.decrypt(encrypted)).toThrow();
  });
});
```

## Rationale

**Why AES-256-GCM?**
1. **Industry standard**: Widely trusted algorithm
2. **Authenticated encryption**: Provides both confidentiality and integrity
3. **Performance**: Hardware acceleration available on most CPUs
4. **Nonce-based**: Each encryption produces unique ciphertext even for same input

**Why store nonce and auth tag alongside ciphertext?**
- GCM mode requires them for decryption
- They're not secret (just needed for the algorithm to work)
- Storing together simplifies data retrieval

**Why key versioning?**
- Allows seamless key rotation without downtime
- Tracks which key was used for each record
- Enables gradual migration to new keys

**Why not use platform KMS immediately?**
- Simpler to self-manage initially
- Can add KMS later with minimal code changes
- Keeps deployment simpler for small-scale deployments

## Consequences

### Positive
- ✅ Sensitive data protected at rest
- ✅ Brute-force attacks ineffective (need encryption key)
- ✅ Key rotation possible without re-enrollment
- ✅ Integrity verification via auth tags
- ✅ Deterministic testing with consistent keys

### Negative
- ❌ Encryption adds ~10-50ms latency per operation
- ❌ Cannot perform search/index on encrypted fields
- ❌ Key recovery required if key lost (data unrecoverable!)
- ❌ Need careful key backup/restore procedures

### Mitigation Strategies

1. **Backup encryption keys securely**: Use secret manager (HashiCorp Vault, AWS Secrets Manager)
2. **Document recovery procedure**: Clear steps for key loss scenarios
3. **Monitor decryption performance**: Alert on latency spikes
4. **Use secondary indexes strategically**: Index non-sensitive fields that can filter results before decryption

## Related Decisions

- [ADR-004: Database Schema Design](./ADR-004-database-design.md)
- [ADR-007: API Authentication Strategy](./ADR-007-api-auth.md)
- [ADR-008: Audit Log Retention Policy](./ADR-008-audit-retention.md)

## References

- [PRODUCTION-CHECKLIST.md - Encryption Key Section](../PRODUCTION-CHECKLIST.md)
- [Environment Configuration (.env)](../../.env)
- [Security Testing Suite](../../tests/unit/security.test.ts)
