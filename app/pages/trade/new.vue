<script setup>
  import { isSteamID64 } from '~/assets/js/validate';

  const route = useRoute();
  const partnerQuery = route.query.partner;
  const isSteamId = partnerQuery && isSteamID64(partnerQuery);

  const { data: resolvedId } = useSupabaseData('user-id', { steamId: isSteamId ? partnerQuery : undefined });
  const resolvedPartnerId = computed(() => resolvedId.value || partnerQuery);

  definePageMeta({
    middleware: 'authenticated'
  });
</script>

<template>
  <trade-edit
    v-if="!route.query.partner || resolvedPartnerId"
    :copy-id="route.query.copy"
    :counter-id="route.query.counter"
    :receiver="resolvedPartnerId"
    :receiver-selected="route.query.receiverapps ? route.query.receiverapps.split(',').map(Number) : []"
    :sender-selected="route.query.senderapps ? route.query.senderapps.split(',').map(Number) : []"
  />
</template>
