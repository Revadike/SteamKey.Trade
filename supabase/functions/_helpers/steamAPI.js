import EResult from 'npm:steam-user/enums/EResult.js';

/**
 * Make a request to Steam Web API
 *
 * @param {string} iface - The WebAPI interface that you want to use
 * @param {string} method - The WebAPI method that you want to use
 * @param {string} version - The version of the WebAPI to use
 * @param {Object} config - Fetch config
 *
 * @return {Promise<Object>} - The response from the WebAPI
 * @throws {Error} - If the request fails
 */
export const steamApiRequest = async (iface, method, version = 'v1', config = {}) => {
  const url = new URL(`https://api.steampowered.com/${iface}/${method}/${version}`);
  const params = new URLSearchParams({
    ...config.params,
    key: Deno.env.get('STEAM_API_KEY')
  });
  url.search = params.toString();

  const response = await fetch(url, {
    ...config,
    headers: {
      ...config.headers
    }
  });

  const error = new Error();
  error.status = response.status;

  if (response.status !== 200) {
    error.message = `HTTP error ${response.status}`;
    throw error;
  }

  if (response.headers.get('x-eresult')) {
    error.eresult = parseInt(response.headers.get('x-eresult'), 10);

    if (error.eresult !== EResult.OK) {
      error.message = response.headers.get('x-error_message') || EResult[error.eresult];
      throw error;
    }
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    error.message = `Invalid content type: ${contentType}`;
    throw error;
  }

  const data = await response.json();
  if (data?.response) {
    return data.response;
  }

  return data;
};
