import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminAuthRouter from './quotes/AdminAuthRouter'
import AdminPwaBridge from './AdminPwaBridge'
import AdminPwaUpdater from './AdminPwaUpdater'
import PublicPortfolioEnhancements from './PublicPortfolioEnhancements'
import { configureAdminAppShell } from './quotes/adminAppShell'
import './styles.css'
import './brand-fix.css'
import './quotes/rules.css'
import './quotes/app-shell.css'
import './quotes/admin-refresh.css'
import './nexus-screen.css'
import './portfolio-corrections.css'

const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const adminHashes = new Set(['#admin/orcamentos', '#admin/painels'])
const isAdminPath = pathname === '/admin/orcamentos' || pathname.startsWith('/admin/')
const isAdminRoute = isAdminPath || adminHashes.has(window.location.hash)

if (isAdminRoute) configureAdminAppShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <><AdminPwaBridge /><AdminPwaUpdater /><AdminAuthRouter /></>
    ) : (
      <><App /><PublicPortfolioEnhancements /></>
    )}
  </StrictMode>,
)
