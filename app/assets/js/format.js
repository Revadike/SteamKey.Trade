import { parseDate, relativeDate } from './date.js';
export { relativeDate, parseDate };

/**
 * Formats a number according to the 'en-US' locale with a maximum of one decimal place.
 *
 * @param {number} number - The number to format.
 * @param {boolean} [maxDigits=1] - The maximum number of digits after the decimal point.
 * @param {boolean} [minDigits=0] - The minimum number of digits after the decimal point.
 * @returns {string|number} The formatted number as a string, or the original input if it is not a number.
 */
export const formatNumber = (number, maxDigits = 1, minDigits = 0) => {
  if (isNaN(number)) {
    return number;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits
  }).format(number);
};

/**
 * Extracts the hostname from a given URL.
 *
 * @param {string} url - The URL from which to extract the hostname.
 * @returns {string} The hostname of the given URL.
 */
export const formatUrl = url => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * Converts a given date into a human-readable string format.
 *
 * @param {Date|Object|String|Number} date - The date to be formatted, which will be parsed.
 * @param {boolean} [withTime=true] - Indicates whether to include the time in the formatted string.
 * @returns {string} The formatted date string.
 */
export const formatDate = (date, withTime = true) => {
  const parsedDate = parseDate(date);
  if (!parsedDate) {
    return date;
  }

  return parsedDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(withTime && {
      hour: 'numeric',
      minute: 'numeric'
    })
  });
};

/**
 * Converts a given string into a slug format.
 *
 * @param {string|null} text - The input string to be converted into a slug.
 * @returns {string|null} The slugified string or null if the input was null.
 */
export const slugify = text => {
  // If input is null, return null.
  if (text == null) { return null; }

  // Lowercase the input
  let slug = text.toLowerCase();

  // Remove accents (using Unicode normalization similar to unaccent)
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Replace non-alphanumeric characters (excluding dash and underscore) with hyphens
  slug = slug.replace(/[^a-z0-9\-_]+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  return slug;
};
