const primaryColor = '#555';
const isProduction = process.env.NODE_ENV === 'production';
const siteName = process.env.SITE_NAME || 'SteamKey.Trade';
const siteUrl = process.env.SITE_URL || 'https://steamkey.trade';
const siteDescription = process.env.SITE_DESCRIPTION || 'SteamKey.Trade is a community-driven platform where gamers can safely and easily trade their Steam keys.';
const ogImage = '/opengraph.png';

export default {
  ssr: false,

  nitro: {
    preset: 'cloudflare-pages',
    prerender: {
      ignore: ['/404']
    }
  },

  app: {
    head: {
      title: siteName,
      htmlAttrs: { lang: 'en', dir: 'ltr' },
      meta: [
        { charset: 'utf-8' },
        { 'http-equiv': 'X-UA-Compatible', 'content': 'IE=edge' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, minimum-scale=1, user-scalable=no' },
        { name: 'description', content: siteDescription },
        { name: 'theme-color', content: primaryColor },
        { name: 'robots', content: isProduction ? 'index, follow' : 'noindex, nofollow' },
        { name: 'designer', content: 'Revadike' },
        { name: 'theme-color', content: primaryColor },
        { name: 'msapplication-navbutton-color', content: primaryColor },
        { name: 'apple-mobile-web-app-status-bar-style', content: primaryColor },

        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: siteName },
        { property: 'og:url', content: siteUrl },
        { property: 'og:title', content: siteName },
        { property: 'og:description', content: siteDescription },
        { property: 'og:image', content: `${siteUrl}${ogImage}` },
        { property: 'og:image:alt', content: siteName },

        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@Revadike' },
        { name: 'twitter:title', content: siteName },
        { name: 'twitter:description', content: siteDescription },
        { name: 'twitter:image', content: `${siteUrl}${ogImage}` }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: siteUrl }
      ]
    }
  },

  css: [
    '@mdi/font/css/materialdesignicons.css',
    '@@/public/icomoon/style.css'
  ],

  runtimeConfig: {
    public: {
      siteName,
      isProduction
    }
  },

  build: {
    transpile: ['vuetify']
  },

  modules: [
    'vuetify-nuxt-module',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@nuxt/eslint',
    '@nuxt/fonts'
  ],

  vuetify: {
    vuetifyOptions: './app/vuetify.config.js'
  },

  supabase: {
    redirect: false // We handle redirects ourselves with Nuxt middleware
  },

  eslint: {
    config: {
      stylistic: false
    }
  },

  vite: {
    optimizeDeps: {
      include: [
        // Supabase and its dependencies
        'cookie',
        '@supabase/postgrest-js',
        '@supabase/supabase-js',

        // Vue Devtools
        '@vue/devtools-core',
        '@vue/devtools-kit',

        // JSON Schema
        'ajv',
        'ajv-formats',

        // others
        'lodash/debounce',
        'uuid',
        'json-to-csv-export',
        'jsonata',
        'markdown-it',
        'cropperjs/dist/cropper.esm'
      ]
    }
  },

  fonts: {
    defaults: {
      weights: [400, 500, 700],
      styles: ['normal']
    }
  },

  piniaPluginPersistedstate: {
    storage: 'localStorage'
  },

  experimental: {
    purgeCachedData: false
  },

  compatibilityDate: '2024-08-13'
};
