import { useState } from 'react'
import AdminFinancePage from './AdminFinancePage'
import AdminPersonalFinancePage from './AdminPersonalFinancePage'
import './admin-finance-scope.css'

type FinanceScope = 'business' | 'personal'

export default function AdminFinanceScopedPage() {
  const [scope, setScope] = useState<FinanceScope>(() => {
    const saved = window.sessionStorage.getItem('hrx-finance-scope')
    return saved === 'personal' ? 'personal' : 'business'
  })

  const selectScope = (next: FinanceScope) => {
    setScope(next)
    window.sessionStorage.setItem('hrx-finance-scope', next)
  }

  return <div className="finance-scope-root" data-finance-scope={scope}>
    <div className="finance-scope-selector" role="group" aria-label="Escopo financeiro">
      <div><span>ESCOPO FINANCEIRO</span><strong>{scope === 'business' ? 'HRX Solutions' : 'Pessoal'}</strong></div>
      <div className="finance-scope-buttons">
        <button type="button" className={scope === 'business' ? 'is-active' : ''} aria-pressed={scope === 'business'} onClick={() => selectScope('business')}>HRX Solutions</button>
        <button type="button" className={scope === 'personal' ? 'is-active' : ''} aria-pressed={scope === 'personal'} onClick={() => selectScope('personal')}>Pessoal</button>
      </div>
    </div>
    {scope === 'business' ? <AdminFinancePage /> : <AdminPersonalFinancePage />}
  </div>
}
