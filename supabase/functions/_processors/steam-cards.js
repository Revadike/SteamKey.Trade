import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes Steam trading card information from steam-badges-db
 * @returns {Promise<Object>} Object containing errors, failed records, and successful records
 */
export const processSteamCards = async () => {
  const records = [];
  try {
    // Fetch cards data from the steam-badges-db repository
    const response = await fetch('https://github.com/nolddor/steam-badges-db/raw/main/data/badges.slim.json');

    if (!response.ok) {
      throw new Error(`Steam badges API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Records for database update
    for (const [appid, size] of Object.entries(data)) {
      records.push({
        [App.fields.id]: parseInt(appid),
        [App.fields.cards]: parseInt(size)
      });
    }

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: records, successful: [] };
  }
};
