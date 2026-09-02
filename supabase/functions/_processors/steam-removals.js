import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes app removal information from steam-tracker
 * @param {string|null} lastCheck - Timestamp of the last check
 * @returns {Promise<Object>} Object containing errors, failed, and successful records
 */
export const processSteamRemovals = async (lastCheck) => {
  try {
    const response = await fetch('https://steam-tracker.com/api?action=GetAppListV3');

    if (!response.ok) {
      throw new Error(`Steam-tracker API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const apps = data?.removed_apps ?? [];

    if (apps.length === 0) {
      throw new Error('Received no removed apps from steam-tracker.com');
    }

    // Determine the cutoff date
    const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(0);

    // Prepare records for database update
    const records = [];

    for (const { appid, changed_at, category, type } of apps) {
      // Process changes since last check
      const changedAt = new Date(changed_at);
      const normalizedType = type.toLowerCase() === 'uncategorized' ? 'unknown' : type.toLowerCase();

      if (changedAt > lastCheckDate) {
        records.push({
          [App.fields.id]: parseInt(appid),
          [App.fields.type]: normalizedType,
          [App.fields.removedAs]: category,
          [App.fields.removedAt]: changedAt.toISOString()
        });
      }
    }

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  }
};
