/**
 * Rand
 * @param {number} [size = 8]
 * @returns {string}
 */
export const rand = (size = 8) => (
  [...crypto.getRandomValues(new Uint32Array(size))].map(m => (m & 15).toString(16)).join('')
);

/**
 * Encrypts a message using AES-256-CBC algorithm.
 * @param {string} data - The message to be encrypted.
 * @param {string} key - The password or key used for encryption.
 * @returns {Promise<Object>} An object containing the IV (Initialization Vector) and the encrypted message.
 */
export const encrypt = async (data, key) => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const derivedKey = await window.crypto.subtle.importKey('raw', encoder.encode(key), 'PBKDF2', false, ['deriveKey']);
  const derivedKeyMaterial = await window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), iterations: 100000, hash: 'SHA-256' },
    derivedKey,
    { name: 'AES-CBC', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const encryptedBuffer = await window.crypto.subtle.encrypt({ name: 'AES-CBC', iv }, derivedKeyMaterial, dataBuffer);
  const encryptedData = Array.from(new Uint8Array(encryptedBuffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    iv: Array.from(iv).map(byte => byte.toString(16).padStart(2, '0')).join(''),
    encryptedData
  };
};

/**
 * Decrypts a message that was encrypted using AES-256-CBC algorithm.
 * @param {Object} message - An object containing the IV (Initialization Vector) and the encrypted message.
 * @param {string} message.iv - The initialization vector.
 * @param {string} message.encryptedData - The encrypted message.
 * @param {string} key - The password or key used for decryption.
 * @returns {Promise<string>} The decrypted message.
 */
export const decrypt = async ({ iv, encryptedData }, key) => {
  const encoder = new TextEncoder();
  const derivedKey = await window.crypto.subtle.importKey('raw', encoder.encode(key), 'PBKDF2', false, ['deriveKey']);
  const derivedKeyMaterial = await window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), iterations: 100000, hash: 'SHA-256' },
    derivedKey,
    { name: 'AES-CBC', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const derivedIV = new Uint8Array(iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: derivedIV }, derivedKeyMaterial, new Uint8Array(encryptedData.match(/.{1,2}/g).map(byte => parseInt(byte, 16))));
  return new TextDecoder().decode(decryptedBuffer);
};
/**
 * Generate key pair for asymmetric encryption.
 * @returns {Promise<Object>} An object containing the public and private keys.
 */
export const generateKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: 'SHA-256' }
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Convert CryptoKey objects to hex strings
  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: arrayBufferToHex(publicKey),
    privateKey: arrayBufferToHex(privateKey)
  };
};

/**
 * Encrypts a message using asymmetric encryption.
 * @param {string} data - The message to be encrypted.
 * @param {string} publicKey - The public key used for encryption.
 * @returns {Promise<string>} The encrypted message.
 */
export const publicEncrypt = async (data, publicKey) => {
  const publicKeyObj = await crypto.subtle.importKey(
    'spki',
    hexToArrayBuffer(publicKey),
    { name: 'RSA-OAEP', hash: { name: 'SHA-256' } },
    false,
    ['encrypt']
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKeyObj,
    new TextEncoder().encode(data)
  );

  return arrayBufferToHex(encryptedBuffer);
};

/**
 * Decrypts a message that was encrypted using asymmetric encryption.
 * @param {string} encryptedData - The encrypted message.
 * @param {string} privateKey - The private key used for decryption.
 * @returns {Promise<string>} The decrypted message.
 */
export const privateDecrypt = async (encryptedData, privateKey) => {
  const privateKeyObj = await crypto.subtle.importKey(
    'pkcs8',
    hexToArrayBuffer(privateKey),
    { name: 'RSA-OAEP', hash: { name: 'SHA-256' } },
    false,
    ['decrypt']
  );

  const encryptedBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKeyObj,
    hexToArrayBuffer(encryptedData)
  );

  return new TextDecoder().decode(encryptedBuffer);
};

/**
 * Convert ArrayBuffer to hex string.
 * @param {ArrayBuffer} buffer - The ArrayBuffer to be converted.
 * @returns {string} The hex string.
 */
const arrayBufferToHex = buffer => {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Convert hex string to ArrayBuffer.
 * @param {string} hex - The hex string to be converted.
 * @returns {ArrayBuffer} The resulting ArrayBuffer.
 */
const hexToArrayBuffer = hex => {
  const bytes = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
  return bytes.buffer;
};