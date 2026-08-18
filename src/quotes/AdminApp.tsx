import AdminQuotes from './AdminQuotes'
import AdminClientsPage from './AdminClientsPage'
import AdminSuspensionsPage from './AdminSuspensionsPage'
import AdminDocumentsPage from './AdminDocumentsPage'
import AdminFiscalPage from './AdminFiscalPage'
import AdminProjectPanelsPage from './AdminProjectPanelsPage'
import AdminExecutiveDashboard from './AdminExecutiveDashboard'
import AdminDesktopNavigation from './AdminDesktopNavigation'
import AdminExperienceLayer from './AdminExperienceLayer'
import SuspendedQuoteGuard from './SuspendedQuoteGuard'

export default function AdminApp() {
  return <>
    <AdminQuotes />
    <AdminClientsPage />
    <AdminSuspensionsPage />
    <AdminDocumentsPage />
    <AdminFiscalPage />
    <AdminProjectPanelsPage />
    <AdminExecutiveDashboard />
    <AdminDesktopNavigation />
    <AdminExperienceLayer />
    <SuspendedQuoteGuard />
  </>
}
