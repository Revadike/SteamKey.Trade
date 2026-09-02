import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes +1 apps from Barter.vg
 * @returns {Promise<Object>} Object containing updated apps, timestamp, and results
 */
// TODO: Scrape Steam Store instead?
export const processSteamPlusOne = async () => {
  try {
    // Fetch +1 data from barter.vg
    const response = await fetch('https://bartervg.com/browse/tag/531/json');

    if (!response.ok) {
      throw new Error(`Barter.vg API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Records for database update
    const records = Object.keys(data).map(appid => ({
      [App.fields.id]: parseInt(appid),
      [App.fields.plusOne]: true
    }));

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  }
};
