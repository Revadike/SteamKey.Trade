<script setup>
  const snackbarStore = useSnackbarStore();
  const supabase = useSupabaseClient();
  const { User } = useORM();

  const { isLoggedIn, fromPath } = storeToRefs(useAuthStore());
  const loggingIn = ref(false);

  const signInWithSteam = async () => {
    const redirectURL = new URL('https://steamcommunity.com/openid/login');
    redirectURL.searchParams.append('openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select');
    redirectURL.searchParams.append('openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select');
    redirectURL.searchParams.append('openid.mode', 'checkid_setup');
    redirectURL.searchParams.append('openid.ns', 'http://specs.openid.net/auth/2.0');
    redirectURL.searchParams.append('openid.realm', location.origin);
    redirectURL.searchParams.append('openid.return_to', `${location.origin}/login`);

    return navigateTo(redirectURL.href, { external: true });
  };

  onMounted(async () => {
    const { currentRoute } = useRouter();
    const { query } = currentRoute.value;

    if (isLoggedIn.value) {
      await navigateTo(fromPath.value || '/');
    } else if (query['openid.identity'] && query['openid.sig'] && query['openid.signed'] && query['openid.assoc_handle']) {
      loggingIn.value = true;

      try {
        await User.login(supabase, location.href);
      } catch (error) {
        console.error(error.message);
        snackbarStore.set('error', 'Something went wrong, please try again.');
      }

      loggingIn.value = false;
      await navigateTo(fromPath.value || '/');
    } else {
      await signInWithSteam();
    }
  });

  const title = 'Login';
  useSeoMeta({ title, ogTitle: title });
  definePageMeta({
    layout: 'empty',
    middleware: 'anonymous'
  });
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center">
      <v-col cols="auto">
        <template v-if="loggingIn">
          <v-progress-circular
            indeterminate
            size="128"
          />
        </template>
        <template v-else>
          <nuxt-link
            v-if="isLoggedIn"
            :to="fromPath || '/'"
          >
            {{ 'Click here' }}
          </nuxt-link>
          <span
            v-else
            class="cursor-pointer"
            @click="signInWithSteam"
          >
            Click here
          </span>
          if you are not redirected automatically.
        </template>
      </v-col>
    </v-row>
  </v-container>
</template>
