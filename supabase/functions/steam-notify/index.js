import SteamUser from 'steam-user';

import { serve } from '../_helpers/edge.js';
import { supabaseAdmin } from '../_helpers/supabase.js';
import { Trade } from '../_entities/Trade.js';
import { User } from '../_entities/User.js';
import { toAccountID } from '../../../assets/js/steamid.js';

/**
 * Steam Notify Bot Class
 * Handles Steam connection and notification processing
 */
class SteamNotifyBot {
  constructor() {
    this.steamClient = null;
    this.isConnected = false;
    this.notificationChannel = null;

    // Steam configuration
    this.steamConfig = {
      groupId: Deno.env.get('STEAM_GROUP_ID'),
      chatId: Deno.env.get('STEAM_CHAT_ID'),
      username: Deno.env.get('STEAM_USERNAME'),
      password: Deno.env.get('STEAM_PASSWORD')
    };
  }

  /**
   * Initialize Steam connection
   */
  async initializeSteamConnection() {
    return new Promise((resolve, reject) => {
      // Validate Steam configuration
      if (!this.steamConfig.groupId || !this.steamConfig.chatId || !this.steamConfig.username || !this.steamConfig.password) {
        reject(new Error('Steam configuration is incomplete. Check STEAM_GROUP_ID, STEAM_CHAT_ID, STEAM_USERNAME, and STEAM_PASSWORD environment variables.'));
        return;
      }

      this.steamClient = new SteamUser();

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          this.steamClient.logOff();
          reject(new Error('Steam login timeout'));
        }
      }, 30000); // 30 second timeout

      // Handle successful login and reconnection
      this.steamClient.on('loggedOn', () => {
        console.log('Steam bot logged in successfully');
        clearTimeout(timeout);
        this.isConnected = true;
        this.steamClient.setPersona(SteamUser.EPersonaState.LookingToTrade);
        this.steamClient.setUIMode(SteamUser.EClientUIMode.BigPicture);
        resolve();
      });

      // Handle login errors
      this.steamClient.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Steam login error:', err);
        this.isConnected = false;
        reject(err);
      });

      // Handle disconnection - just log it, SteamUser will handle reconnection
      this.steamClient.on('disconnected', (eresult, msg) => {
        console.log('Disconnected from Steam:', msg);
        this.isConnected = false;
      });

      // Attempt to log in
      try {
        this.steamClient.logOn({
          accountName: this.steamConfig.username,
          password: this.steamConfig.password,
          rememberPassword: true,
          logonID: Math.floor(Math.random() * 1000000) // Random logon ID to avoid conflicts
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Send message via Steam connection
   *
   * @param {string} message - Message to send
   * @returns {Promise<void>}
   */
  async sendSteamMessage(message) {
    if (!this.isConnected || !this.steamClient) {
      throw new Error('Steam client not connected');
    }

    return new Promise((resolve, reject) => {
      this.steamClient.chat.sendChatMessage(this.steamConfig.groupId, this.steamConfig.chatId, message, (err) => {
        if (err) {
          console.error('Failed to send Steam chat message:', err);
          reject(err);
        } else {
          console.log('Steam chat message sent successfully');
          resolve();
        }
      });
    });
  }

  /**
   * Process a notification for Steam chat
   *
   * @param {Object} notification - Notification object from database
   * @returns {Promise<Object>}
   */
  async processNotification(notification) {
    if (!notification.link) {
      console.log('Notification has no link, skipping');
      return { message: 'No link in notification' };
    }

    // Extract trade ID from notification link (format: /trade/{tradeId})
    const linkMatch = notification.link.match(/\/trade\/([a-f0-9-]+)/);
    if (!linkMatch) {
      console.log('Could not extract trade ID from link:', notification.link);
      return { message: 'Invalid trade link format' };
    }

    const tradeId = linkMatch[1];
    return await this.sendTradeNotification(tradeId, notification.type);
  }

  /**
   * Send Steam group chat notifications for trades
   *
   * @param {string} tradeId - The trade ID to process
   * @param {string} notificationType - Type of notification ('new_trade' or 'accepted_trade')
   * @returns {Promise<Object>}
   */
  async sendTradeNotification(tradeId, notificationType) {
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

    // Determine target users based on notification type
    let targetUserId;
    let otherUserId;

    if (notificationType === 'new_trade') {
      targetUserId = trade.receiverId;
      otherUserId = trade.senderId;
    } else if (notificationType === 'accepted_trade') {
      targetUserId = trade.senderId;
      otherUserId = trade.receiverId;
    } else {
      return { message: 'Unsupported notification type' };
    }

    // Load user data using ORM
    const targetUser = new User(supabaseAdmin, targetUserId);
    await targetUser.load();

    const otherUser = new User(supabaseAdmin, otherUserId);
    await otherUser.load();

    if (!targetUser.id || !otherUser.id) {
      throw new Error('Required user data not found');
    }

    // Format the Steam chat message with BBCode
    const messageText = this.formatSteamMessage(notificationType, trade, targetUser, otherUser);

    // Send Steam chat message using the persistent connection
    try {
      await this.sendSteamMessage(messageText);
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
  }

  /**
   * Format message for Steam chat with BBCode
   *
   * @param {string} notificationType - Type of notification ('new_trade' or 'accepted_trade')
   * @param {Trade} trade - Trade object
   * @param {User} targetUser - User who receives the notification
   * @param {User} otherUser - The other user in the trade
   * @returns {string} Formatted message with Steam BBCode
   */
  formatSteamMessage(notificationType, trade, targetUser, otherUser) {
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
   * Set up real-time subscription to notifications table
   */
  setupNotificationListener() {
    console.log('Setting up notification listener...');

    this.notificationChannel = supabaseAdmin
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'type=in.(new_trade,accepted_trade)'
        },
        async (payload) => {
          console.log('Received notification:', payload.new);

          try {
            const result = await this.processNotification(payload.new);
            console.log('Notification processed:', result);
          } catch (error) {
            console.error('Error processing notification:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Notification subscription status:', status);
      });
  }

  /**
   * Start the Steam bot
   */
  async start() {
    console.log('Starting Steam Notify Bot...');

    try {
      // Initialize Steam connection
      await this.initializeSteamConnection();
      console.log('Steam connection established successfully');

      // Set up notification listener
      this.setupNotificationListener();
      console.log('Steam Notify Bot is now running and listening for notifications');

      return { message: 'Steam Notify Bot started successfully' };
    } catch (error) {
      console.error('Failed to start Steam Notify Bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot and clean up connections
   */
  async stop() {
    console.log('Stopping Steam Notify Bot...');

    if (this.notificationChannel) {
      await this.notificationChannel.unsubscribe();
      this.notificationChannel = null;
    }

    if (this.steamClient && this.isConnected) {
      this.steamClient.logOff();
      this.isConnected = false;
    }

    console.log('Steam Notify Bot stopped');
  }
}

// Create global bot instance
const steamBot = new SteamNotifyBot();

/**
 * Main function for Supabase Edge Function
 */
const steamNotifyHandler = async () => {
  try {
    return await steamBot.start();
  } catch (error) {
    console.error('Error in steam notify handler:', error);
    throw error;
  }
};

// If in Supabase Edge Functions environment
if (Deno?.env?.get?.('SB_EXECUTION_ID')) {
  // Serve the bot handler
  serve(steamNotifyHandler);
} else {
  // Run the bot directly for testing
  console.log('Steam notify bot initialized for testing');
  steamBot.start()
    .then((result) => {
      console.log('Steam notify bot started successfully:', result);
    })
    .catch(error => {
      console.error('Error starting steam notify bot:', error);
    });
}