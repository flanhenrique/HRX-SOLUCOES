import { useEffect, useState } from 'react'
import './fidelity.css'
import './refinement.css'
import './premium-polish.css'
import './paged-navigation.css'
import './hortifruti-project.css'
import QuoteContactForm from './QuoteContactForm'

type Solution = { icon: string; title: string; description: string }
type Project = {
  id: 'volt' | 'nexus' | 'somma' | 'hortifruti-site' | 'hortifruti-app'
  name: string
  description: string
  tag: string
  href?: string
  linkLabel?: string
}

type PageId = 'inicio' | 'solucoes' | 'projetos' | 'sobre' | 'contato'

const PAGE_IDS: PageId[] = ['inicio', 'solucoes', 'projetos', 'sobre', 'contato']
const PAGE_TITLES: Record<PageId, string> = {
  inicio: 'Início',
  solucoes: 'Soluções',
  projetos: 'Projetos',
  sobre: 'Sobre',
  contato: 'Contato',
}

const VOLT_ICON = 'https://raw.githubusercontent.com/flanhenrique/Volt-consumo/main/icon.svg'
const SOMMA_LOGO = '/somma-logo.svg'
const SOMMA_HERO = 'https://raw.githubusercontent.com/flanhenrique/somma/main/assets/hotel-hero-reference.jpg'
const HORTIFRUTI_URL = 'https://hortifruti-revolucao.onrender.com'

const solutions: Solution[] = [
  { icon: '◎', title: 'Gestão', description: 'Organizamos operações, estruturas e rotinas para gerar mais eficiência, controle e clareza.' },
  { icon: '▣', title: 'Tecnologia', description: 'Desenvolvemos soluções digitais sob medida para automatizar processos e ampliar capacidade.' },
  { icon: '▤', title: 'Documentação', description: 'Estruturamos informações, processos e políticas para trazer segurança, rastreabilidade e agilidade.' },
  { icon: '⚙', title: 'Operações', description: 'Melhoramos fluxos e rotinas para transformar execução em performance sustentável.' },
]

const projects: Project[] = [
  {
    id: 'volt',
    name: 'VOLT',
    tag: 'Energia & água',
    description: 'PWA para registrar leituras e acompanhar o consumo de energia e água, com ciclos, histórico, alertas e relatórios.',
    href: 'https://www.voltconsumo.com.br',
    linkLabel: 'Acessar VOLT',
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    tag: 'Aplicação interna · Intranet',
    description: 'Plataforma corporativa de acesso restrito, desenvolvida para centralizar informações comerciais e operacionais em ambiente interno. Por sua natureza e pelo tratamento de dados empresariais, o NEXUS não possui acesso público na web.',
    linkLabel: 'Aplicação interna · acesso restrito',
  },
  {
    id: 'somma',
    name: 'SOMMA',
    tag: 'Consultoria & gestão',
    description: 'Plataforma e presença institucional para gestão, controladoria e relacionamento da SOMMA com seus clientes.',
    href: 'https://sommaconsulthtl.com.br',
    linkLabel: 'Conhecer SOMMA',
  },
  {
    id: 'hortifruti-site',
    name: 'HORTIFRUTI REVOLUÇÃO',
    tag: 'Site institucional · B2B',
    description: 'Presença institucional premium para apresentar o abastecimento corporativo, serviços, linha de produtos, processo comercial e atendimento empresarial do Hortifruti Revolução.',
    href: HORTIFRUTI_URL,
    linkLabel: 'Conhecer site institucional',
  },
  {
    id: 'hortifruti-app',
    name: 'HORTIFRUTI REVOLUÇÃO',
    tag: 'PWA · Portal do cliente',
    description: 'Aplicativo web para clientes realizarem pedidos, consultarem catálogo e condições comerciais, acompanharem status e histórico, com experiência instalável e notificações.',
    href: `${HORTIFRUTI_URL}/login`,
    linkLabel: 'Acessar aplicativo',
  },
]

function hashPage(): PageId {
  const candidate = window.location.hash.replace('#', '') as PageId
  return PAGE_IDS.includes(candidate) ? candidate : 'inicio'
}

function Brand() {
  return (
    <a className="brand brand-authentic" href="#inicio" aria-label="HRX Solutions - início">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-hr">HR</span>
        <span className="brand-x-shape"><i /><i /></span>
      </span>
      <span className="brand-word">SOLUTIONS</span>
    </a>
  )
}

function HeroShowcase() {
  return (
    <div className="hero-showcase authentic-showcase" aria-label="Projetos HRX">
      <a className="showcase-card showcase-volt authentic-volt" href="https://www.voltconsumo.com.br" target="_blank" rel="noreferrer">
        <div className="showcase-brand-row">
          <img src={VOLT_ICON} alt="" />
          <span>VOLT<small>CONSUMO</small></span>
        </div>
        <strong>Seu consumo mais claro.</strong>
        <p>Energia e água em um só lugar.</p>
        <span className="showcase-action">Abrir projeto ↗</span>
      </a>

      <a className="showcase-card showcase-nexus authentic-nexus" href="#projetos">
        <span className="nexus-wordmark">NEXUS</span>
        <strong>Gestão comercial e operacional.</strong>
        <p>Aplicação interna de intranet para operação corporativa.</p>
        <div className="nexus-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      </a>

      <a
        className="showcase-card showcase-somma authentic-somma"
        href="https://sommaconsulthtl.com.br"
        target="_blank"
        rel="noreferrer"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(16,18,22,.06), rgba(16,18,22,.78)), url(${SOMMA_HERO})` }}
      >
        <img src={SOMMA_LOGO} alt="SOMMA" className="hero-somma-logo" />
        <strong>Gestão com resultado comprovado.</strong>
        <span className="showcase-action">Conhecer projeto ↗</span>
      </a>
    </div>
  )
}

function VoltPreview() {
  return (
    <div className="project-visual real-preview volt-real-preview" aria-label="Tela inicial do VOLT">
      <div className="project-browser volt-browser volt-dashboard-browser">
        <div className="project-browser-top"><i /><i /><i /><span>voltconsumo.com.br</span></div>
        <div className="volt-dashboard-shot">
          <aside className="volt-mini-sidebar">
            <div className="volt-lockup volt-dashboard-lockup"><img src={VOLT_ICON} alt="" /><b>VOLT<small>CONSUMO</small></b></div>
            <span className="volt-mini-nav active">⌂ <b>Início</b></span>
            <span className="volt-mini-nav">▥ <b>Consumo</b></span>
            <span className="volt-mini-nav">▤ <b>Leituras</b></span>
            <span className="volt-mini-nav">◌ <b>Alertas</b></span>
          </aside>
          <div className="volt-mini-main">
            <div className="volt-mini-heading">
              <div><span>VISÃO GERAL</span><strong>Olá, Henrique!</strong></div>
              <span className="volt-cycle-pill">Ciclo atual</span>
            </div>
            <div className="volt-utility-grid">
              <article className="volt-utility-card energy">
                <span>ENERGIA</span>
                <strong>50 kWh</strong>
                <small>Última leitura: 28.402 kWh</small>
                <i><b style={{ width: '42%' }} /></i>
                <em>Dentro da meta</em>
              </article>
              <article className="volt-utility-card water">
                <span>ÁGUA</span>
                <strong>—</strong>
                <small>Aguardando nova leitura</small>
                <i><b style={{ width: '8%' }} /></i>
                <em>Sem leitura no período</em>
              </article>
            </div>
            <div className="volt-mini-lower">
              <article className="volt-mini-chart">
                <span>EVOLUÇÃO DO CONSUMO</span>
                <div aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
              </article>
              <article className="volt-mini-insight">
                <span>INSIGHT</span>
                <strong>Consumo dentro do planejado</strong>
                <p>Acompanhe suas próximas leituras para manter a projeção atualizada.</p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NexusPreview() {
  return (
    <div className="project-visual real-preview nexus-login-preview" aria-label="Tela de login do MAP.i Nexus">
      <div className="project-browser nexus-browser">
        <div className="project-browser-top nexus-browser-top"><i /><i /><i /><span>MAP.i Nexus · intranet · acesso restrito</span></div>
        <div className="nexus-login-shot">
          <section className="nexus-login-branding">
            <span className="nexus-map-mark">MAP.i</span>
            <strong>NEXUS</strong>
            <p>Inteligência para gestão comercial e operacional.</p>
            <div className="nexus-login-grid" aria-hidden="true"><i /><i /><i /><i /></div>
          </section>
          <section className="nexus-login-form">
            <span>ACESSO À INTRANET</span>
            <strong>Bem-vindo ao Nexus</strong>
            <p>Entre com suas credenciais para continuar.</p>
            <label><small>E-mail</small><i>nome@empresa.com.br</i></label>
            <label><small>Senha</small><i>••••••••••</i></label>
            <button type="button">Entrar</button>
            <em>Ambiente interno · acesso restrito</em>
          </section>
        </div>
      </div>
    </div>
  )
}

function SommaPreview() {
  return (
    <div className="project-visual real-preview somma-real-preview" aria-label="Visualização do site da SOMMA">
      <div className="project-browser somma-browser">
        <div className="project-browser-top somma-browser-top"><i /><i /><i /><span>sommaconsulthtl.com.br</span></div>
        <div className="somma-site-shot" style={{ backgroundImage: `linear-gradient(90deg, rgba(17,17,20,.92), rgba(17,17,20,.30)), url(${SOMMA_HERO})` }}>
          <div className="somma-mini-nav">
            <img src={SOMMA_LOGO} alt="SOMMA Consultoria Hoteleira & Condomínios" />
            <span>Início</span><span>Soluções</span><span>Sobre</span><span>Cases</span><span>Contato</span>
          </div>
          <div className="somma-mini-copy">
            <span>CONSULTORIA HOTELEIRA & CONDOMÍNIOS</span>
            <strong>Gestão financeira, controladoria e processos <em>com resultado comprovado.</em></strong>
            <p>Diagnóstico, implantação e acompanhamento contínuo.</p>
            <i>Conheça nossas soluções →</i>
          </div>
        </div>
      </div>
    </div>
  )
}

function HortiBrandMini() {
  return (
    <div className="horti-brand-mini" aria-label="Hortifruti Revolução">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 40V17" />
        <path d="M24 27C15 26 10 20 10 11c9 0 14 5 14 16Z" />
        <path d="M24 22C30 22 36 17 38 9c-8-1-14 4-14 13Z" />
        <path d="M24 34c-7 0-12-4-14-10 7-1 12 3 14 10Z" />
        <path d="M24 31c6 0 11-3 14-9-7-1-12 2-14 9Z" />
      </svg>
      <span>REVOLUÇÃO<small>HORTIFRUTI</small></span>
    </div>
  )
}

function HortiSitePreview() {
  return (
    <div className="project-visual real-preview horti-preview" aria-label="Visualização do site institucional do Hortifruti Revolução">
      <div className="horti-browser">
        <div className="horti-browser-top"><i /><i /><i /><span>hortifruti-revolucao.onrender.com</span></div>
        <div className="horti-site-shot">
          <div className="horti-site-nav">
            <HortiBrandMini />
            <div><span>Serviços</span><span>Produtos</span><span>Como funciona</span><span>Sobre</span></div>
          </div>
          <div className="horti-site-copy">
            <span>HORTIFRUTI PARA EMPRESAS</span>
            <strong>Abastecimento profissional, do pedido à entrega.</strong>
            <p>Fornecimento organizado para operações empresariais com padrão comercial e acompanhamento.</p>
            <i className="horti-site-cta">Conhecer serviços</i>
          </div>
          <div className="horti-produce-grid" aria-hidden="true"><i>FR</i><i>LG</i><i>FL</i><i>TP</i></div>
        </div>
      </div>
    </div>
  )
}

function HortiAppPreview() {
  return (
    <div className="project-visual real-preview horti-preview" aria-label="Visualização do aplicativo do Hortifruti Revolução">
      <div className="horti-browser horti-app-browser">
        <div className="horti-browser-top"><i /><i /><i /><span>hortifruti-revolucao.onrender.com/cliente</span></div>
        <div className="horti-app-shot">
          <aside className="horti-app-sidebar">
            <HortiBrandMini />
            <div className="horti-app-nav"><span>Início</span><span>Novo pedido</span><span>Pedidos</span><span>Catálogo</span></div>
          </aside>
          <div className="horti-app-main">
            <div className="horti-app-heading">
              <div><span>PORTAL DO CLIENTE</span><strong>Visão geral</strong></div>
              <em>PWA instalado</em>
            </div>
            <div className="horti-app-cards">
              <article><span>PEDIDOS ATIVOS</span><strong>03</strong></article>
              <article><span>ITENS NO CATÁLOGO</span><strong>150+</strong></article>
            </div>
            <div className="horti-app-list">
              <span>ÚLTIMO PEDIDO</span>
              <div className="horti-app-row"><div><b>#HR-0028</b><br /><small>12 itens · entrega programada</small></div><i>Em separação</i></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectVisual({ id }: { id: Project['id'] }) {
  if (id === 'volt') return <VoltPreview />
  if (id === 'somma') return <SommaPreview />
  if (id === 'hortifruti-site') return <HortiSitePreview />
  if (id === 'hortifruti-app') return <HortiAppPreview />
  return <NexusPreview />
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<PageId>(() => hashPage())
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const syncPage = () => {
      const nextPage = hashPage()
      setActiveSection(nextPage)
      setMenuOpen(false)
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    syncPage()
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  useEffect(() => {
    document.title = `${PAGE_TITLES[activeSection]} | HRX Solutions`
  }, [activeSection])

  const navClass = (section: PageId, extra = '') => `${activeSection === section ? 'is-active ' : ''}${extra}`.trim()
  const pageClass = (section: PageId, extra = '') => `page-view ${activeSection === section ? 'is-active ' : ''}${extra}`.trim()

  return (
    <div className="site-shell paged-site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <button className="menu-button" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span /><span /><span /></button>
          <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'} aria-label="Navegação principal">
            <a className={navClass('inicio')} aria-current={activeSection === 'inicio' ? 'page' : undefined} href="#inicio" onClick={closeMenu}>Início</a>
            <a className={navClass('solucoes')} aria-current={activeSection === 'solucoes' ? 'page' : undefined} href="#solucoes" onClick={closeMenu}>Soluções</a>
            <a className={navClass('projetos')} aria-current={activeSection === 'projetos' ? 'page' : undefined} href="#projetos" onClick={closeMenu}>Projetos</a>
            <a className={navClass('sobre')} aria-current={activeSection === 'sobre' ? 'page' : undefined} href="#sobre" onClick={closeMenu}>Sobre</a>
            <a className={navClass('contato')} aria-current={activeSection === 'contato' ? 'page' : undefined} href="#contato" onClick={closeMenu}>Contato</a>
            <a className="nav-cta" href="#contato" onClick={closeMenu}>Solicitar proposta</a>
          </nav>
        </div>
      </header>

      <main className="paged-main">
        <section id="inicio" className={pageClass('inicio', 'hero section-grid')} aria-hidden={activeSection !== 'inicio'}>
          <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" /><div className="x-lines" aria-hidden="true"><i /><i /><i /></div>
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">HRX SOLUTIONS · MANAUS / AM</p>
              <h1>Soluções <em>inteligentes.</em><br />Resultados <em>reais.</em></h1>
              <p className="hero-text">Conte o que precisa funcionar melhor. A HRX organiza a necessidade, estrutura o escopo e transforma a demanda em uma solução e uma proposta claras.</p>
              <div className="hero-actions">
                <a className="button button-primary" href="#contato">Solicitar análise do projeto <span>→</span></a>
                <a className="button button-secondary" href="#projetos">Ver projetos <span>→</span></a>
              </div>
              <div className="hero-pill-row" aria-label="Como funciona a solicitação">
                <span>1 · Conte a necessidade</span><span>2 · Análise HRX</span><span>3 · Escopo e proposta</span>
              </div>
            </div>
            <HeroShowcase />
          </div>
        </section>

        <section id="solucoes" className={pageClass('solucoes', 'section solutions-section')} aria-hidden={activeSection !== 'solucoes'}>
          <div className="container section-layout">
            <div className="section-intro">
              <p className="eyebrow">NOSSAS SOLUÇÕES</p>
              <h2>Soluções completas para o seu negócio.</h2>
              <p>Da organização da operação à construção de soluções digitais, estruturamos o que precisa funcionar melhor.</p>
            </div>
            <div className="solution-grid">
              {solutions.map((solution) => (
                <article className="solution-card" key={solution.title}>
                  <span className="solution-icon" aria-hidden="true">{solution.icon}</span>
                  <h3>{solution.title}</h3>
                  <p>{solution.description}</p>
                  <a href="#contato">Solicitar análise <span>→</span></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="projetos" className={pageClass('projetos', 'section projects-section')} aria-hidden={activeSection !== 'projetos'}>
          <div className="container">
            <div className="section-heading-row">
              <div><p className="eyebrow">NOSSOS PROJETOS</p><h2>Produtos e projetos que nascem de problemas reais.</h2></div>
              <p>VOLT, NEXUS, SOMMA e HORTIFRUTI REVOLUÇÃO mostram como a HRX combina operação, tecnologia e execução — do posicionamento institucional a aplicações completas.</p>
            </div>
            <div className="projects-grid">
              {projects.map((project) => (
                <article className={`project-card ${project.id}`} key={project.id}>
                  <div className="project-copy">
                    <span className="project-tag">{project.tag}</span>
                    <h3>{project.name}</h3>
                    <p>{project.description}</p>
                    {project.href ? (
                      <a className="project-status project-link" href={project.href} target="_blank" rel="noreferrer">{project.linkLabel} <b>↗</b></a>
                    ) : (
                      <span className="project-status project-internal">{project.linkLabel} <b>•</b></span>
                    )}
                  </div>
                  <ProjectVisual id={project.id} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="sobre" className={pageClass('sobre', 'section about-section')} aria-hidden={activeSection !== 'sobre'}>
          <div className="container about-grid">
            <div className="manaus-panel" aria-hidden="true"><div className="map-outline"><span className="map-pin">●</span></div><strong>Manaus / AM</strong></div>
            <div className="about-copy">
              <p className="eyebrow">SOBRE A HRX</p>
              <h2>Organização. Tecnologia. Estratégia. Soluções que transformam.</h2>
              <p>A HRX Solutions nasce em Manaus, Amazonas, para estruturar operações, transformar necessidades em sistemas e construir soluções com utilidade prática.</p>
              <p>Cada entrega parte de um problema concreto, de uma operação que precisa funcionar melhor e de um resultado que precisa ser mensurável.</p>
            </div>
          </div>
        </section>

        <section id="contato" className={pageClass('contato', 'section contact-section')} aria-hidden={activeSection !== 'contato'}>
          <div className="container contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">SOLICITE UMA PROPOSTA</p>
              <h2>Conte o que precisa funcionar melhor.</h2>
              <p>Informe o tipo de necessidade, o cenário atual e o prazo. A solicitação é registrada e pré-classificada para apoiar a análise; a HRX valida o escopo antes de definir qualquer proposta comercial.</p>
              <div className="contact-channels">
                <a href="mailto:contato@hrxsolutions.com.br">contato@hrxsolutions.com.br</a>
                <a href="mailto:comercial@hrxsolutions.com.br">comercial@hrxsolutions.com.br</a>
              </div>
              <div className="location-pill">Manaus, Amazonas · Brasil</div>
            </div>
            <QuoteContactForm />
          </div>
        </section>
      </main>

      <footer className="executive-footer">
        <div className="container">
          <div className="footer-executive-grid">
            <div className="footer-brand-copy">
              <Brand />
              <p>Soluções em gestão, tecnologia, documentação e operações, estruturadas a partir de necessidades reais.</p>
              <span className="footer-location">Manaus, Amazonas · Brasil</span>
            </div>
            <div className="footer-column">
              <strong>NAVEGAÇÃO</strong>
              <a href="#solucoes">Soluções</a>
              <a href="#projetos">Projetos</a>
              <a href="#sobre">Sobre</a>
              <a href="#contato">Solicitar proposta</a>
            </div>
            <div className="footer-column">
              <strong>CONTATO</strong>
              <a href="mailto:contato@hrxsolutions.com.br">contato@hrxsolutions.com.br</a>
              <a href="mailto:comercial@hrxsolutions.com.br">comercial@hrxsolutions.com.br</a>
              <span>CNPJ 68.588.217/0001-06</span>
            </div>
          </div>
          <div className="footer-meta">
            <span>© 2026 HRX Solutions. Todos os direitos reservados.</span>
            <span className="footer-accounting">
              Responsabilidade contábil: Raisa da Silva Pereira · SOMMA ·{' '}
              <a href="https://wa.me/5592982137652" target="_blank" rel="noreferrer">WhatsApp</a>
              {' · '}
              <a href="mailto:raisa.pereira.92@hotmail.com">E-mail</a>
            </span>
            <a href="#inicio">Voltar ao início ↑</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
