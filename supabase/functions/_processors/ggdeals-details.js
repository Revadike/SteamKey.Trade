import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes a list of Steam app IDs by fetching game details from the GG Deals API
 * and saving the processed data to a database.
 *
 * @param {number[]} appids - An array of Steam app IDs to process.
 * @returns {Promise<Object>} A promise that resolves to an object containing the results:
 * - `errors`: An array of errors encountered during processing.
 * - `failed`: An array of records that failed to process.
 * - `successful`: An array of successfully processed records.
 */
export const processGGDealsDetails = async (appids) => {
  const records = [];
  const errors = [];
  const failed = [];

  const batchSize = 100;
  try {
    for (let i = 0; i < appids.length; i += batchSize) {
      const batch = appids.slice(i, i + batchSize);

      const url = new URL('https://api.gg.deals/steamkeytrade/game/by-steam-app-id/');
      url.searchParams.append('ids', batch.join(',')); // max 100

      let response;
      try {
        response = await fetch(url, {
          headers: {
            'X-API-Key': Deno.env.get('GGDEALS_API_KEY')
          }
        });
      } catch (error) {
        failed.push(...batch.map(appid => ({ [App.fields.id]: appid })));
        errors.push(error);
        continue;
      }

      if (!response.ok) {
        failed.push(...batch.map(appid => ({ [App.fields.id]: appid })));
        errors.push(new Error(`GG Deals API returned ${response.status}: ${response.statusText}`));
        continue;
      }

      const { data, success } = await response.json();

      if (!data || !success) {
        failed.push(...batch.map(appid => ({ [App.fields.id]: appid })));
        errors.push(new Error(`GG Deals API returned an error: ${JSON.stringify(data)}`));
        continue;
      }

      for (const appid in data) {
        if (!data[appid]) {
          continue;
        }

        const { title, prices } = data[appid];

        const getMin = (...vals) => {
          const nums = vals
            .filter(v => v != null)
            .map(Number)
            .filter(v => !isNaN(v));

          return nums.length ? Math.min(...nums) : null;
        };

        const currentPrice = getMin(prices.currentRetail, prices.currentKeyshops);
        const historicalPrice = getMin(prices.historicalRetail, prices.historicalKeyshops);

        records.push({
          [App.fields.id]: parseInt(appid),
          [App.fields.title]: title,
          [App.fields.marketPrice]: currentPrice,
          [App.fields.historicalLow]: historicalPrice
        });
      }
    }

    // Save to database
    const result = await saveToDatabase(App.table, records, App.fields.id);
    return { errors: errors.concat(result.errors), failed: failed.concat(result.failed), successful: result.successful };
  } catch (error) {
    const failed = appids.map(appid => records.find(record => record[App.fields.id] === appid) || { [App.fields.id]: appid });
    return { errors: [error], failed, successful: [] };
  }
};
