import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes app types from the Secret API
 * @param {string|null} lastCheck - Timestamp of the last check
 * @returns {Promise<Object>} Object containing updated apps, timestamp, and results
 */
export const processSteamTypes = async function(lastCheck) {
  try {
    const secretApiHost = Deno.env.get('SECRET_API_HOST');
    if (!secretApiHost) {
      throw new Error('SECRET_API_HOST environment variable is not set');
    }

    // Create endpoint URL with since parameter if lastCheck exists
    const endpoint = new URL('/apptypes', secretApiHost);
    if (lastCheck) {
      const sinceTimestamp = Math.floor(new Date(lastCheck).getTime() / 1000);
      endpoint.searchParams.append('since', sinceTimestamp);
    }

    // Fetch data from secret API
    const response = await fetch(endpoint.toString());
    if (!response.ok) {
      throw new Error(`Secret API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Prepare records for database update
    const records = [];
    for (const [appid, type] of Object.entries(data)) {
      if (type) {
        records.push({
          [App.fields.id]: parseInt(appid),
          [App.fields.type]: type
        });
      }
    }

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  }
};
