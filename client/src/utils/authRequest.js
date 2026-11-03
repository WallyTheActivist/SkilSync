export const isAuthenticationRequest = (url) => {
  if (typeof url !== 'string') return false;

  const path = url
    .replace(/^https?:\/\/[^/]+/i, '')
    .split(/[?#]/, 1)[0];

  return path === '/auth'
    || path.startsWith('/auth/')
    || path === '/api/auth'
    || path.startsWith('/api/auth/');
};
