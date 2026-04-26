<script setup>
  const { isLoggedIn } = storeToRefs(useAuthStore());

  const title = computed(() => {
    return `${isLoggedIn.value ? 'My ' : ''}Trade Activity`;
  });
</script>

<template>
  <trade-activity
    class="h-100"
    :limit="10"
    :show-trade-links="true"
    :title="title"
    title-center
  />
</template>