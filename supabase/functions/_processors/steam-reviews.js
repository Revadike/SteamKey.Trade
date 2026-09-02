import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes a list of Steam app IDs by fetching reviews from the Steam Store API
 * and saving the processed data to a database.
 *
 * @param {number[]} appids - An array of Steam app IDs to process.
 * @returns {Promise<Object>} A promise that resolves to an object containing the results:
 * - `errors`: An array of errors encountered during processing.
 * - `failed`: An array of records that failed to process.
 * - `successful`: An array of successfully processed records.
 */
export const processSteamReviews = async (appids) => {
  const records = [];
  const errors = [];

  await Promise.all(appids.map(async (appid) => {
    try {
      const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
      url.searchParams.append('json', 1);
      url.searchParams.append('review_type', 'all');
      // url.searchParams.append('purchase_type', 'steam');
      url.searchParams.append('purchase_type', 'all');
      url.searchParams.append('filter_offtopic_activity', 0);
      url.searchParams.append('num_per_page', 0);
      url.searchParams.append('language', 'all');

      const response = await fetch(url);
      const data = await response.json();

      if ((data && data.success !== 1) || !data?.success) {
        throw new Error(`Failed to fetch reviews for app ${appid}: ${JSON.stringify(data)}`);
      }

      records.push({
        [App.fields.id]: appid,
        [App.fields.positiveReviews]: data.query_summary.total_positive,
        [App.fields.negativeReviews]: data.query_summary.total_negative
      });
    } catch (error) {
      errors.push(error);
    }
  }));

  // Save app records to database
  const result = await saveToDatabase(App.table, records, App.fields.id);
  const failed = [];
  const successful = [];
  for (const appid of appids) {
    const record = records.find(record => record[App.fields.id] === appid);
    if (record && !result.failed.some(r => r[App.fields.id] === appid)) {
      successful.push(record);
    } else {
      failed.push(record ?? { [App.fields.id]: appid });
    }
  }

  return {
    errors: errors.concat(result.errors),
    failed,
    successful
  };
};

