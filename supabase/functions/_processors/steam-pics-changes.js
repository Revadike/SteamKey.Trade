import { processSteamPICS, setupSteamClient } from './steam-pics.js';

/**
 * Processes app changes from Steam PICS
 * @param {number} lastChangeNumber - Last processed change number
 * @returns {Promise<Object>} Object containing errors, failed records, and successful records. Also includes the current change number.
 */
export const processSteamPICSChanges = async (lastChangeNumber) => {
  let client;

  try {
    client = await setupSteamClient();

    // Get product changes since last change number
    const { currentChangeNumber, appChanges } = await client.getProductChanges(lastChangeNumber);

    // Filter apps that don't need a token
    const appids = appChanges
      .filter(({ needs_token }) => !needs_token)
      .map(({ appid }) => Number(appid));

    if (appids.length === 0) {
      return { errors: [], failed: [], successful: [], currentChangeNumber };
    }

    const result = await processSteamPICS(appids, client);
    return { ...result, currentChangeNumber };
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  } finally {
    // Ensure client logs off
    client?.logOff?.();
  }
};
