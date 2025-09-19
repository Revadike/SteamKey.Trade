import SteamUser from 'steam-user';

import { serve } from '../_helpers/edge.js';
import { supabaseAdmin } from '../_helpers/supabase.js';
import { Trade } from '../_entities/Trade.js';
import { User } from '../_entities/User.js';
import { toAccountID } from '../../../assets/js/steamid.js';

/**
 * Send Steam group chat notifications for trades
 *
 * @param {Object} body - Request body
 * @param {string} body.tradeId - The trade ID to process
 * @returns {Promise<Object>}
 */
const steamNotify = async ({ tradeId }) => {
  if (!tradeId) {
    throw new Error('Trade ID is required');
  }

  // Get trade details from database using ORM
  const trade = new Trade(supabaseAdmin, tradeId);
  await trade.load();

  if (!trade.id) {
    throw new Error('Trade not found');
  }

  // Only handle pending/new trades and accepted trades
  if (![Trade.enums.status.pending, Trade.enums.status.accepted].includes(trade.status)) {
    return { message: 'No notification needed for this trade status' };
  }

  // Determine notification type and load user data
  let notificationType;
  let targetUserId;
  let otherUserId;

  if (trade.status === Trade.enums.status.pending) {
    notificationType = 'new_trade';
    targetUserId = trade.receiverId;
    otherUserId = trade.senderId;
  } else if (trade.status === Trade.enums.status.accepted) {
    notificationType = 'accepted_trade';
    targetUserId = trade.senderId;
    otherUserId = trade.receiverId;
  }

  // Load user data using ORM
  const targetUser = new User(supabaseAdmin, targetUserId);
  await targetUser.load();

  const otherUser = new User(supabaseAdmin, otherUserId);
  await otherUser.load();

  if (!targetUser.id || !otherUser.id) {
    throw new Error('Required user data not found');
  }

  // Check if target user has notifications enabled for this type
  const preferences = await targetUser.getPreferences();
  if (!preferences?.enabledNotifications?.includes(notificationType)) {
    return { message: 'Target user does not have Steam notifications enabled for this type' };
  }

  // Get Steam configuration from environment
  const steamConfig = {
    groupId: Deno.env.get('STEAM_GROUP_ID'),
    chatId: Deno.env.get('STEAM_CHAT_ID'),
    username: Deno.env.get('STEAM_USERNAME'),
    password: Deno.env.get('STEAM_PASSWORD')
  };

  // // Validate Steam configuration
  // if (!steamConfig.groupId || !steamConfig.chatId || !steamConfig.username || !steamConfig.password) {
  //   throw new Error('Steam configuration is incomplete. Check STEAM_GROUP_ID, STEAM_CHAT_ID, STEAM_USERNAME, and STEAM_PASSWORD environment variables.');
  // }

  // Format the Steam chat message with BBCode
  const messageText = formatSteamMessage(notificationType, trade, targetUser, otherUser);

  // Send Steam chat message
  try {
    await sendSteamMessage(steamConfig, messageText);
    return {
      message: 'Steam notification sent successfully',
      notificationType,
      targetUser: targetUser.displayName || targetUser.steamId
    };
  } catch (error) {
    console.error('Failed to send Steam notification:', error);
    // Don't throw error to prevent breaking the main trade flow
    return {
      message: 'Failed to send Steam notification',
      error: error.message
    };
  }
};

/**
 * Format message for Steam chat with BBCode
 *
 * @param {string} notificationType - Type of notification ('new_trade' or 'accepted_trade')
 * @param {Trade} trade - Trade object
 * @param {User} targetUser - User who receives the notification
 * @param {User} otherUser - The other user in the trade
 * @returns {string} Formatted message with Steam BBCode
 */
function formatSteamMessage(notificationType, trade, targetUser, otherUser) {
  const tradeUrl = `https://steamkey.trade/trade/${trade.id}`;
  const otherUserName = otherUser.displayName || 'Unknown User';

  // Get accountID for mentioning (if we have a steam ID)
  let targetMention = targetUser.displayName || 'User';
  if (targetUser.steamId) {
    try {
      const accountId = toAccountID(targetUser.steamId);
      targetMention = `[mention=${accountId}]@${targetUser.displayName || 'User'}[/mention]`;
    } catch {
      // Fallback to display name if conversion fails
      targetMention = targetUser.displayName || 'User';
    }
  }

  if (notificationType === 'new_trade') {
    return `${targetMention} received a new trade from ${otherUserName}: ${tradeUrl}`;
  } else if (notificationType === 'accepted_trade') {
    return `${otherUserName} accepted the trade from ${targetMention}: ${tradeUrl}`;
  }

  return '';
}

/**
 * Send message to Steam group chat
 *
 * @param {Object} config - Steam configuration
 * @param {string} message - Message to send
 * @returns {Promise<void>}
 */
async function sendSteamMessage(config, message) {
  return new Promise((resolve, reject) => {
    const client = new SteamUser();
    let isResolved = false;

    // Set up timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        client.logOff();
        reject(new Error('Steam login timeout'));
      }
    }, 30000); // 30 second timeout

    // Handle successful login
    client.on('loggedOn', () => {
      console.log('Logged into Steam successfully');
      client.setPersona(SteamUser.EPersonaState.Online);

      // Send the message to the group chat
      client.chat.sendChatMessage(config.groupId, config.chatId, message, (err) => {
        clearTimeout(timeout);

        if (!isResolved) {
          isResolved = true;

          if (err) {
            console.error('Failed to send Steam chat message:', err);
            client.logOff();
            reject(err);
          } else {
            console.log('Steam chat message sent successfully');
            client.logOff();
            resolve();
          }
        }
      });
    });

    // Handle login errors
    client.on('error', (err) => {
      clearTimeout(timeout);

      if (!isResolved) {
        isResolved = true;
        console.error('Steam login error:', err);
        reject(err);
      }
    });

    // Handle disconnection
    client.on('disconnected', (eresult, msg) => {
      console.log('Disconnected from Steam:', msg);
    });

    // Attempt to log in
    try {
      client.logOn({
        accountName: config.username,
        password: config.password,
        rememberPassword: true,
        logonID: Math.floor(Math.random() * 1000000) // Random logon ID to avoid conflicts
      });
    } catch (err) {
      clearTimeout(timeout);

      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    }
  });
}

// serve(steamNotify);

// If in Supabase Edge Functions environment
if (Deno?.env?.get?.('SB_EXECUTION_ID')) {
  // Serve the function
  serve(steamNotify);
} else {
  // Run the function directly for testing
  console.log('Steam notify function initialized');
  steamNotify({ tradeId: '1369a5e3-76e0-4c2d-b1bf-e77256f26898' })
    .then(result => {
      console.log('Steam notify function completed:', result);
    })
    .catch(error => {
      console.error('Error in steam notify function:', error);
    });
}