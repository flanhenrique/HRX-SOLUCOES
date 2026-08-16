import { useState } from 'react'

type Solution = { icon: string; title: string; description: string }
type Project = { id: 'volt' | 'nexus' | 'somma'; name: string; description: string; tag: string }

const solutions: Solution[] = [
  { icon: '◎', title: 'Gestão', description: 'Organizamos operações, estruturas e rotinas para gerar mais eficiência, controle e clareza.' },
  { icon: '▣', title: 'Tecnologia', description: 'Desenvolvemos soluções digitais sob medida para automatizar processos e ampliar capacidade.' },
  { icon: '▤', title: 'Documentação', description: 'Estruturamos informações, processos e políticas para trazer segurança, rastreabilidade e agilidade.' },
  { icon: '⚙', title: 'Operações', description: 'Melhoramos fluxos e rotinas para transformar execução em performance sustentável.' },
]

const projects: Project[] = [
  { id: 'volt', name: 'VOLT', tag: 'Consumo inteligente', description: 'Aplicação para acompanhamento de consumo de energia e água, leituras, ciclos, histórico e previsões.' },
  { id: 'nexus', name: 'NEXUS', tag: 'Gestão operacional', description: 'Plataforma de gestão comercial e operacional para centralizar contratos, atividades, indicadores e decisões.' },
  { id: 'somma', name: 'SOMMA', tag: 'Hospitalidade & condomínios', description: 'Ecossistema de consultoria, gestão e relacionamento com foco em eficiência, experiência e resultado.' },
]

function Brand() {
  return (
    <a className="brand" href="#inicio" aria-label="HRX Solutions - início">
      <span className="brand-mark" aria-hidden="true"><span className="brand-hr">HR</span><span className="brand-x">X</span></span>
      <span className="brand-word">SOLUTIONS</span>
    </a>
  )
}

function ProjectVisual({ id }: { id: Project['id'] }) {
  if (id === 'volt') {
    return <div className="project-visual volt-visual" aria-hidden="true"><div className="phone-shell"><div className="phone-topline"><span>⚡ VOLT</span><span>•••</span></div><p>Consumo atual</p><strong>285 kWh</strong><div className="mini-bars">{[44,58,36,72,54,83,64,92].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div><div className="mini-row"><span>Ciclo</span><b>Em andamento</b></div><div className="mini-row"><span>Meta</span><b>Dentro do previsto</b></div></div></div>
  }

  if (id === 'nexus') {
    return <div className="project-visual nexus-visual" aria-hidden="true"><div className="laptop-screen"><div className="screen-bar"><span>NEXUS</span><span>● ● ●</span></div><div className="screen-grid"><aside><i className="active"/><i/><i/><i/><i/></aside><main><div className="metric-strip"><i/><i/><i/></div><div className="work-list"><i/><i/><i/><i/></div></main></div></div><div className="laptop-base"/></div>
  }

  return <div className="project-visual somma-visual" aria-hidden="true"><div className="somma-window"><img src="https://raw.githubusercontent.com/flanhenrique/somma/main/assets/logo-somma-premium.svg" alt="" className="somma-logo"/><div className="somma-copy"><strong>Hospitalidade com estratégia.</strong><span>Gestão, experiência e resultado.</span></div></div></div>
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <button className="menu-button" type="button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span/><span/><span/></button>
          <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'}>
            <a href="#inicio" onClick={closeMenu}>Início</a><a href="#solucoes" onClick={closeMenu}>Soluções</a><a href="#projetos" onClick={closeMenu}>Projetos</a><a href="#sobre" onClick={closeMenu}>Sobre</a><a href="#contato" onClick={closeMenu}>Contato</a>
          </nav>
        </div>
      </header>

      <main>
        <section id="inicio" className="hero section-grid">
          <div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/><div className="x-lines" aria-hidden="true"><i/><i/><i/></div>
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">HRX SOLUTIONS · MANAUS / AM</p>
              <h1>Soluções <em>inteligentes.</em><br/>Resultados <em>reais.</em></h1>
              <p className="hero-text">Combinamos organização, tecnologia e estratégia para transformar operações e impulsionar resultados concretos.</p>
              <div className="hero-actions"><a className="button button-primary" href="#solucoes">Conheça nossas soluções <span>→</span></a><a className="button button-secondary" href="#projetos">Conheça nossos projetos <span>→</span></a></div>
            </div>
            <div className="hero-showcase" aria-label="Projetos HRX">
              <div className="showcase-card showcase-volt"><span className="showcase-kicker">VOLT</span><strong>Consumo sob controle.</strong><div className="showcase-bars">{[34,46,63,53,78,68,88].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div></div>
              <div className="showcase-card showcase-nexus"><span className="showcase-kicker">NEXUS</span><strong>Operação em uma visão.</strong><div className="showcase-metrics"><i/><i/><i/></div><div className="showcase-list"><i/><i/><i/></div></div>
              <div className="showcase-card showcase-somma"><span className="showcase-kicker">SOMMA</span><strong>Estratégia para hospitalidade.</strong><span className="showcase-line"/></div>
            </div>
          </div>
        </section>

        <section id="solucoes" className="section solutions-section">
          <div className="container section-layout">
            <div className="section-intro"><p className="eyebrow">NOSSAS SOLUÇÕES</p><h2>Soluções completas para o seu negócio.</h2><p>Da organização da operação à construção de soluções digitais, estruturamos o que precisa funcionar melhor.</p></div>
            <div className="solution-grid">{solutions.map((solution)=><article className="solution-card" key={solution.title}><span className="solution-icon" aria-hidden="true">{solution.icon}</span><h3>{solution.title}</h3><p>{solution.description}</p><a href="#contato">Saiba mais <span>→</span></a></article>)}</div>
          </div>
        </section>

        <section id="projetos" className="section projects-section">
          <div className="container">
            <div className="section-heading-row"><div><p className="eyebrow">NOSSOS PROJETOS</p><h2>Produtos e projetos que nascem de problemas reais.</h2></div><p>VOLT, NEXUS e SOMMA materializam a forma como a HRX combina operação, tecnologia e execução.</p></div>
            <div className="projects-grid">{projects.map((project)=><article className={`project-card ${project.id}`} key={project.id}><div className="project-copy"><span className="project-tag">{project.tag}</span><h3>{project.name}</h3><p>{project.description}</p><span className="project-status">Projeto HRX <b>↗</b></span></div><ProjectVisual id={project.id}/></article>)}</div>
          </div>
        </section>

        <section id="sobre" className="section about-section">
          <div className="container about-grid">
            <div className="manaus-panel" aria-hidden="true"><div className="map-outline"><span className="map-pin">●</span></div><strong>Manaus / AM</strong></div>
            <div className="about-copy"><p className="eyebrow">SOBRE A HRX</p><h2>Organização. Tecnologia. Estratégia. Soluções que transformam.</h2><p>A HRX Solutions nasce em Manaus, Amazonas, para estruturar operações, transformar necessidades em sistemas e construir soluções com utilidade prática.</p><p>Não somos uma vitrine de serviços desconectados. Cada entrega parte de um problema concreto, de uma operação que precisa funcionar melhor e de um resultado que precisa ser mensurável.</p></div>
          </div>
        </section>

        <section id="contato" className="section contact-section">
          <div className="container contact-grid">
            <div className="contact-copy"><p className="eyebrow">CONTATO</p><h2>Vamos conversar sobre o que a sua empresa precisa?</h2><p>O canal comercial definitivo será conectado nesta etapa do projeto. A estrutura do formulário já está preparada.</p><div className="location-pill">Manaus, Amazonas · Brasil</div></div>
            <form className="contact-form" onSubmit={(event)=>event.preventDefault()}>
              <div className="form-row"><label>Nome completo<input type="text" name="name" autoComplete="name"/></label><label>E-mail<input type="email" name="email" autoComplete="email"/></label></div>
              <div className="form-row"><label>Empresa<input type="text" name="company" autoComplete="organization"/></label><label>Telefone<input type="tel" name="phone" autoComplete="tel"/></label></div>
              <label>Como podemos ajudar?<textarea name="message" rows={5}/></label>
              <button type="submit" className="button button-primary form-button" disabled>Enviar mensagem <span>→</span></button><small>Formulário visual — envio será ativado quando definirmos o canal comercial.</small>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-inner"><Brand/><p>© 2026 HRX Solutions. Todos os direitos reservados.</p><a href="#inicio">Voltar ao topo ↑</a></div></footer>
    </div>
  )
}
