export default defineNuxtRouteMiddleware((to, from) => {
  const { setFromPath } = useAuthStore();
  const { isLoggedIn } = storeToRefs(useAuthStore());

  // Prevent logged-out users from being redirected to an authenticated page
  if (!isLoggedIn.value && from.fullPath.startsWith('/logout')) {
    return navigateTo('/');
  }

  if (!to.fullPath.startsWith('/login') && !to.fullPath.startsWith('/logout')) {
    setFromPath(to.fullPath);
  }

  if (!isLoggedIn.value) {
    return navigateTo('/login');
  }
});
