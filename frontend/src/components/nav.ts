export interface NavItem {
  to: string
  label: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Library', icon: '📚' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]
