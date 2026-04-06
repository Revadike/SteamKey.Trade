import SteamSignIn from 'npm:steam-signin';

import { serve } from '../_helpers/edge.js';
import { supabaseAdmin } from '../_helpers/supabase.js';
import { steamApiRequest } from '../_helpers/steamAPI.js';

import { Collection, User } from '../_entities/index.js';

/**
 * Registers a new user with the provided authentication user and Steam ID.
 *
 * @param {Object} authUser - The authenticated user object.
 * @param {string} steamID64 - The Steam ID of the user.
 *
 * @throws Will throw an error if updating the database or synchronizing collections fails.
 */
async function register(authUser, steamID64) {
  console.log(`Registering user ${authUser.id} with Steam ID ${steamID64}`);

  const user = new User(supabaseAdmin); // new user
  user.id = authUser.id;
  user.steamId = steamID64;

  let isPublicProfile = false;
  try {
    const { players } = await steamApiRequest('ISteamUser', 'GetPlayerSummaries', 'v2', {
      params: {
        steamids: steamID64
      }
    });

    const { personaname, avatarfull, loccountrycode, communityvisibilitystate } = players[0];
    if (personaname) {
      user.displayName = personaname;
    }
    if (avatarfull) {
      user.avatar = avatarfull;
    }
    if (loccountrycode) {
      user.region = loccountrycode;
    }
    isPublicProfile = communityvisibilitystate === 3;
  } catch (error) {
    console.error('Failed to set user information from Steam', error);
  }

  // Set user display name, region and avatar from Steam
  try {
    await user.save();
  } catch (error) {
    // ignore duplicate key error
    if (error.code !== '23505') {
      throw error;
    }
  }

  // Set default preferences
  try {
    await user.savePreferences({
      automaticLibrarySync: isPublicProfile,
      automaticWishlistSync: isPublicProfile,
      createdAt: new Date()
    });
  } catch (error) {
    // ignore duplicate key error
    if (error.code !== '23505') {
      throw error;
    }
  }

  // Set user collections
  await Promise.all([
    Collection.enums.type.tradelist,
    Collection.enums.type.wishlist,
    Collection.enums.type.library,
    Collection.enums.type.blacklist
  ].map(async (type) => {
    let collection = await Collection.getMasterCollection(supabaseAdmin, user.id, type);
    if (!collection) {
      collection = await Collection.createMasterCollection(supabaseAdmin, user.id, type);
    }
    if ((type === Collection.enums.type.wishlist || type === Collection.enums.type.library) && isPublicProfile) {
      try {
        await collection.syncWithSteam();
      } catch (error) {
        console.error(`Failed to sync ${type} collection with Steam: `, error);
        // throw error;
      }
    }
  }));

  // Update user metadata with Steam ID, marking registration as complete
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    app_metadata: {
      ...authUser.app_metadata,
      steamid: steamID64
    }
  });

  if (authUpdateError) {
    throw authUpdateError;
  }
}

/**
 * Verifies a user's Steam OpenID login and creates a custom token for them.
 *
 * @param {Object} data - The incoming request data.
 * @param {string} data.verify - The OpenID verification URL.
 * @param {string} data.impersonate - The user ID to impersonate (optional).
 * @returns {Promise<Object>} The login token.
 */
const login = async ({ verify, impersonate }, req) => {
  if (!verify && !impersonate) {
    throw new Error('Missing required parameters');
  }

  try {
    let steamID64;
    if (impersonate) {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      const { data } = await supabaseAdmin.auth.getUser(token);
      // TODO: Implement user roles
      if (data.user?.app_metadata?.steamid === '76561198042965266') {
        steamID64 = impersonate;
      } else {
        throw new Error('You are not authorized to impersonate users');
      }
    } else {
      // TODO: Use a fixed domain?
      const returnUrl = new URL(verify);
      const signIn = new SteamSignIn(returnUrl.origin);

      const steamID = await signIn.verifyLogin(returnUrl.href);
      steamID64 = steamID.getSteamID64();
    }

    // Creates user if not exists
    const email = `${steamID64}@steam`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email
    });

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Failed to generate login token');
    }

    // If first-time login, register user
    if (!data.user.app_metadata.steamid) {
      await register(data.user, steamID64);
      // EdgeRuntime.waitUntil(register(data.user, steamID64));
    }

    const loginToken = data.properties.hashed_token;
    return { loginToken };
  } catch (error) {
    error.verify = verify;
    error.impersonate = impersonate;
    error.error = error.message;
    error.message = 'Failed to verify Steam login';
    throw error;
  }
};

serve(login);

