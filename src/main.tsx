import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminAuthRouter from './quotes/AdminAuthRouter'
import AdminBootstrapAccess from './quotes/AdminBootstrapAccess'
import AdminPasswordControl from './quotes/AdminPasswordControl'
import AdminPwaBridge from './AdminPwaBridge'
import AdminPwaUpdater from './AdminPwaUpdater'
import { configureAdminAppShell } from './quotes/adminAppShell'
import './styles.css'
import './brand-fix.css'
import './quotes/rules.css'
import './quotes/app-shell.css'

const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const isAdminRoute = pathname === '/admin/orcamentos' || window.location.hash === '#admin/orcamentos'

if (isAdminRoute) configureAdminAppShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <><AdminPwaBridge /><AdminPwaUpdater /><AdminBootstrapAccess /><AdminPasswordControl /><AdminAuthRouter /></> : <App />}
  </StrictMode>,
)
