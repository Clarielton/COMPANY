import React, { useState } from 'react';

const TUTORIAL_CARDS = [
  {
    id: 1,
    badge: 'PASSO 01',
    title: 'Controles & Movimentação',
    icon: '🎯',
    points: [
      'Clique esquerdo (ou arraste caixa) seleciona tropas e prédios da base.',
      'Clique direito no terreno move ou ataca; arraste com o botão direito para orientar a formação.',
      'Abra o Mapa Tático [TAB], selecione esquadrões na lista ESQUADRÕES, escolha ⚔️ ASSALTO, 🛡️ DEFENDER ou 🏃 EM MARCHA e clique no destino (desmarca automaticamente para agilizar).',
      'Use Caminhões de Transporte para embarcar infantaria e [U] para desembarcar rápido.',
    ],
  },
  {
    id: 2,
    badge: 'PASSO 02',
    title: 'Economia & Setores (SUP, MUN, COMB)',
    icon: '⛽',
    points: [
      'Mande infantaria para bandeiras cercadas por sacos de areia para capturar Setores de Suprimento, Munição e Combustível.',
      'Evolua o QG (Níveis 1 → 2 → 3) para liberar Quartel de Blindados, Artilharia e Pesquisas [T].',
      'Use Engenheiros para construir Postos de Suprimento, Geradores e Refinarias nos setores dominados.',
    ],
  },
  {
    id: 3,
    badge: 'PASSO 03',
    title: 'Combate, Cobertura & Florestas',
    icon: '🪖',
    points: [
      'Posicione infantaria em Trincheiras Escavadas (+65% Defesa) ou atrás de muros/sacos de areia.',
      'Esquadrões dentro de Florestas ativam camuflagem furtiva e ganham +35% Dano de Emboscada no primeiro ataque.',
      'Use Granadas [G] para limpar coberturas, Fogo de Supressão [F] para imobilizar inimigos e Kit Médico [C] para curar.',
    ],
  },
  {
    id: 4,
    badge: 'PASSO 04',
    title: 'Blindados & Reparo de Engenheiros',
    icon: '🔧',
    points: [
      'Classes: Humvee (reconhecimento), APC Stryker (infantaria mecanizada), Tanque MBT (canhão 120mm HE/AP) e Artilharia de Foguetes.',
      'Regra de Pane (<= 30% HP): veículos muito danificados sofrem pane mecânica, param de andar, soltam fumaça preta e atiram pela metade.',
      'Aproxime Engenheiros (<= 6m) ou clique no botão [🔧 Consertar Veículo Mais Próximo] para soldar grátis (+40 HP/s) e reativar o motor acima de 50% HP.',
    ],
  },
  {
    id: 5,
    badge: 'PASSO 05',
    title: 'Captura de Comandantes & Interrogatório',
    icon: '★',
    points: [
      'Construa o Campo de Prisioneiros (POW) com seus Engenheiros perto da base.',
      'Apenas o Esquadrão de Comandante Inimigo (★) entra no estado RENDIDO ao perder o combate.',
      'Clique no Comandante rendido (ou pressione [G] perto dele) para capturar e usar a Sala de Interrogatório, revelando o mapa inimigo.',
    ],
  },
];

const ASSAULT_CARDS = [
  {
    id: 1,
    badge: 'DOUTRINA 01',
    title: 'Fogo e Movimento (Supressão + Flanqueamento)',
    icon: '🔫',
    points: [
      'Passo 1 (Prender o Inimigo): Use um esquadrão de Fuzileiros em cobertura e ative 🔥 Supressão [F] (10 MUN) para travar o inimigo no lugar com o status ⚠️ PINNED (-70% velocidade e -60% precisão).',
      'Passo 2 (Manobra de Flanco): Enquanto o inimigo está suprimido olhando para frente, selecione seu esquadrão de Assalto (SMG/Granada), contorne pelos muros laterais ou florestas e ataque pelo flanco/costas (ignorando o bônus de cobertura frontal).',
    ],
  },
  {
    id: 2,
    badge: 'DOUTRINA 02',
    title: 'Assalto Urbano e Limpeza de Construções (Breaching)',
    icon: '🏠',
    points: [
      'Nunca ataque uma casa guarnecida correndo em campo aberto: Prédios ocupados dão +70% de defesa aos defensores.',
      'Protocolo de Invasão: Aproxime a tropa de Assalto usando muros quebrados ou florestas até 16m do prédio.',
      'Clique na construção inimiga e selecione [ 💣 ASSALTAR / LANÇAR GRANADAS NO PRÉDIO ] (ou aperte [G]) para jogar granadas pelas janelas, causando dano crítico ignorando a proteção das paredes.',
      'Para demolir bunkers ou casas inteiras à distância, utilize o canhão explosivo (HE) do Tanque MBT ou cargas de demolição dos Engenheiros.',
    ],
  },
  {
    id: 3,
    badge: 'DOUTRINA 03',
    title: 'Emboscada em Florestas e Ruptura de Trincheiras',
    icon: '🌲',
    points: [
      'Uso de Florestas (Stealth): Esconda tropas de Assalto ou Antitanque (Bazuca) dentro de matas fechadas para ganhar o status 🌲 CAMUFLADO. O inimigo não verá sua tropa até chegar a 8m, e o seu primeiro disparo terá +35% de Dano Crítico de Emboscada.',
      'Limpeza de Trincheiras Escavadas: Soldados dentro de trincheiras têm +65% de defesa contra tiros de longe, mas são vulneráveis a Granadas de Mão [G] e Fogo a Queima-Roupa de Submetralhadoras (SMG) quando um esquadrão de Assalto invade a vala.',
    ],
  },
  {
    id: 4,
    badge: 'DOUTRINA 04',
    title: 'Assalto Mecanizado (Combo Blindado + Infantaria)',
    icon: '🚜',
    points: [
      'Avanço Blindado (Blitz): Embarque 2 esquadrões de Assalto dentro de um APC BTR/Stryker ou Caminhão de Transporte para atravessar zonas de tiro sem perder soldados.',
      'Desembarque de Choque ([U]): Desembarque a infantaria atrás do blindado a poucos metros da bandeira inimiga; mantenha os Engenheiros logo atrás da linha de frente para consertar qualquer veículo caso ele caia para <= 30% HP (Avariado).',
    ],
  },
  {
    id: 5,
    badge: 'DOUTRINA 05',
    title: 'Captura de Comandante no Pós-Assalto',
    icon: '★',
    points: [
      'Ao cercar e zerar a vida de um Esquadrão de Comandante Inimigo (★), o fogo cessa automaticamente e ele entra em estado RENDIDO.',
      'Certifique-se de ter o Campo de Prisioneiros (POW Camp) construído na base e clique no Comandante rendido para transferi-lo às celas e liberar os bônus da Sala de Interrogatório (revelar mapa inimigo, confiscar comboios de recursos ou avançar pesquisa).',
    ],
  },
];

export default function TutorialModal({
  embedded = false,
  onClose,
  onStartGuided,
  onStartAssaultDrill,
}) {
  const [section, setSection] = useState('assault'); // 'general' | 'assault'
  const [activeCard, setActiveCard] = useState(0);
  const cards = section === 'assault' ? ASSAULT_CARDS : TUTORIAL_CARDS;
  const card = cards[activeCard] || cards[0];

  const switchSection = (next) => {
    setSection(next);
    setActiveCard(0);
  };

  const content = (
    <div className={embedded ? 'tutorial-embedded-wrap' : 'tutorial-modal-card'}>
      <div className="tutorial-header">
        <div>
          <div className="tutorial-kicker">MANUAL DE CAMPO • COMPANY OF FRONTLINE</div>
          <h2 className="tutorial-title">📖 TUTORIAL & GUIA TÁTICO</h2>
        </div>
        {!embedded && (
          <button type="button" className="hud-btn" onClick={onClose}>
            ✕ FECHAR
          </button>
        )}
      </div>

      {/* Abas Principais do Tutorial */}
      <div className="tutorial-main-tabs">
        <button
          type="button"
          className={`tutorial-main-tab ${section === 'general' ? 'active' : ''}`}
          onClick={() => switchSection('general')}
        >
          📖 GUIA GERAL
        </button>
        <button
          type="button"
          className={`tutorial-main-tab assault-tab ${section === 'assault' ? 'active' : ''}`}
          onClick={() => switchSection('assault')}
        >
          ⚔️ MANUAL DE ASSALTO
        </button>
      </div>

      <div className="tutorial-step-tabs">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            className={`tutorial-step-pill ${activeCard === idx ? 'active' : ''}`}
            onClick={() => setActiveCard(idx)}
          >
            <span>{c.icon}</span>
            <span>{c.id}. {c.title.split('(')[0].trim()}</span>
          </button>
        ))}
      </div>

      <div className="tutorial-cards-grid">
        {cards.map((c, idx) => (
          <div
            key={c.id}
            className={`tutorial-card ${section === 'assault' ? 'tutorial-assault-card' : ''} ${activeCard === idx ? 'active' : ''
              }`}
            onClick={() => setActiveCard(idx)}
          >
            <div className="tutorial-card-head">
              <span className="tutorial-card-badge">{c.badge}</span>
              <span className="tutorial-card-icon">{c.icon}</span>
            </div>
            <h3>{c.title}</h3>
            <ul>
              {c.points.map((pt, pIdx) => (
                <li key={pIdx}>{pt}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="tutorial-mobile-focus">
        <div className={`tutorial-card active ${section === 'assault' ? 'tutorial-assault-card' : ''}`}>
          <div className="tutorial-card-head">
            <span className="tutorial-card-badge">{card.badge}</span>
            <span className="tutorial-card-icon">{card.icon}</span>
          </div>
          <h3>{card.title}</h3>
          <ul>
            {card.points.map((pt, pIdx) => (
              <li key={pIdx}>{pt}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="tutorial-footer">
        {section === 'assault' ? (
          <button
            type="button"
            className="mil-btn-primary tutorial-guided-btn"
            onClick={() => onStartAssaultDrill?.()}
          >
            🎯 TREINAR MANOBRA DE ASSALTO NO SANDBOX
          </button>
        ) : (
          <button
            type="button"
            className="mil-btn-primary tutorial-guided-btn"
            onClick={() => onStartGuided?.()}
          >
            ▶️ INICIAR TREINAMENTO GUIADO PASSO A PASSO
          </button>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="sys-modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(980px, 95vw)' }}>
        {content}
      </div>
    </div>
  );
}
