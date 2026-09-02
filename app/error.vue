<script setup>
  const error = useError();

  let statusMessage;
  switch (error.value.statusCode) {
    case 404:
      statusMessage = 'Not found';
      break;
    case 401:
    case 403:
      statusMessage = 'Access denied';
      break;
    default:
      console.error(error);
      statusMessage = 'Something went wrong';
      break;
  }

  const handleError = () => {
    clearError({
      redirect: '/'
    });
  };

  const title = computed(() => `${error.value.statusCode} - ${error.value.statusMessage || statusMessage}`);
  const description = computed(() => error.value.message || statusMessage);
  useSeoMeta({
    title,
    ogTitle: title,
    description,
    ogDescription: description
  });
</script>

<template>
  <v-app>
    <v-container class="fill-height">
      <v-row justify="center">
        <v-col
          class="text-center"
          cols="auto"
        >
          <h1>{{ error.statusCode }} - {{ error.statusMessage || statusMessage }}</h1>
          <p v-if="error.message">
            {{ error.message }}
          </p>
          <v-btn
            class="mt-4"
            variant="text"
            @click="handleError"
          >
            Continue to homepage
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>
