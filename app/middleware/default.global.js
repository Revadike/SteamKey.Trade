export default defineNuxtRouteMiddleware((to) => {
  const { setFromPath } = useAuthStore();

  if (!to.fullPath.startsWith('/login') && !to.fullPath.startsWith('/logout')) {
    setFromPath(to.fullPath);
  }
});
