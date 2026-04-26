/**
 * Normalize date
 *
 * @param {any} value
 *
 * @returns {?Date}
 */
export const parseDate = (value) => {
  if (value instanceof Date) {
    return new Date(value.valueOf());
  } else if (value?.toDate?.() && value.toDate() instanceof Date) {
    return value.toDate();
  } else if (value?.seconds !== undefined && value?.nanoseconds !== undefined) {
    return new Date(value.seconds * 1e3 + value.nanoseconds / 1e6);
  } else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
    return new Date(value);
  } else if (!isNaN(parseFloat(value))) {
    return new Date(Number(value));
  } else {
    return null;
  }
};

/**
 * Calculates the relative date/time from the current date/time to the provided date/time.
 *
 * @param {string|Date} date - The date/time to compare with the current date/time.
 * @returns {string} A string representing the relative date/time (e.g., "2 hours ago", "in 3 days").
 */
export const relativeDate = date => {
  const dt = parseDate(date);
  if (!dt) {
    return 'unknown';
  }

  const diff = new Date() - dt;
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  if (absDiff < 10000) { return isPast ? 'just now' : 'now'; }

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  const timeUnits = [
    { unit: 'year', value: years },
    { unit: 'month', value: months },
    { unit: 'day', value: days },
    { unit: 'hour', value: hours },
    { unit: 'minute', value: minutes },
    { unit: 'second', value: seconds }
  ];

  for (const { unit, value } of timeUnits) {
    if (value > 0) {
      const unitLabel = value === 1 ? unit : `${unit}s`;
      const article = unit === 'hour' ? 'an' : 'a';
      const valueLabel = value === 1 ? article : value;
      return isPast ? `${valueLabel} ${unitLabel} ago` : `in ${valueLabel} ${unitLabel}`;
    }
  }
};