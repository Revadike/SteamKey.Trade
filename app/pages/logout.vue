<script setup>
  const client = useSupabaseClient();
  const { fromPath } = storeToRefs(useAuthStore());

  const logout = async () => {
    clearTimeout(timeoutId);

    await client.auth.signOut();
    await navigateTo(fromPath.value || '/');
  };

  const timeoutId = setTimeout(logout, 500);

  const title = 'Logging out...';
  useSeoMeta({ title, ogTitle: title });
  definePageMeta({
    layout: 'empty',
    middleware: 'authenticated'
  });
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center">
      <v-col cols="auto">
        <a
          href="/"
          @click.prevent="logout"
          v-text="'Click here'"
        /> if you are not redirected automatically.
      </v-col>
    </v-row>
  </v-container>
</template>
