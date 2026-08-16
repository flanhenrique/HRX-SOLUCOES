import { useState } from 'react'
import './fidelity.css'
import './refinement.css'
import './contact.css'
import QuoteRequestForm from './quotes/QuoteRequestForm'
import AdminQuotes from './quotes/AdminQuotes'

type Solution = { icon: string; title: string; description: string }
type Project = {
  id: 'volt' | 'nexus' | 'somma'
  name: string
  description: string
  tag: string
  href?: string
  linkLabel?: string
}

const VOLT_ICON = 'https://raw.githubusercontent.com/flanhenrique/Volt-consumo/main/icon.svg'
const SOMMA_LOGO = 'https://raw.githubusercontent.com/flanhenrique/somma/main/assets/logo-somma-hq.webp'
const SOMMA_HERO = 'https://raw.githubusercontent.com/flanhenrique/somma/main/assets/hotel-hero-reference.jpg'
const CONTACT_EMAIL = 'contato@hrxsolutions.com.br'
const COMMERCIAL_EMAIL = 'comercial@hrxsolutions.com.br'

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
    tag: 'Gestão operacional',
    description: 'Plataforma de gestão comercial e operacional construída para centralizar informações, contratos, atividades e decisões.',
    linkLabel: 'Projeto interno',
  },
  {
    id: 'somma',
    name: 'SOMMA',
    tag: 'Consultoria & gestão',
    description: 'Plataforma e presença institucional para gestão, controladoria e relacionamento da SOMMA com seus clientes.',
    href: 'https://sommaconsulthtl.com.br',
    linkLabel: 'Conhecer SOMMA',
  },
]

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

      <div className="showcase-card showcase-nexus authentic-nexus">
        <span className="nexus-wordmark">NEXUS</span>
        <strong>Gestão comercial e operacional.</strong>
        <p>Informação centralizada para apoiar execução e decisão.</p>
        <div className="nexus-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      </div>

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
    <div className="project-visual real-preview volt-real-preview" aria-label="Prévia visual do VOLT">
      <div className="volt-browser">
        <div className="volt-browser-top"><i /><i /><i /><span>voltconsumo.com.br</span></div>
        <div className="volt-auth">
          <div className="volt-auth-branding">
            <div className="volt-lockup"><img src={VOLT_ICON} alt="" /><b>VOLT<small>CONSUMO</small></b></div>
            <span>CONTROLE COM CLAREZA</span>
            <strong>Seu consumo mais claro.</strong>
            <p>Registre o medidor, acompanhe energia e água e antecipe seus gastos em um só lugar.</p>
          </div>
          <div className="volt-auth-form">
            <span>ACESSE SUA CONTA</span>
            <b>Entrar no Volt</b>
            <i className="volt-input" />
            <i className="volt-input" />
            <i className="volt-button">Entrar</i>
          </div>
        </div>
      </div>
    </div>
  )
}

function NexusPreview() {
  return (
    <div className="project-visual real-preview nexus-hold-preview" aria-label="NEXUS - plataforma interna">
      <div className="nexus-hold-card">
        <span className="nexus-wordmark">NEXUS</span>
        <strong>Operação conectada</strong>
        <p>Uma visão central para organizar informações comerciais, contratos, atividades e acompanhamento operacional.</p>
        <div className="nexus-hold-lines" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </div>
  )
}

function SommaPreview() {
  return (
    <div className="project-visual real-preview somma-real-preview" aria-label="Prévia visual da SOMMA">
      <div className="somma-site-shot" style={{ backgroundImage: `linear-gradient(90deg, rgba(17,17,20,.9), rgba(17,17,20,.34)), url(${SOMMA_HERO})` }}>
        <img src={SOMMA_LOGO} alt="SOMMA Consultoria Hoteleira & Condomínios" />
        <span>APRESENTAÇÃO INSTITUCIONAL</span>
        <strong>Gestão financeira, controladoria e processos <em>com resultado comprovado.</em></strong>
        <p>Diagnóstico, implantação e acompanhamento contínuo.</p>
      </div>
    </div>
  )
}

function ProjectVisual({ id }: { id: Project['id'] }) {
  if (id === 'volt') return <VoltPreview />
  if (id === 'somma') return <SommaPreview />
  return <NexusPreview />
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const adminRoute = window.location.pathname.includes('/admin/orcamentos') || window.location.hash === '#admin/orcamentos'

  if (adminRoute) {
    return <AdminQuotes />
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <button className="menu-button" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span /><span /><span /></button>
          <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'}>
            <a href="#inicio" onClick={closeMenu}>Início</a>
            <a href="#solucoes" onClick={closeMenu}>Soluções</a>
            <a href="#projetos" onClick={closeMenu}>Projetos</a>
            <a href="#sobre" onClick={closeMenu}>Sobre</a>
            <a href="#contato" onClick={closeMenu}>Contato</a>
          </nav>
        </div>
      </header>

      <main>
        <section id="inicio" className="hero section-grid">
          <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" /><div className="x-lines" aria-hidden="true"><i /><i /><i /></div>
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">HRX SOLUTIONS · MANAUS / AM</p>
              <h1>Soluções <em>inteligentes.</em><br />Resultados <em>reais.</em></h1>
              <p className="hero-text">Combinamos organização, tecnologia e estratégia para transformar operações e impulsionar resultados concretos.</p>
              <div className="hero-actions">
                <a className="button button-primary" href="#solucoes">Conheça nossas soluções <span>→</span></a>
                <a className="button button-secondary" href="#contato">Solicite uma proposta <span>→</span></a>
              </div>
              <div className="hero-pill-row" aria-label="Territórios de atuação">
                <span>Gestão</span><span>Tecnologia</span><span>Documentação</span><span>Operações</span>
              </div>
            </div>
            <HeroShowcase />
          </div>
        </section>

        <section id="solucoes" className="section solutions-section">
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

        <section id="projetos" className="section projects-section">
          <div className="container">
            <div className="section-heading-row">
              <div><p className="eyebrow">NOSSOS PROJETOS</p><h2>Produtos e projetos que nascem de problemas reais.</h2></div>
              <p>VOLT, NEXUS e SOMMA mostram como a HRX combina operação, tecnologia e execução em contextos diferentes.</p>
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

        <section id="sobre" className="section about-section">
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

        <section id="contato" className="section contact-section">
          <div className="container contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">SOLICITE UMA PROPOSTA</p>
              <h2>Conte o que você precisa. A análise vem antes do preço.</h2>
              <p>Você descreve o contexto e a necessidade. A HRX interpreta o pedido, estrutura um escopo e valida internamente antes de retornar qualquer orçamento.</p>
              <div className="contact-channels" aria-label="Canais de e-mail da HRX">
                <a href={`mailto:${CONTACT_EMAIL}`}><span>Contato geral</span><strong>{CONTACT_EMAIL}</strong></a>
                <a href={`mailto:${COMMERCIAL_EMAIL}`}><span>Comercial e propostas</span><strong>{COMMERCIAL_EMAIL}</strong></a>
              </div>
              <div className="location-pill">Manaus, Amazonas · Brasil</div>
            </div>
            <QuoteRequestForm />
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-inner"><Brand /><p>© 2026 HRX Solutions. Todos os direitos reservados.</p><a href="#inicio">Voltar ao topo ↑</a></div></footer>
    </div>
  )
}
