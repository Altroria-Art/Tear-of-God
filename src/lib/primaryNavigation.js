export function primaryNavigation(user) {
  return [
    { to: '/', icon: 'home', label: 'nav.home', exact: true },
    { to: '/discover', icon: 'discover', label: 'nav.discover' },
    { to: '/create', icon: 'create', label: 'nav.create', prominent: true },
    user ? { to: '/profile', icon: 'profile', label: 'nav.profile' }
      : { to: '/login', icon: 'profile', label: 'nav.login' },
  ];
}

export function navigationIsActive(pathname, item, user) {
  if (item.exact) return pathname === item.to;
  if (item.to === '/profile') return pathname === '/profile' || pathname === `/profile/${user?.id}`;
  if (item.to === '/create') return pathname === '/create' || pathname === '/rank';
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function usesEditorNavigation(pathname) {
  return ['/create', '/rank', '/admin'].some(path => pathname === path || pathname.startsWith(`${path}/`));
}
