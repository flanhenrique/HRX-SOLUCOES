import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminQuotes from './quotes/AdminQuotes'
import AdminPwaBridge from './AdminPwaBridge'
import './styles.css'

const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const isAdminRoute = pathname === '/admin/orcamentos' || window.location.hash === '#admin/orcamentos'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <><AdminPwaBridge /><AdminQuotes /></> : <App />}
  </StrictMode>,
)
