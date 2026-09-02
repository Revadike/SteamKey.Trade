import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes Steam trading card information from steam.tools
 * @param {string|null} lastCheck - Timestamp of the last check
 * @returns {Promise<Object>} Object containing errors, failed records, and successful records
 */
export const processSteamCards = async (lastCheck) => {
  const records = [];
  try {
    // Fetch cards data from steam.tools with the required referer header
    const response = await fetch('https://data.steam.tools/data/set_data.json', {
      headers: {
        Referer: 'https://steam.tools/cards/'
      }
    });

    if (!response.ok) {
      throw new Error(`Steam.tools API returned ${response.status}: ${response.statusText}`);
    }

    const { sets } = await response.json();

    const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(0);

    for (const cardSet of sets) {
      // Check if the card set was added after the last check
      const addedDate = new Date(cardSet.added * 1000);

      if (addedDate > lastCheckDate) {
        records.push({
          [App.fields.id]: parseInt(cardSet.appid),
          [App.fields.cards]: parseInt(cardSet.true_count)
        });
      }
    }

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: records, successful: [] };
  }
};
