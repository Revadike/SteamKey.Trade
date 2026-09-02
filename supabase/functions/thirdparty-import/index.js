import { parseHTML } from 'linkedom';
import { serve } from '../_helpers/edge.js';
import { createAuthenticatedClient } from '../_helpers/supabase.js';

/**
 * Import Barter.vg tradeables
 *
 * @param {string} steamid - Steam ID of the user
 * @returns {Promise<Object>}
 */
const importBarterVg = async (steamid) => {
  const response = await fetch(`https://bartervg.com/steam/${steamid}/t/json/`);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  const appids = Object.values(data.by_platform[1] || {})
    .filter(({ platform_id }) => platform_id === 1) // filter out subids
    .map(({ sku }) => Number(sku));
  return { appids };
};

/**
 * Import Steam Inventory
 *
 * @param {string} steamid - Steam ID of the user
 * @returns {Promise<Object>}
 */
const importSteamInventory = async (steamid) => {
  const appids = [];
  const queries = [];
  const appid = 753;
  const contextid = 1;
  const inventoryUrl = new URL(`https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`);
  inventoryUrl.searchParams.set('l', 'english');
  inventoryUrl.searchParams.set('count', '1000'); // Fetch up to 1000 items at once

  let moreItems;

  do {
    const response = await fetch(inventoryUrl.toString())
      .then((res) => {
        if (res.status === 403) {
          throw new Error('Steam inventory is private, please change your inventory privacy settings');
        }
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }

        return res.json();
      });

    if (!response.success) {
      throw new Error('No success');
    }

    const { assets = [], descriptions, success, more_items, last_assetid } = response;

    if (!success) {
      throw new Error('No success');
    }

    moreItems = more_items;
    inventoryUrl.searchParams.set('start_assetid', last_assetid); // Set the next asset ID to continue fetching

    assets.forEach((asset) => {
      const { type, actions = [], name, market_name, market_hash_name } = descriptions.find(({ classid, instanceid }) => instanceid === asset.instanceid && classid === asset.classid) || {};
      if (type === 'Gift') {
        let appid = null;
        actions.forEach(({ link }) => {
          if (link.startsWith('https://store.steampowered.com/app/') || link.startsWith('https://steamcommunity.com/app/')) {
            appid = Number(link.split('/')[4]);
          }
        });
        const giftName = name || market_name || market_hash_name;
        if (appid) {
          appids.push(appid);
        } else if (giftName) {
          queries.push(giftName.replace(/ Gift$/, ''));
        } else {
          console.warn('Gift without appid or name', asset);
        }
      }
    });
  } while (moreItems);

  return { appids, queries };
};

/**
 * Import SteamTrades data
 *
 * @param {string} steamid - Steam ID of the user
 * @returns {Promise<Object>}
 */
const importSteamTrades = async (steamid) => {
  const baseURL = 'https://www.steamtrades.com';
  const response = await fetch(`${baseURL}/trades/search?user=${steamid}`);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const topicNodes = [...document.querySelectorAll('.row_inner_wrap:not(.is_faded) .row_trade_name a')];
  const topics = await Promise.all(topicNodes.map(async (node) => {
    const title = node.textContent.trim();
    const appids = [];
    const queries = [];
    const link = new URL(node.getAttribute('href'), baseURL);
    const url = link.href;

    const topicResponse = await fetch(url);
    if (!topicResponse.ok) {
      throw new Error(`HTTP error! Status: ${topicResponse.status}`);
    }

    const topicHtml = await topicResponse.text();
    const { document: topicDocument } = parseHTML(topicHtml);

    const haveNode = topicDocument.querySelector('.have');
    if (!haveNode) {
      console.warn(`No "have" section found for topic: ${title}`);
      return { title, url, appids, queries };
    }

    for (const node of haveNode.querySelectorAll('[href*="store.steampowered.com/app/"], [href*="steamcommunity.com/app/"], [href*="steamdb.info/app/"], [href*="s.team/a/"]')) {
      const appLink = new URL(node.getAttribute('href'));
      const appid = Number(appLink.href.split('/')[4]);
      if (appid && !appids.includes(appid)) {
        appids.push(appid);
      }
    }

    // assume topic linked all apps, so skip queries
    if (appids.length > 0) {
      return { title, url, appids, queries };
    }

    for (const table of haveNode.querySelectorAll('table')) {
      for (const row of table.querySelectorAll('tbody tr')) {
        // assume first column contains the query
        const query = row.querySelector('td')?.textContent.trim();
        if (query && !queries.includes(query)) {
          queries.push(query);
        }
      }
    }

    // assume topic uses tables for all queries, so skip the rest
    if (queries.length > 0) {
      return { title, url, appids, queries };
    }

    // assume each line is a query
    for (const line of haveNode.textContent.split('\n')) {
      const query = line.trim();
      if (query && !queries.includes(query)) {
        queries.push(query);
      }
    }

    return { title, url, appids, queries };
  }));

  return topics;
};

const thirdpartyImport = async ({ source }, req) => {
  const supabase = createAuthenticatedClient(req);
  const authHeader = req.headers.get('Authorization');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user: { app_metadata: { steamid } } } } = await supabase.auth.getUser(token);

  if (!steamid) {
    throw new Error('User is not authenticated');
  }

  switch (source) {
    case 'bartervg':
      return importBarterVg(steamid);
    case 'steam-inventory':
      return importSteamInventory(steamid);
    case 'steamtrades':
      return importSteamTrades(steamid);
    default:
      throw new Error(`Unsupported import source: ${source}`);
  }
};

serve(thirdpartyImport);
