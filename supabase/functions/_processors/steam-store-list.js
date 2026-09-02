import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes app list from the Steam Store API
 * @param {string|null} lastCheck - Timestamp of the last check
 * @returns {Promise<Object>} Object containing errors, failed, and successful records
 */
export const processSteamStoreList = async (lastCheck) => {
  try {
    const steamApiKey = Deno.env.get('STEAM_API_KEY');
    if (!steamApiKey) {
      throw new Error('STEAM_API_KEY environment variable is not set');
    }

    const params = new URLSearchParams({
      key: steamApiKey.trim(),
      include_games: 'true',
      include_dlc: 'true',
      include_software: 'true',
      include_videos: 'true',
      include_hardware: 'true'
    });

    // Add if_modified_since if lastCheck exists
    if (lastCheck) {
      params.append('if_modified_since', Math.floor(new Date(lastCheck).getTime() / 1000).toString());
    }

    const storeUrl = 'https://api.steampowered.com/IStoreService/GetAppList/v1/';

    const records = [];
    let more = true;
    let lastAppId = null;

    while (more) {
      const queryParams = new URLSearchParams(params);

      if (lastAppId) {
        queryParams.set('last_appid', lastAppId.toString());
      }

      const response = await fetch(`${storeUrl}?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Steam Store API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const { apps = [], have_more_results, last_appid } = data.response;

      for (const app of apps) {
        const appId = parseInt(app.appid);

        // Add to records for database update
        records.push({
          [App.fields.id]: appId,
          [App.fields.title]: app.name.toString()
        });
      }

      more = have_more_results;
      lastAppId = last_appid;
    }

    // Save to database
    return saveToDatabase(App.table, records, App.fields.id);
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  }
};
