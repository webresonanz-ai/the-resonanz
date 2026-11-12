export function getAuthRedirect(redirect) {
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/'
  }

  const path = redirect.split(/[?#]/, 1)[0]
  if (path === '/login' || path === '/register') return '/'

  return redirect
}
