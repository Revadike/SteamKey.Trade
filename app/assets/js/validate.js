// TODO: Use ajv for validation

/**
 * Is numeric
 *
 * @param {any} value
 *
 * @returns {boolean}
 */
export const isNumeric = value => !!value && /^\d+$/.test(value);

/**
 * Is aspect ratio
 *
 * @param {string} value
 *
 * @returns {boolean}
 */
export const isAspectRatio = value => !!value && /^\d{1,4}:\d{1,4}$/.test(value);

/**
 * Is email
 *
 * @param {string} value
 *
 * @returns {boolean}
 */
export const isEmail = value => !!value && /^[^@]+@[^.]+\..{2,}$/.test(value);

/**
 * Is Steam ID 64
 * @see https://developer.valvesoftware.com/wiki/SteamID
 *
 * @param {string} value
 *
 * @returns {boolean}
 */
export const isSteamID64 = value => !!value && /^7656119\d{10}$/.test(value);

/**
 * Is url
 *
 * @param {string} value
 *
 * @returns {boolean}
 */
export const isUrl = value => !!value && /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/.test(value);
