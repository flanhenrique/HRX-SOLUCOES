import AdminQuotes from './AdminQuotes'
import AdminSuspensionsPage from './AdminSuspensionsPage'
import AdminFiscalPage from './AdminFiscalPage'
import AdminExperienceLayer from './AdminExperienceLayer'
import SuspendedQuoteGuard from './SuspendedQuoteGuard'
import './admin-page-system.css'
import './admin-feedback.css'
import './admin-interactions.css'
import './admin-executive-intelligence.css'
import './admin-liquid-glass.css'

export default function AdminApp() {
  return <>
    <AdminQuotes />
    <AdminSuspensionsPage />
    <AdminFiscalPage />
    <AdminExperienceLayer />
    <SuspendedQuoteGuard />
  </>
}
