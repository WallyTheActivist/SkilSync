export const normalizeEmployerProfileUpdate = (form) => ({
  ...form,
  website: form.website.trim() || null,
});
