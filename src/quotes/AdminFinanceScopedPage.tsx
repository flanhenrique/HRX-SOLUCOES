import { useEffect, useState } from 'react'
import AdminFinancePage from './AdminFinancePage'
import AdminPersonalFinancePage from './AdminPersonalFinancePage'
import { useAdminRoute } from './AdminRouteContext'
import { navigateAdmin } from './adminNavigation'
import './admin-finance-scope.css'

type FinanceScope = 'business' | 'personal'

export default function AdminFinanceScopedPage() {
  const route = useAdminRoute()
  const businessRoute = route.subroute?.id === 'finance-receivable' || route.subroute?.id === 'finance-payable'
  const [scope, setScope] = useState<FinanceScope>(() => {
    const saved = window.sessionStorage.getItem('hrx-finance-scope')
    return saved === 'personal' ? 'personal' : 'business'
  })
  const activeScope: FinanceScope = businessRoute ? 'business' : scope

  useEffect(() => {
    if (!businessRoute) return
    if (scope !== 'business') setScope('business')
    window.sessionStorage.setItem('hrx-finance-scope', 'business')
  }, [businessRoute, scope])

  const selectScope = (next: FinanceScope) => {
    if (next === 'personal' && businessRoute) navigateAdmin('finance')
    setScope(next)
    window.sessionStorage.setItem('hrx-finance-scope', next)
  }

  return <div className="finance-scope-root" data-finance-scope={activeScope}>
    <div className="finance-scope-selector" role="group" aria-label="Escopo financeiro">
      <div><span>ESCOPO FINANCEIRO</span><strong>{activeScope === 'business' ? 'HRX Solutions' : 'Pessoal'}</strong></div>
      <div className="finance-scope-buttons">
        <button type="button" className={activeScope === 'business' ? 'is-active' : ''} aria-pressed={activeScope === 'business'} onClick={() => selectScope('business')}>HRX Solutions</button>
        <button type="button" className={activeScope === 'personal' ? 'is-active' : ''} aria-pressed={activeScope === 'personal'} onClick={() => selectScope('personal')}>Pessoal</button>
      </div>
    </div>
    {activeScope === 'business' ? <AdminFinancePage /> : <AdminPersonalFinancePage />}
  </div>
}
