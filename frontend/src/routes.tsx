import type { RouteObject } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'

export const routes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  { path: 'change-password', element: <ChangePasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <LibraryPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
