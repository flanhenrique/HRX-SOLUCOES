import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminAuthRouter from './quotes/AdminAuthRouter'
import AdminOperationsHub from './quotes/AdminOperationsHub'
import AdminDocumentsHub from './quotes/AdminDocumentsHub'
import AdminFiscalHub from './quotes/AdminFiscalHub'
import AdminProjectPanels from './quotes/AdminProjectPanels'
import AdminExperienceLayer from './quotes/AdminExperienceLayer'
import AdminLegacyNavigationBridge from './quotes/AdminLegacyNavigationBridge'
import SuspendedQuoteGuard from './quotes/SuspendedQuoteGuard'
import AdminPwaBridge from './AdminPwaBridge'
import AdminPwaUpdater from './AdminPwaUpdater'
import PublicPortfolioEnhancements from './PublicPortfolioEnhancements'
import { configureAdminAppShell } from './quotes/adminAppShell'
import './styles.css'
import './brand-fix.css'
import './quotes/rules.css'
import './quotes/app-shell.css'
import './quotes/admin-fiscal-manual-state.css'
import './quotes/admin-refresh.css'
import './quotes/mobile-create-quote.css'
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
      <><AdminPwaBridge /><AdminPwaUpdater /><AdminOperationsHub /><AdminDocumentsHub /><AdminFiscalHub /><AdminProjectPanels /><AdminLegacyNavigationBridge /><AdminExperienceLayer /><SuspendedQuoteGuard /><AdminAuthRouter /></>
    ) : (
      <><App /><PublicPortfolioEnhancements /></>
    )}
  </StrictMode>,
)
