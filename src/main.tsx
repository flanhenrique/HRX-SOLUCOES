import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminAuthRouter from './quotes/AdminAuthRouter'
import AdminOperationsHub from './quotes/AdminOperationsHub'
import AdminDocumentsHub from './quotes/AdminDocumentsHub'
import VoltZipImporter from './quotes/VoltZipImporter'
import VoltDocumentFolders from './quotes/VoltDocumentFolders'
import AdminFiscalPage from './quotes/AdminFiscalPage'
import AdminProjectPanelsPage from './quotes/AdminProjectPanelsPage'
import AdminExecutiveDashboard from './quotes/AdminExecutiveDashboard'
import AdminExperienceLayer from './quotes/AdminExperienceLayer'
import AdminDesktopNavigation from './quotes/AdminDesktopNavigation'
import SuspendedQuoteGuard from './quotes/SuspendedQuoteGuard'
import AdminPwaBridge from './AdminPwaBridge'
import AdminPwaUpdater from './AdminPwaUpdater'
import PublicPortfolioEnhancements from './PublicPortfolioEnhancements'
import { configureAdminAppShell } from './quotes/adminAppShell'
import './styles.css'
import './brand-fix.css'
import './quotes/rules.css'
import './quotes/app-shell.css'
import './quotes/admin-refresh.css'
import './quotes/mobile-create-quote.css'
import './quotes/volt-zip-importer.css'
import './quotes/volt-document-folders.css'
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
      <><AdminPwaBridge /><AdminPwaUpdater /><AdminOperationsHub /><AdminDocumentsHub /><VoltZipImporter /><VoltDocumentFolders /><AdminFiscalPage /><AdminProjectPanelsPage /><AdminExecutiveDashboard /><AdminDesktopNavigation /><AdminExperienceLayer /><SuspendedQuoteGuard /><AdminAuthRouter /></>
    ) : (
      <><App /><PublicPortfolioEnhancements /></>
    )}
  </StrictMode>,
)
