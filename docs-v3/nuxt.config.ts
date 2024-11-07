// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@nuxt/ui-pro',
    'nuxt-og-image',
    '@nuxtjs/plausible',
  ],
  future: {
    compatibilityVersion: 4,
  },
  // nitro: {
  //   prerender: {
  //     routes: [
  //       '/api/search.json',
  //     ],
  //   },
  // },
  // Essential for OgImage on `nuxt generate`
  // https://github.com/harlan-zw/nuxt-og-image/blob/c89fd4e29f56eeb00b12bc0d7e4bcb82ab459cae/src/module.ts#L127C16-L127C16
  // site: {
  //   url: 'https://supabase.nuxtjs.org',
  // },
  content: {
    database: {
      type: 'd1',
      binding: 'DB',
    },
  },
  // github: {
  //   repo: 'nuxt-modules/supabase',
  // },
})
