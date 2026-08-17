import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminAuthRouter from './quotes/AdminAuthRouter'
import AdminOperationsHub from './quotes/AdminOperationsHub'
import AdminFiscalHub from './quotes/AdminFiscalHub'
import MobileCreateQuoteButton from './quotes/MobileCreateQuoteButton'
import AdminExperienceLayer from './quotes/AdminExperienceLayer'
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
import './nexus-screen.css'
import './portfolio-corrections.css'

const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const isAdminRoute = pathname === '/admin/orcamentos' || window.location.hash === '#admin/orcamentos'

if (isAdminRoute) configureAdminAppShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <><AdminPwaBridge /><AdminPwaUpdater /><AdminOperationsHub /><AdminFiscalHub /><MobileCreateQuoteButton /><AdminExperienceLayer /><SuspendedQuoteGuard /><AdminAuthRouter /></>
    ) : (
      <><App /><PublicPortfolioEnhancements /></>
    )}
  </StrictMode>,
)
