import { serve } from '../_helpers/edge.js';

/**
 * Retrieves Steam Deck compatibility report for a specified app.
 *
 * @param {Object} data - The incoming request data.
 * @param {string} data.appid - The Steam app ID to check compatibility for.
 * @returns {Promise<Object>} The compatibility report.
 */
const steamdeckCompatibilityReport = async ({ appid }) => {
  if (!appid) {
    throw new Error('Missing appid');
  }

  try {
    const response = await fetch(`https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appid}&l=english`);
    const report = await response.json();

    if (report.success !== 1) {
      throw new Error('Unsuccessful');
    }

    if (Array.isArray(report.results) && report.results.length === 0) {
      return { resolved_category: 0, resolved_items: [] };
    }

    return report.results;
  } catch (error) {
    error.appid = appid;
    throw error;
  }
};

serve(steamdeckCompatibilityReport);
