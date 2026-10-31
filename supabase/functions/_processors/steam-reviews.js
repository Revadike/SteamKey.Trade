import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';
import { steamApiRequest } from '../_helpers/steamAPI.js';

/**
 * Processes a list of Steam app IDs by fetching their review totals from the Steam Web API
 * and saving the processed data to a database.
 *
 * @param {number[]} appids - An array of Steam app IDs to process.
 * @returns {Promise<Object>} A promise that resolves to an object containing the results:
 * - `errors`: An array of errors encountered during processing.
 * - `failed`: An array of records that failed to process.
 * - `successful`: An array of successfully processed records.
 */
export const processSteamReviews = async (appids) => {
  const errors = [];
  const records = [];

  await Promise.all(appids.map(async (appid) => {
    try {
      // Only the totals are needed, so request the smallest page. The score fields are only sent
      // when review_type is All, and the totals are scoped by the query: languages must be 'all'
      // (else English only) and purchase_type must be All (else Steam purchases only).
      const { query_summary: summary } = await steamApiRequest('IUserReviewsService', 'GetAppReviews', 'v1', {
        params: {
          appid,
          input_json: JSON.stringify({
            num_per_page: 1,
            languages: ['all'],
            review_type: 0,
            purchase_type: 1,
            filter_offtopic_activity: false
          })
        }
      });

      if (!summary) {
        throw new Error(`No review totals returned for app ${appid}`);
      }

      records.push({
        [App.fields.id]: appid,
        [App.fields.positiveReviews]: summary.total_positive,
        [App.fields.negativeReviews]: summary.total_negative
      });
    } catch (error) {
      errors.push(error);
    }
  }));

  // Save app records to database
  const result = await saveToDatabase(App.table, records, App.fields.id);
  const recordsById = new Map(records.map(record => [record[App.fields.id], record]));
  const failedIds = new Set(result.failed.map(record => record[App.fields.id]));
  const failed = appids
    .filter(appid => !recordsById.has(appid) || failedIds.has(appid))
    .map(appid => recordsById.get(appid) ?? { [App.fields.id]: appid });
  const successful = records.filter(record => !failedIds.has(record[App.fields.id]));

  return {
    errors: errors.concat(result.errors),
    failed,
    successful
  };
};

