/**
 * LocalStorage abstraction service with JSON serialization/deserialization,
 * error handling, quota detection, and namespaced key management.
 * @module storageService
 */

const NAMESPACE_PREFIX = 'horizon_';

/**
 * Builds a namespaced storage key.
 * @param {string} key - The base key name.
 * @returns {string} The namespaced key with the horizon_ prefix.
 */
function getNamespacedKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Storage key must be a non-empty string.');
  }

  if (key.startsWith(NAMESPACE_PREFIX)) {
    return key;
  }

  return `${NAMESPACE_PREFIX}${key}`;
}

/**
 * Checks whether localStorage is available in the current environment.
 * @returns {boolean} True if localStorage is accessible.
 */
function isStorageAvailable() {
  try {
    const testKey = `${NAMESPACE_PREFIX}__storage_test__`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determines whether an error is a quota exceeded error.
 * @param {Error} error - The error to check.
 * @returns {boolean} True if the error indicates storage quota has been exceeded.
 */
function isQuotaExceededError(error) {
  if (!error) {
    return false;
  }

  return (
    error.code === 22 ||
    error.code === 1014 ||
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    (error.message && error.message.toLowerCase().includes('quota'))
  );
}

/**
 * Formats a storage error into a user-friendly message.
 * @param {Error} error - The original error.
 * @param {string} operation - The operation that failed (e.g., 'get', 'set', 'remove').
 * @param {string} key - The storage key involved.
 * @returns {string} A user-friendly error message.
 */
function formatStorageError(error, operation, key) {
  if (isQuotaExceededError(error)) {
    return `Storage quota exceeded while trying to ${operation} "${key}". Please clear some data and try again.`;
  }

  return `Failed to ${operation} "${key}" in storage: ${error.message || 'Unknown error'}`;
}

/**
 * Retrieves a value from localStorage by key, with JSON deserialization.
 * @param {string} key - The storage key (will be namespaced automatically).
 * @param {*} [defaultValue=null] - The default value to return if the key does not exist or an error occurs.
 * @returns {*} The deserialized value, or the default value if not found or on error.
 */
export function getItem(key, defaultValue = null) {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available. Returning default value.');
    return defaultValue;
  }

  try {
    const namespacedKey = getNamespacedKey(key);
    const rawValue = localStorage.getItem(namespacedKey);

    if (rawValue === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(rawValue);
    } catch {
      return rawValue;
    }
  } catch (error) {
    console.error(formatStorageError(error, 'get', key));
    return defaultValue;
  }
}

/**
 * Stores a value in localStorage with JSON serialization.
 * @param {string} key - The storage key (will be namespaced automatically).
 * @param {*} value - The value to store. Will be JSON-serialized.
 * @returns {{ success: boolean, error: string|null }} Result object indicating success or failure.
 */
export function setItem(key, value) {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'localStorage is not available in this environment.',
    };
  }

  try {
    const namespacedKey = getNamespacedKey(key);
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(namespacedKey, serializedValue);
    return { success: true, error: null };
  } catch (error) {
    const message = formatStorageError(error, 'set', key);
    console.error(message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Removes a value from localStorage by key.
 * @param {string} key - The storage key (will be namespaced automatically).
 * @returns {{ success: boolean, error: string|null }} Result object indicating success or failure.
 */
export function removeItem(key) {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: 'localStorage is not available in this environment.',
    };
  }

  try {
    const namespacedKey = getNamespacedKey(key);
    localStorage.removeItem(namespacedKey);
    return { success: true, error: null };
  } catch (error) {
    const message = formatStorageError(error, 'remove', key);
    console.error(message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Clears all namespaced (horizon_) keys from localStorage.
 * Does NOT remove non-namespaced keys to avoid affecting other applications.
 * @returns {{ success: boolean, removedCount: number, error: string|null }} Result object with count of removed keys.
 */
export function clear() {
  if (!isStorageAvailable()) {
    return {
      success: false,
      removedCount: 0,
      error: 'localStorage is not available in this environment.',
    };
  }

  try {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(NAMESPACE_PREFIX)) {
        keysToRemove.push(storageKey);
      }
    }

    keysToRemove.forEach((storageKey) => {
      localStorage.removeItem(storageKey);
    });

    return {
      success: true,
      removedCount: keysToRemove.length,
      error: null,
    };
  } catch (error) {
    const message = `Failed to clear namespaced storage: ${error.message || 'Unknown error'}`;
    console.error(message);
    return {
      success: false,
      removedCount: 0,
      error: message,
    };
  }
}

/**
 * Returns all namespaced keys currently stored in localStorage.
 * @returns {string[]} Array of keys (without the namespace prefix).
 */
export function getAllKeys() {
  if (!isStorageAvailable()) {
    return [];
  }

  try {
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(NAMESPACE_PREFIX)) {
        keys.push(storageKey.slice(NAMESPACE_PREFIX.length));
      }
    }

    return keys;
  } catch (error) {
    console.error(`Failed to retrieve storage keys: ${error.message || 'Unknown error'}`);
    return [];
  }
}

/**
 * Checks whether a namespaced key exists in localStorage.
 * @param {string} key - The storage key (will be namespaced automatically).
 * @returns {boolean} True if the key exists.
 */
export function hasItem(key) {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const namespacedKey = getNamespacedKey(key);
    return localStorage.getItem(namespacedKey) !== null;
  } catch (error) {
    console.error(formatStorageError(error, 'check', key));
    return false;
  }
}

/**
 * Estimates the approximate storage usage for namespaced keys.
 * @returns {{ usedBytes: number, keyCount: number }} Object with estimated bytes used and key count.
 */
export function getStorageUsage() {
  if (!isStorageAvailable()) {
    return { usedBytes: 0, keyCount: 0 };
  }

  try {
    let totalBytes = 0;
    let keyCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(NAMESPACE_PREFIX)) {
        const value = localStorage.getItem(storageKey);
        totalBytes += storageKey.length * 2;
        if (value !== null) {
          totalBytes += value.length * 2;
        }
        keyCount++;
      }
    }

    return { usedBytes: totalBytes, keyCount };
  } catch (error) {
    console.error(`Failed to calculate storage usage: ${error.message || 'Unknown error'}`);
    return { usedBytes: 0, keyCount: 0 };
  }
}

const storageService = {
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys,
  hasItem,
  getStorageUsage,
  isStorageAvailable,
};

export default storageService;