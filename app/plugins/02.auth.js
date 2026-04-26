export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();
  const supabase = useSupabaseClient();
  supabase.auth.onAuthStateChange(authStore.onAuthStateChange);
});