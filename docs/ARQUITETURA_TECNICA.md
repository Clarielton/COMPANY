# Arquitetura Técnica — Company of Frontline (RTS Tático 3D)

## 1. Stack Tecnológica
- **Frontend / UI Militar (*Company of Heroes* & *Men of War* Style):** React 18 (`src/components/*`) + CSS (`src/styles/game.css`), com painéis em verde-oliva escuro fosco (`#1a1d17`), bordas metálicas em bronze/caqui (`#8a795d`), **Barra Inferior Categorizada em 4 Abas Táticas (`🪖 Infantaria [F1]`, `🚜 Veículos & Blindados [F2]`, `🛠️ Engenharia & Obstáculos [F3]`, `🏰 Defesas & Estruturas [F4]` + `📋 Todos [F5]`)**, painel `COMANDO DE ESQUADRÃO` com **Controle de Distanciamento Tático (`1.0m` a `8.0m` + Presets Rápidos `1.5m`, `3m`, `5m`, `7.5m`)**, **Lista de Cards de Vida Individual por Soldado (`Sgt. Silva`, `Cb. Costa`, `Sd. Rocha` com `100/100 HP`, barra Verde/Amarela/Vermelha e arma)**, **Ferramentas de Destacar Soldado (`[✂ Separar Soldado - Tecla K]`) e Transferir/Mesclar Soldados (`[Transferir ➡️]`)**, além do **Quadro de Planejamento Tático Interativo (`[TAB]` / `Minimap.jsx`)** e **Menu de Produção do Prédio Selecionado**.
- **Motor / Renderização 3D Diurna & Modelos Detalhados:** Three.js (`WebGLRenderer`, iluminação diurna realista com `HemisphereLight` + `DirectionalLight` solar e sombras suaves `PCFSoftShadowMap`, terreno rural expandido `9600 x 9600` via `CanvasTexture`, **Camada 3D de Névoa de Guerra Real** com 3 estados `0` Inexplorado / `1` Shroud / `2` Visão Ativa, **Soldados 3D Detalhados**, **Pinheiros Altos (`7.0m–10.5m` em bosques densos `_addPineGroves`)** com 5 camadas de cones de 8 lados, **Casas Enxaimel Detalhadas** com venezianas e muretas de pedra, e **Bases Militares 3D Remodeladas** — QG em "U" com heliponto e bandeira animada, Quonset Hut em Op. Especiais, Radar giratório com luzes de aviação, Hangar com ponte rolante amarela e Campo POW cercado nos 4 lados com espaçamento mínimo anti-colisão de `14m` e fora das estradas via `isOnRoad`).
- **Lógica de Sub-Unidades Individuais, Espaçamento, Cover Snapping & Steering Pathfinding:** Em `SquadUnit.js` e `BattlefieldMap.js`, cada esquadrão de infantaria mantém `this.soldiers` (sub-entidades reais com `id`, `rank`, `name`, `weapon`, `hp`, `maxHp`, `worldX`, `worldY`, `selected`), `setSpacing(meters)` para recalcular os offsets de formação de `1.0m` a `8.0m`, `findNearestCoverSnap()` + `setCoverSnapOrder(snap)` para alinhar cada soldado paralelamente do lado seguro de muros/trincheiras em postura agachada (`crouchedInCover`), e `checkProjectileCoverBlock()` para bloqueio físico via Raycast de projéteis frontais contra muros/sacos de areia/trincheiras (gerando faíscas/poeira no muro com `spawnWallImpactParticles` e 0 de dano).
- **Controles Híbridos PC + Touch Screen (`Input.js` & `Game.js`):** Suporte simultâneo a Mouse/Teclado e eventos `touchstart`, `touchmove`, `touchend` com `{ passive: false }` e `touch-action: none`, incluindo Toque Simples (`1 dedo`) para seleção/ordens/cover-snap, alternância rápida `[▭ MODO SELEÇÃO]` vs `[✋ MODO CÂMERA]`, Arrastar com `2 dedos` para câmera, Pinça (`Pinch-to-Zoom`), Toque Longo (`0.4s`) + Arrastar para orientação de formação e desenho de trincheiras/muros por toque.
- **Serialização de Batalha (Save / Load System):** Em `Game.js`, os métodos `serializeBattleState()`, `loadBattleState(state)`, `saveBattle(title)`, `loadSavedBattle(id)` e `deleteSavedBattle(id)` persistem e restauram o estado  completo da partida via `localStorage` (`cof_rts_saved_battles_v1`) e arquivos `.json`, preservando unidades, soldados individuais (`this.soldiers`), formações, espaçamento, construções da base, fortificações e a grade de Névoa de Guerra (`exploredGrid`).
- **Áudio Procedural:** Síntese sonora em tempo real via Web Audio API (`SoundManager.js` / `AudioSystem.js`) com buffers de ruído branco, rosa e marrom, tema orquestral militar no menu, som ambiente de campo de batalha, loop contínuo de motor diesel + esteiras modulado por velocidade/distância, zunido de drones, tiros com eco e estrondo de canhão 120mm.
- **Sandbox (`[F10]`), Mira de Combate, Path Line & `allColliders`:** `Game.enableSandboxMode()` / `toggleSandboxMode()` desbloqueia 99.999 recursos, QG Nv. 3, todas as pesquisas e barra de testes em `HUD.jsx`. `SquadUnit.stepAutonomousSoldiers()` alinha cada soldado ao `activeCombatTarget` via `Math.atan2(dx, dz)`. `BattlefieldMap.buildPathAroundObstacles()` (máx. 6 passos) alimenta a linha 3D em tempo real e `syncAllColliders()` unifica prédios da base, estruturas, carcaças e troncos na resolução de colisões. Em `SquadUnit.js` e `Game.js`, apenas unidades com `isCommanderSquad` (`command_officer`) se rendem; `capturePrisoner()` transfere o comandante diretamente para `powPrisoners` em bloco `try / catch` seguro sem pathfinding de escolta. `disembarkAllFromTransport()` restaura `worldX`/`worldY` de todos os soldados vivos ao lado do veículo. `Minimap.jsx` usa `requestAnimationFrame` a 60 FPS com fundo `#111612`, grade topográfica, seleção por caixa/clique, botão `SELECIONAR TODAS` e ordens diretas com clique direito. Em `Renderer3D.js`, `_createSquadMesh` garante que todo subtipo de veículo (`humvee`, `troop_transport`, `apc_stryker`, `mbt_tank`, `rocket_artillery`) gere malha 3D de veículo blindado e corrige `barrel` em `rocket_artillery`. `HUD.jsx` e `game.css` exibem painel exclusivo para veículos (blindagem, armamento, passageiros, RTB `[B]`), fila de produção visual de 5 slots com cancelamento e reembolso 100% (`cancelBuildingQueueItem` em `Game.js`), scrollbars finas escuras e barra inferior em 5 colunas (ou 2 fileiras em `TODOS [F5]`) sem rolagem horizontal. Cada unidade é atualizada em `try / catch` individual em `_updateUnitsAndCombat()`, `sanitizePosition()` restaura `lastValidPos` contra `NaN`, ordens de movimento resetam `holdPosition`/`inTrench`/`suppressedTimer`/`reactionTimer`, `setGameSpeed()` garante despausa ao escolher `1.0x`, e marcadores de ordem anteriores são limpos imediatamente a cada novo clique direito. `Renderer3D.carveTrenchInTerrain()` deforma os vértices de `terrainGeo` (`-1.2m` na vala e `+0.35m` na borda) com fundo escuro `#110d09`, oclusão ambiental nas paredes, duckboards, formato zig-zag e proibição de construção sobre estradas (`isOnRoad`). `_buildRoadMeshes()` e `terrainTexture.js` geram estradas sinuosas com largura variável (`6.5m–8.5m`), `alphaMap` nas margens, poças de lama e marcas de esteiras sem faixas retas artificiais. Em `Renderer3D.js`, `fogMesh` usa grade `128x128` com `depthTest: false` e `renderOrder: 999` (cor adaptativa por bioma: oliva na Normandia, âmbar/areia no Deserto e azul-frio no Inverno). Em `BattlefieldMap.js` e `Renderer3D.js`, todos os 3 mapas geram 25–38 complexos cercados (`adobe_house`, `warehouse`, `brick_ruin`, `two_story`, `barn`, `bunker`) e linha férrea com pátio ferroviário (`_buildRailways`). Em `SquadUnit.js` (`stepAutonomousSoldiers`) e `Renderer3D.js`, cada soldado opera de forma autônoma no espaço global (`turnSpeed` `4.5–7.0 rad/s`, `reactionDelay` `0.05–0.35s`, `speedMultiplier` `0.92–1.08`, `animPhaseOffset`, `strideFrequency` e micro-movimentos em repouso). `buildCapturePointCompound()` transforma os setores em complexos fortificados com ninho de sacos de areia em 3 camadas, rede de camuflagem e bandeira ondulante de 5m; `_createTrenchMesh()` constrói valas escavadas com duckboards e escada; `_createFortifiedWallMesh()` cria checkpoints militares com barreiras Jersey e cancela; e `_buildRoadMeshes()` mantém as estradas `+0.12m` (`+1.2u`) acima do terreno. `BattlefieldMap.forestZones` e `getForestZoneAt()` criam zonas densas de bosque/oásis (`15–30` árvores) com camuflagem automática (`inForestStealth` `+50%` defesa, `camouflagedInForest` invisível a `> 8m`, `+35%` dano crítico no 1º disparo de emboscada revelando por `5s`, e `-30%` velocidade para veículos pesados). Os 3 mapas (`normandy`, `el_alamein`, `bastogne_winter`) recebem muros quebrados em `"L"`/`"U"`, ruínas abertas, comboios destruídos e marcos exclusivos (`adobe_house`, `oil_refinery`, `column_ruins`, `sawmill`, `bunker`). `Input.js` registra `pointerup`/`mouseup` globais, `FloatingText` expira em `<= 1.1s` mesmo em pausa, `computeObstacleDetourPath` limita a `3` iterações com auto-destravamento de waypoints (`2.5s`), guardas `NaN` e estado `PINNED` limitado a `5s` (`>= 40%` velocidade). `BattlefieldMap.clearFoliageAndFlattenUnderBuilding()` e `terrainHeight.js` nivelam e limpam vegetação sob fundações 3D (`3.5u`), `isLineBlockedByStructures()` impede tiros através de casas, soldados possuem diferenciação visual por classe/facção + animação de queda ao morrer, e tanques disparam projéteis HE/AP (`4.0s`) com dano em área (`4.5m`) + metralhadora coaxial secundária. `BattlefieldMap.computeObstacleFreePath()` / `computeObstacleDetourPath()` gera waypoints contornando construções (usando `Math.max(w, d)`), muros, barricadas, carcaças e árvores desenhados em 3D acompanhando o relevo (`getTerrainHeight + 3.2`). `Game.js` exige a construção de `pow_camp` (`Campo de Detenção & Inteligência`, em `BASE_BUILDINGS`) para escoltar (`order.type === 'escort_pow'`) e interrogar rendidos com 4 protocolos (`maps`, `convoy`, `sabotage`, `labor` com renda passiva de `+5 SUP/s`). `SquadUnit` mantém todos os soldados sempre em pé (`rotation.x = 0`, rebaixando apenas dentro de trincheiras) e suporta embarque/desembarque (`embarkedInId`, `cargoSquadIds`, `disembarkAllFromTransport`, `rampOpenTimer`). `src/game/data/techTreeData.js` define os 3 ramos de pesquisa e o cálculo de custo/velocidade por porcentagem (`25%`, `50%`, `75%`), além de drones quadricópteros 3D (`activeDrones`). `Game._triggerGameOver()` encerra a partida e alimenta o overlay cinematográfico em `GameMenus.jsx`.
- **Layout da HUD (Responsivo / Redimensionável / Fixável):** `src/game/ui/hudLayout.js` contém a lógica pura testável (escala `0.5`–`1.8`, escala automática por viewport `computeAutoHudScale`, limites de arraste `clampPanelPosition`, persistência em `localStorage` na chave `cof_hud_layout_v1`). `src/components/HudPanel.jsx` exporta o hook `useHudLayout()` e o componente `<HudPanel>` que envolve cada um dos 5 painéis do `HUD.jsx`, aplicando CSS `zoom` (escala automática × manual), arraste e alça de redimensionar via Pointer Events (mouse + touch), recolher e fixar (📌). O CSS usa `--hud-zoom` para compensar larguras baseadas em `vw` e media queries para `1280px`, `1024px`, `760px`, altura `620px` e `hover: none`.
- **Build & Tooling:** Node.js + Vite (`vite.config.js`, `package.json`).

---

## 2. Estrutura de Pastas

```text
Game/
├── docs/
│   ├── ARQUITETURA_TECNICA.md
│   └── MANUAL_DO_JOGO.md
├── scripts/
│   └── smoke-test.mjs            # Testes automatizados em Node.js (Abas F1-F5, Spacing 1m-8m, HP Individual por Soldado, Separar [K] e Transferir)
├── src/
│   ├── components/
│   │   ├── GameMenus.jsx         # Lobby Skirmish CoH (1v1/2v2, slots de comandantes, recursos) e Sala de Interrogatório
│   │   ├── HUD.jsx               # Barra Inferior em 4 Abas + TODOS, Comando de Esquadrão c/ Spacing Slider, Cards de Soldados e Transferir/Separar [K]
│   │   ├── HudPanel.jsx          # useHudLayout() + <HudPanel>: menus móveis, redimensionáveis (−/+ e alça), recolhíveis e fixáveis (📌)
│   │   └── Minimap.jsx           # Quadro de Planejamento Tático Interativo ([TAB]) c/ 8 Setores, Setas de Ataque, Pings e Ordens Diretas
│   ├── game/
│   │   ├── config.js             # Constantes globais
│   │   ├── Game.js               # Loop principal RTS, Abas da Barra Inferior, Espaçamento, Seleção/Destacamento [K]/Transferência de Soldados e Combate
│   │   ├── core/
│   │   │   ├── AudioSystem.js    # Síntese sonora WebAudio
│   │   │   ├── Camera.js         # Utilitário de câmera
│   │   │   ├── Input.js          # WASD, TAB, Espaço, F1-F5, K, H, U, Z/X/C, Shift+Clique Esquerdo e Clique Direito + Arrastar Direcional
│   │   │   └── math.js           # Utilitários matemáticos e PRNG mulberry32
│   │   ├── data/
│   │   │   └── rtsData.js        # Categorias da Barra Inferior (BOTTOM_BAR_CATEGORIES), Presets de Espaçamento (SPACING_PRESETS), Unidades e Estruturas
│   │   ├── entities/
│   │   │   ├── Particle.js       # Textos flutuantes e partículas
│   │   │   └── SquadUnit.js      # Esquadrões com Sub-Unidades de Soldados (this.soldiers), HP Individual, Espaçamento (1m-8m), Trincheiras, Muros e Minas
│   │   ├── render/
│   │   │   ├── Renderer3D.js     # Renderizador 3D Diurno (Terreno 256×256 c/ Relevo, Árvores Compostas 2.25×, Vegetação InstancedMesh, Soldados, Veículos e Bases)
│   │   │   ├── VFXManager.js     # Efeitos 3D de combate (Muzzle Flash c/ PointLight, Tracers, Impactos e Explosões em 4 camadas)
│   │   │   └── terrainTexture.js # Gerador procedural de Albedo (2048×2048) + BumpMap orgânicos multicamadas
│   │   ├── ui/
│   │   │   └── hudLayout.js      # Lógica pura do layout da HUD (escala, escala automática, limites de arraste, persistência)
│   │   └── world/
│   │       ├── BattlefieldMap.js # 2 Mapas (Normandia & El Alamein 9600×9600), 12 Setores, Florestas de Borda, Fog of War (`revealFogArea`), Steering Pathfinding e Cobertura
│   │       └── terrainHeight.js  # Heightmap procedural multi-oitava (`getTerrainHeight(x, z, map)`) p/ colinas, estradas e crateras 3D
│   ├── styles/
│   │   └── game.css              # Tema visual militar Company of Heroes / Men of War
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```

---

## 3. Comandos Principais

```bash
npm install         # Instala React, Three.js, Vite e dependências
npm run dev         # Inicia o servidor de desenvolvimento local (porta 5173)
npm run test:smoke  # Executa validação automatizada dos sistemas em Node.js
npm run build       # Gera build otimizado de produção em dist/
```
