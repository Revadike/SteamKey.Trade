export default defineNuxtRouteMiddleware(() => {
  const { isLoggedIn } = useAuthStore();

  if (!isLoggedIn) {
    return;
  }

  return navigateTo('/');
});
