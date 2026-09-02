import Steam from 'npm:steam-user';
import ESteamDeckCompatibilityCategory from 'npm:steam-user/enums/ESteamDeckCompatibilityCategory.js';
import tags from '../_assets/tags.json' with { type: 'json' }; // Cached at 2025-04-27
import categories from '../_assets/categories.json' with { type: 'json' }; // Cached at 2025-04-27
import { App } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Topological sort, which sorts an array of records in a parent-first order based on their hierarchical relationships.
 * @param {Array<Object>} records - The array of records to be sorted.
 * @returns {Array<Object>} - A new array of records sorted in parent-first order.
 */
const sortByParentFirst = (records) => {
  const map = new Map();
  const inDegree = new Map();

  // Initialize map and in-degree count
  for (const record of records) {
    map.set(record[App.fields.id], record);
    inDegree.set(record[App.fields.id], 0);
  }

  // Build the adjacency list and in-degree count
  for (const record of records) {
    if (record[App.fields.parentId] && map.has(record[App.fields.parentId])) {
      inDegree.set(record[App.fields.id], (inDegree.get(record[App.fields.id]) || 0) + 1);
    }
  }

  // Collect items with no dependencies (roots)
  const queue = [];
  for (const record of records) {
    if (inDegree.get(record[App.fields.id]) === 0) {
      queue.push(record);
    }
  }

  const sorted = [];
  const idToChildren = new Map();

  // Build a children map
  for (const item of records) {
    if (item[App.fields.parentId]) {
      if (!idToChildren.has(item[App.fields.parentId])) {
        idToChildren.set(item[App.fields.parentId], []);
      }

      idToChildren.get(item[App.fields.parentId]).push(item);
    }
  }

  // Process items in topological order
  while (queue.length > 0) {
    const item = queue.shift();
    sorted.push(item);

    if (idToChildren.has(item[App.fields.id])) {
      for (const child of idToChildren.get(item[App.fields.id])) {
        queue.push(child);
      }
    }
  }

  return sorted;
};

/**
 * Retrieves all app categories from the Steam store.
 *
 * @param {boolean} [fresh=false] - If true, forces a fresh fetch of categories.
 * @returns {Promise<Object.<string, string>>} A promise that resolves to an object mapping category IDs to category names.
 * @throws {Error} - Throws an error if the request fails.
 */
export const getCategories = async (fresh = false) => {
  if (!fresh) {
    return Object.fromEntries(categories.map(({ categoryid, name }) => [categoryid, name]));
  }

  const url = new URL('https://store.steampowered.com/actions/ajaxgetstorecategories');
  url.searchParams.set('cc', 'us');
  url.searchParams.set('l', 'english');

  const response = await fetch(url, {
    headers: {
      Referer: 'https://store.steampowered.com/'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  const data = await response.json();
  return Object.fromEntries(data.map(({ categoryid, name }) => [categoryid, name]));
};

/**
 * Retrieves all app tags from the Steam store.
 *
 * @param {boolean} [fresh=false] - If true, forces a fresh fetch of tags.
 * @returns {Promise<Object.<string, string>>} A promise that resolves to an object mapping tag IDs to tag names.
 * @throws {Error} - Throws an error if the request fails.
 */
export const getTags = async (fresh = false) => {
  if (!fresh) {
    return Object.fromEntries(tags.map(({ tagid, name }) => [tagid, name]));
  }

  const url = new URL('https://store.steampowered.com/actions/ajaxgetstoretags');
  url.searchParams.set('cc', 'us');
  url.searchParams.set('l', 'english');

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch tags: ${response.statusText}`);
  }

  const data = await response.json();
  return Object.fromEntries(data.tags.map(({ tagid, name }) => [tagid, name]));
};

/**
 * Sets up a Steam client and logs in anonymously.
 * @returns {Promise<import('npm:steam-user').Steam>} A promise that resolves to the logged-in Steam client.
 * @throws {Error} - Throws an error if the login process fails or times out.
 */
export const setupSteamClient = () => {
  const client = new Steam();

  // Wait for login
  return new Promise((resolve, reject) => {
    const handleLoggedOn = () => {
      clearTimeout(timeout);
      client.removeListener('error', handleError);
      resolve(client);
    };

    const handleError = (err) => {
      clearTimeout(timeout);
      client.removeListener('loggedOn', handleLoggedOn);
      client.logOff();
      reject(err);
    };

    const timeout = setTimeout(() => {
      client.removeListener('loggedOn', handleLoggedOn);
      client.removeListener('error', handleError);
      client.logOff();
      reject(new Error('Steam client login timed out'));
    }, 60000);

    client.once('loggedOn', handleLoggedOn);
    client.once('error', handleError);

    // Log in anonymously
    client.logOn({ anonymous: true });
  });
};

/**
 * Processes apps from Steam PICS
 * @param {Array<number>} appids - Array of app IDs to process
 * @parem {import('npm:steam-user').Steam} [client] - Steam client instance
 * @returns {Promise<Object>} Object containing errors, failed, and successful records
 */
export const processSteamPICS = async (appids, client) => {
  const records = [];

  try {
    if (appids.length === 0) {
      return { errors: [], failed: [], successful: [] };
    }

    if (!client) {
      client = await setupSteamClient();
    }

    const categories = await getCategories();
    const tags = await getTags();

    const { apps, error } = await client.getProductInfo(appids, [], true);

    if (error) {
      throw new Error(`Steam PICS API returned error: ${error}`);
    }

    for (const [appid, details] of Object.entries(apps)) {
      const appId = parseInt(appid);
      const data = details.appinfo;

      const record = {
        [App.fields.id]: appId,
        [App.fields.changeNumber]: details.changenumber
      };

      if (data.common) {
        if (data.common.type) {
          record[App.fields.type] = data.common.type.toLowerCase();
        }

        if (data.common.name_localized) {
          record[App.fields.title] = data.common.name_localized;
        }

        if (data.common.name) {
          record[App.fields.title] = data.common.name;
        }

        if (data.common.original_release_date || data.common.steam_release_date) {
          record[App.fields.releasedAt] = new Date((data.common.original_release_date || data.common.steam_release_date) * 1000).toISOString();
        }

        // Developers & publishers
        const developers = [];
        const publishers = [];
        for (const { type, name } of Object.values(data.common.associations || {})) {
          if (type === 'developer') {
            developers.push(name);
          } else if (type === 'publisher') {
            publishers.push(name);
          }
        }
        if (data.extended?.developer) {
          developers.push(data.extended.developer);
        }
        if (data.extended?.publisher) {
          publishers.push(data.extended.publisher);
        }

        record[App.fields.developers] = developers.map(name => name?.trim()).filter((item, i, self) => item && self.indexOf(item) === i); // Remove duplicates
        record[App.fields.publishers] = publishers.map(name => name?.trim()).filter((item, i, self) => item && self.indexOf(item) === i); // Remove duplicates

        // Genres
        if (data.common.genres) {
          // TODO
        }

        // Categories
        if (data.common.categories) {
          record[App.fields.categories] = Object.values(data.common.categories).filter(id => categories[id])
            .map(id => categories[id].trim().toLowerCase());
        }

        // Tags
        if (data.common.store_tags) {
          record[App.fields.tags] = Object.values(data.common.store_tags).filter(id => tags[id])
            .map(id => tags[id].trim().toLowerCase());
        }

        // Languages
        if (data.common.supported_languages || data.common.languages) {
          const supportedLanguages = Object.keys(data.common.supported_languages ?? {}).map(key => key.trim().toLowerCase());
          const languages = Object.keys(data.common.languages ?? {}).map(lang => lang.trim().toLowerCase());

          record[App.fields.languages] = supportedLanguages.concat(languages).filter((item, i, self) => item && self.indexOf(item) === i); // Remove duplicates
        }

        if (data.common.oslist) {
          record[App.fields.platforms] = data.common.oslist.split(',').map(os => os.trim().toLowerCase());
        }

        if (data.common.steam_deck_compatibility) {
          record[App.fields.steamdeck] = ESteamDeckCompatibilityCategory[data.common.steam_deck_compatibility.category];
        }

        if (data.common.parent) {
          record[App.fields.parentId] = data.common.parent;
        }

        record[App.fields.exfgls] = !!data.common.exfgls;
      }

      if (data.extended) {
        if (data.extended.homepage) {
          record[App.fields.website] = data.extended.homepage;
        }

        record[App.fields.free] = !!data.extended.isfreeapp;

        if (data.extended.languages) {
          record[App.fields.languages] = data.extended.languages.split(',').map(lang => lang.trim().toLowerCase());
        }

        if (data.extended.validoslist) {
          record[App.fields.platforms] = data.extended.validoslist.split(',').map(os => os.trim().toLowerCase());
        }

        if (data.extended.listofdlc) {
          const dlcs = data.extended.listofdlc.split(',').map(Number);
          for (const dlc of dlcs) {
            const existingIndex = records.findIndex(r => r[App.fields.id] === dlc);
            if (existingIndex !== -1) {
              records[existingIndex][App.fields.parentId] = appId;
              records[existingIndex][App.fields.type] = App.enums.type.DLC;
            } else {
              records.push({
                [App.fields.id]: dlc,
                [App.fields.parentId]: appId,
                [App.fields.type]: App.enums.type.DLC
              });
            }
          }
        }
      }

      records.push(record);
    }

    // Save to database
    const sortedRecords = sortByParentFirst(records);
    return saveToDatabase(App.table, sortedRecords, App.fields.id);
  } catch (error) {
    const failed = appids.map(appid => records.find(record => record[App.fields.id] === appid) || { [App.fields.id]: appid });
    return { errors: [error], failed, successful: [] };
  } finally {
    // Ensure client logs off
    client?.logOff?.();
  }
};
