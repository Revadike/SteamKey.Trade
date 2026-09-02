import { serialize } from 'npm:error-serializer';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Serves an HTTP request with the given handler.
 * Supports CORS preflight requests.
 *
 * @param {(data: any, req: Request) => Promise<any>} handler - The request handler.
 * @param {object} [options] - The options for the server.
 * @param {string} [options.method='POST'] - The HTTP method to serve (POST or GET).
 * @param {object} [options.headers={}] - The extra headers to include in the response.
 * @returns {void}
 */
export const serve = (handler, {
  method = 'POST',
  headers = {}
} = {}) => {
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }

  if (!['POST', 'GET'].includes(method)) {
    throw new Error('Unkown method');
  }

  Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== method) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      let data = {};
      if (method === 'POST') {
        data = await req.json();
      } else if (method === 'GET') {
        const url = new URL(req.url);
        data = Object.fromEntries(url.searchParams);
      }

      const result = await handler(data, req) || {};
      console.log(JSON.stringify(result));

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...headers
        }
      });
    } catch (error) {
      error.timestamp = new Date().toISOString();
      console.error(JSON.stringify(serialize(error)));

      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status || 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }
  });
};
