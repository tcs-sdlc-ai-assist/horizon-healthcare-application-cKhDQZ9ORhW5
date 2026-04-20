/**
 * Cryptographic utility for audit trail tamper evidence.
 * Uses SHA-256 via Web Crypto API for hash chain integrity.
 * @module hashUtils
 */

/**
 * Converts an ArrayBuffer to a hex string.
 * @param {ArrayBuffer} buffer - The buffer to convert.
 * @returns {string} Hex string representation.
 */
function bufferToHex(buffer) {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a SHA-256 hash of the given data combined with the previous hash.
 * @param {string|object} data - The data to hash. Objects will be JSON-stringified.
 * @param {string} [previousHash=''] - The previous hash in the chain.
 * @returns {Promise<string>} The resulting SHA-256 hex digest.
 */
export async function generateHash(data, previousHash = '') {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const payload = `${previousHash}${dataString}`;
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    return bufferToHex(hashBuffer);
  } catch (error) {
    throw new Error(`Failed to generate hash: ${error.message}`);
  }
}

/**
 * Verifies the integrity of a hash chain in a series of audit logs.
 * Each log entry must have: { hash, data, previousHash }
 * @param {Array<{ hash: string, data: string|object, previousHash: string, action: string, user: string, timestamp: string }>} auditLogs - Ordered array of audit log entries.
 * @returns {Promise<{ valid: boolean, brokenAt: number|null, message: string }>} Verification result.
 */
export async function verifyChain(auditLogs) {
  if (!Array.isArray(auditLogs)) {
    return {
      valid: false,
      brokenAt: null,
      message: 'Audit logs must be an array.',
    };
  }

  if (auditLogs.length === 0) {
    return {
      valid: true,
      brokenAt: null,
      message: 'Empty chain is valid.',
    };
  }

  try {
    for (let i = 0; i < auditLogs.length; i++) {
      const entry = auditLogs[i];

      // Verify that previousHash links to the prior entry
      if (i === 0) {
        if (entry.previousHash !== '') {
          return {
            valid: false,
            brokenAt: 0,
            message: 'First entry must have an empty previousHash.',
          };
        }
      } else {
        const previousEntry = auditLogs[i - 1];
        if (entry.previousHash !== previousEntry.hash) {
          return {
            valid: false,
            brokenAt: i,
            message: `Chain broken at index ${i}: previousHash does not match prior entry hash.`,
          };
        }
      }

      // Reconstruct the hashable payload (same structure as createAuditEntry)
      const hashPayload = {
        action: entry.action,
        data: entry.data,
        user: entry.user,
        timestamp: entry.timestamp,
      };

      const expectedHash = await generateHash(hashPayload, entry.previousHash);

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          brokenAt: i,
          message: `Chain broken at index ${i}: hash does not match expected value. Possible tampering detected.`,
        };
      }
    }

    return {
      valid: true,
      brokenAt: null,
      message: 'Chain integrity verified successfully.',
    };
  } catch (error) {
    return {
      valid: false,
      brokenAt: null,
      message: `Verification failed: ${error.message}`,
    };
  }
}

/**
 * Creates a complete audit log entry with a cryptographic hash.
 * @param {string} action - The action being audited (e.g., 'CREATE', 'UPDATE', 'DELETE').
 * @param {string|object} data - The data associated with the action.
 * @param {string} user - The user performing the action.
 * @param {string} [previousHash=''] - The hash of the previous audit entry in the chain.
 * @returns {Promise<{ action: string, data: string|object, user: string, timestamp: string, previousHash: string, hash: string }>} The complete audit log entry.
 */
export async function createAuditEntry(action, data, user, previousHash = '') {
  if (!action || typeof action !== 'string') {
    throw new Error('Action must be a non-empty string.');
  }

  if (!user || typeof user !== 'string') {
    throw new Error('User must be a non-empty string.');
  }

  if (data === undefined || data === null) {
    throw new Error('Data must not be null or undefined.');
  }

  try {
    const timestamp = new Date().toISOString();

    const hashPayload = {
      action,
      data,
      user,
      timestamp,
    };

    const hash = await generateHash(hashPayload, previousHash);

    return {
      action,
      data,
      user,
      timestamp,
      previousHash,
      hash,
    };
  } catch (error) {
    throw new Error(`Failed to create audit entry: ${error.message}`);
  }
}