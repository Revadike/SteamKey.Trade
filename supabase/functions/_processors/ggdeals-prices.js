import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes a recently changed deals from the GG Deals API and saves the processed data to a database.
 *
 * @param {string} lastCheck - The timestamp of the last check to filter deals.
 * @returns {Promise<Object>} A promise that resolves to an object containing the results:
 * - `errors`: An array of errors encountered during processing.
 * - `failed`: An array of records that failed to process.
 * - `successful`: An array of successfully processed records.
 */
export const processGGDealsPrices = async (lastCheck) => {
  try {
    let allGames = {};

    // Build base URL
    const baseUrl = new URL('https://api.gg.deals/steamkeytrade/game/recently-changed-deals/');
    if (lastCheck) {
      baseUrl.searchParams.append('since', Math.floor(new Date(lastCheck).getTime() / 1000).toString());
    }

    let currentUrl = baseUrl.toString();
    let retriedWithoutSince = false;

    // Process all pages until next is null
    do {
      const response = await fetch(currentUrl, {
        headers: {
          'X-API-Key': Deno.env.get('GGDEALS_API_KEY')
        }
      });

      if (response.status === 400) {
        let errBody;
        try {
          errBody = await response.json();
        } catch {
          throw new Error('GG Deals API returned 400: unknown error');
        }

        const isBadSince
          = !retriedWithoutSince
            && errBody.success === false
            && errBody.data?.code === 400
            && /Invalid since/.test(errBody.data.message);

        if (isBadSince) {
          console.warn('GG Deals API rejected \'since\' parameter. Retrying without \'since\'.');
          // Remove the since, rebuild URL, and retry
          baseUrl.searchParams.delete('since');
          currentUrl = baseUrl.toString();
          retriedWithoutSince = true;
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`GG Deals API returned ${response.status}: ${response.statusText}`);
      }

      const { data, success } = await response.json();
      if (!success || !data) {
        throw new Error(`GG Deals API returned an error payload: ${JSON.stringify(data)}`);
      }

      const { next, games } = data;
      if (games) {
        allGames = { ...games, ...allGames };
      }

      currentUrl = next;
    } while (currentUrl);

    if (Object.keys(allGames).length === 0) {
      return { errors: [], failed: [], successful: [] };
    }

    const records = [];
    for (const { steamIds, prices } of Object.values(allGames)) {
      for (const appid of steamIds) {
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
          [App.fields.marketPrice]: currentPrice,
          [App.fields.historicalLow]: historicalPrice
        });
      }
    }

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  }
};
