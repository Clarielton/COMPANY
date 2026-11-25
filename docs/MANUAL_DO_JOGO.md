# Manual do Jogo — Company of Frontline (RTS Tático Militar 3D)

**Company of Frontline** é um jogo de **Estratégia Militar em Tempo Real 3D (RTS Tático)** inspirado em *Company of Heroes* e *Men of War*, construído com **React + Three.js + HTML5 Canvas + Node.js (Vite)**. Você atua como o **Comandante do Batalhão**, coordenando esquadrões de infantaria 3D com **vida individual por soldado (`100/100 HP`)**, **controle de espaçamento tático (`1m` a `8m`)**, **transferência e destacamento de soldados (`[K]`)**, barra inferior organizada em **4 Abas Táticas (`[F1]` a `[F4]` + `TODOS [F5]`)**, veículos blindados com rodas e torres articuladas, bases militares 3D interativas e destrutíveis, e um **Quadro de Planejamento Tático Interativo (`[TAB]`)** em um campo de batalha diurno (`9600 x 9600`).

---

## 1. Controles do Comandante RTS

| Ação | Tecla / Controle |
| :--- | :--- |
| **Mover Câmera Estratégica pelo Mapa (`9.6km`)** | `W`, `A`, `S`, `D` ou Setas Direcionais |
| **Zoom da Câmera (Visão Estratégica ↔ Perto das Trincheiras)** | `Scroll do Mouse` |
| **Abrir / Fechar Quadro de Planejamento Tático Interativo** | Tecla `TAB` (ou botão `🗺 MAPA TÁTICO [TAB]`) |
| **Ativar / Desativar Modo Caixa de Areia (Sandbox)** | Tecla `F10` (ou botão `🛠️ SANDBOX` no Menu / HUD — recursos infinitos, QG Nv. 3, spawn de tropas/alvos e controle de névoa/IA) |
| **Pausa Tática / Retomar Partida (permite dar ordens em pausa)** | `Espaço` (ou botões `0.5x`, `1.0x`, `1.5x` no topo da HUD) |
| **Alternar Abas da Barra Inferior** | `F1` Infantaria • `F2` Veículos • `F3` Engenharia • `F4` Defesas • `F5` Todos |
| **Selecionar Esquadrão, Veículo ou Prédio da Base 3D** | `Clique Esquerdo` sobre a unidade ou prédio da base |
| **Selecionar um Soldado Individual no Mapa 3D** | `Shift + Clique Esquerdo` diretamente sobre o boneco 3D (ou clique no card dele no painel direito) |
| **Destacar Soldado(s) em um Novo Esquadrão Independente** | Tecla `K` (ou botão `✂ Separar Soldado [K]` no painel direito) |
| **Transferir / Mesclar Soldados para Outro Esquadrão** | Botão `Transferir ➡️` ou `⇄ Mesclar Esquadrões` no painel `COMANDO DE ESQUADRÃO` |
| **Selecionar Múltiplos Esquadrões** | `Clicar e Arrastar` Caixa de Seleção com Botão Esquerdo |
| **Mover Tropas / Ocupar Trincheira / Atacar Inimigo ou Base** | `Clique Direito` no terreno, na trincheira, no inimigo ou no prédio inimigo |
| **Definir Ponto de Encontro (*Rally Point*) do Prédio da Base** | Com um prédio aliado selecionado, `Clique Direito` no terreno (ou no Mapa Tático) |
| **Orientação Direcional de Formação (Preview no Chão)** | `Segurar e Arrastar Botão Direito` no chão (mostra os pontos amarelos de cada soldado e a seta de direção) |
| **Travar Posição (*Hold Position*)** | Tecla `H` (ou botão `🔒 TRAVAR POSIÇÃO [H]` no painel inferior) |
| **Entrar em Construção Intacta (Guarnição / Garrison)** | `Clique Direito` sobre casa, igreja, sobrado, armazém, celeiro ou moinho |
| **Sair do Prédio (Desocupar Guarnição)** | Tecla `U` (ou botão `🚪 SAIR DO PRÉDIO [U]`) |
| **Camuflagem e Emboscada em Florestas / Oásis** | Entre em bosques densos com infantaria para ganhar **`+50% DEF`**, invisibilidade à distância (`> 8m`) e **`+35%` de dano crítico** no 1º disparo de emboscada |
| **Capturar e Interrogar Comandante Inimigo Rendido (★)** | `Clique Esquerdo/Direito` sobre o Comandante rendido (ou aproxime uma tropa; transfere direto para o **Campo de Detenção & Inteligência**) |
| **Suporte Aéreo (Drone Recon, Rasante A-10, Bombardeio)** | Teclas `Z`, `X`, `C` (requer *Comando Aéreo & Radar*) |
| **Atalhos Rápidos da Categoria Ativa** | Teclas `1` a `5` (acionam os 5 cartões da aba selecionada) |
| **Salvamento Rápido da Batalha (*Quick Save*)** | Tecla `F9` (ou botão `💾 SALVAR BATALHA [F9]` no topo direito da HUD) |
| **Gerenciador de Batalhas Salvas (Salvar / Carregar / Exportar `.JSON`)** | Botão `📂 CARREGAR` na HUD ou aba `💾 SALVAR / CARREGAR BATALHA` no Menu `[ESC]` |
| **Abrir Sala de Guerra / Menu de Pausa** | `ESC` |
| **Silenciar / Ativar Áudio** | `M` |

---

## 2. Barra Inferior Separada por Categorias (Abas Táticas `[F1]` a `[F5]`)

No topo da barra inferior, os comandos estão organizados em **4 Abas Táticas Claras** + modo **TODOS**:
1. **`🪖 INFANTARIA ([F1])`:** Fuzileiros (M1/M4), Assalto (SMG/Granada), Snipers Camuflados, Equipe Antitanque (Javelin/Bazooka) e Engenheiros de Combate.
2. **`🚜 VEÍCULOS & BLINDADOS ([F2])`:** Blindado Humvee (.50), APC Blindado 8x8 (BTR/Stryker), Tanque MBT (120mm) e Artilharia de Foguetes.
3. **`🛠️ ENGENHARIA & OBSTÁCULOS ([F3])`:** Trincheira Escavada (Linha/L), Muro Fortificado, Arame Farpado, Dentes de Dragão e Campo Minado.
4. **`🏰 DEFESAS & ESTRUTURAS ([F4])`:** Torre de Defesa (Guarita Blindada), Bunker de Concreto, Metralhadora Fixa (Ninho MG/AT) e Posto de Suprimento.
5. **`📋 TODOS ([F5])`:** Exibe os 4 grupos lado a lado separados por caixas com títulos de categoria e divisórias metálicas.

---

## 3. Controle de Distanciamento Tático (*Spacing*) no `COMANDO DE ESQUADRÃO`

Dentro do painel direito **`COMANDO DE ESQUADRÃO`**, logo abaixo dos botões `LINHA`, `COLUNA`, `CUNHA (V)` e `DISPERSOS`:
- **Slider Interativo (`1.0m` a `8.0m`):** Ajusta em tempo real a distância física entre os soldados 3D do esquadrão selecionado, mantendo a formação escolhida.
- **Botões Rápidos de Preset:** **Compacto 1.5m**, **Padrão 3m**, **Aberto 5m** e **Anti-Artilharia 7.5m** (reduz drasticamente o dano sofrido por explosões, minas e artilharia).

---

## 4. Vida Individual por Soldado e Gerenciamento Estilo *Men of War*

1. **Sub-Unidades Reais com HP Próprio (`100/100 HP`):**
   - Cada soldado do esquadrão possui `id`, `nome`/`patente` (`Sgt. Silva`, `Cb. Costa`, `Sd. Rocha`), `arma equipada` e barra de vida individual (`100/100 HP`).
   - Quando o esquadrão recebe tiros ou explosões, o dano atinge especificamente os soldados na linha de impacto 3D. Se o HP de um soldado chega a `0`, apenas aquele boneco 3D morre/cai no chão.
   - No painel `COMANDO DE ESQUADRÃO`, cada soldado vivo tem seu card com mini barra de vida (**Verde** `>50%`, **Amarelo** `25%–50%`, **Vermelho** `<25%`) e ícone da arma.
2. **Selecionar, Destacar (`[K]`) e Transferir Soldados (`[Transferir ➡️]`):**
   - **Selecionar Soldado Individual:** Clique no card do soldado na lista do `COMANDO DE ESQUADRÃO` ou faça **`Shift + Clique Esquerdo`** diretamente no boneco 3D no campo de batalha.
   - **Destacar como Novo Esquadrão (`[✂ Separar Soldado - Tecla K]`):** Pressione **`[K]`** ou clique no botão para separar 1 ou mais soldados selecionados (ex: enviar 1 soldado batedor sozinho para explorar a Névoa de Guerra sem arriscar o resto do grupo).
   - **Transferir para Outro Esquadrão (`[Transferir ➡️]` / `[⇄ Mesclar Esquadrões]`):** Transfere soldados selecionados para reforçar outro esquadrão aliado que perdeu membros em combate.

---

## 5. Sistema de Salvar e Carregar Batalha (`[F9]` / `.JSON`)

Você pode salvar o estado completo da operação a qualquer momento e retomar exatamente de onde parou:
- **Salvamento Rápido (`[F9]` ou botão `💾 SALVAR BATALHA [F9]` na HUD):** Grava instantaneamente todos os recursos (`SUP`, `MUN`, `COMB`), Pontos de Vitória, estados dos 8 Setores de Suprimento, Névoa de Guerra explorada, Prédios da Base (com HP e fila de produção), Trincheiras, Muros, Arame Farpado, Campos Minados e todas as Unidades com a **vida individual de cada soldado (`100/100 HP`)**, formação e espaçamento.
- **Gerenciador de Batalhas Salvas (`📂 CARREGAR` na HUD ou no Menu Principal / Pausa `[ESC]`):** Permite criar salvamentos nomeados, carregar qualquer slot salvo (`▶ CARREGAR BATALHA`), excluir registros antigos ou **Exportar (`⬇ .JSON`) / Importar (`⬆ .JSON`)** arquivos de batalha no computador.

---

## 6. Sistema de Encaixe em Muros e Trincheiras ("Cover Snapping" estilo *Company of Heroes*)

1. **Slots de Cobertura Pré-Calculados (*Cover Slots*) e Lado Seguro:**
   - Todo muro de pedra, muro fortificado, sacos de areia, veículo destruído e trincheira gera pontos de encaixe alinhados paralelamente ao longo de sua estrutura (`findNearestCoverSnap`).
   - Ao passar o mouse ou clicar/tocar perto de um muro, o jogo calcula automaticamente a direção da ameaça inimiga mais próxima e posiciona todos os soldados **do lado de trás do muro (lado seguro)**, colados na parede e olhando por cima da borda na direção do inimigo.
2. **Prévia Visual no Chão (Bolinhas Verdes Brilhantes de Cobertura):**
   - Ao passar o mouse ou tocar perto de um muro/trincheira com tropas de infantaria selecionadas, pequenos **círculos verdes brilhantes** aparecem no chão mostrando exatamente onde cada soldado vai ficar alinhado lado a lado.
3. **Postura Agachada (*Crouching*) e Bloqueio Físico Real de Projéteis (*Raycast*):**
   - Ao chegar no muro ou entrar na trincheira, os soldados mudam para a **postura agachada (`crouchedInCover`)**, ficando com o corpo protegido atrás da geometria do muro/trincheira e levantando apenas o fuzil para atirar por cima da borda.
   - Os disparos inimigos checam colisão física real (*Raycast 2D*) contra muros, sacos de areia e bordas da trincheira (`checkProjectileCoverBlock`): **85% a 90% dos tiros frontais inimigos batem fisicamente no muro** (gerando faíscas e poeira na parede e causando **0 de dano** ao soldado), só acertando se o inimigo flanquear pelos lados/costas ou usar explosivos/morteiros por cima.

---

## 7. Controles Híbridos: Mouse (PC) + Touch Screen (Celular e Tablet)

O jogo detecta e responde simultaneamente a **Mouse + Teclado (PC)** e **Toque na Tela (Celular/Tablet)** com `touch-action: none` (sem dar zoom ou rolar a página do navegador acidentalmente):

| Ação Tática | No PC (Mouse + Teclado) | No Celular / Tablet (Touch Screen) |
| :--- | :--- | :--- |
| **Selecionar Esquadrão ou Prédio da Base** | `Clique Esquerdo` na tropa ou prédio | `Toque Simples (1 Dedo)` em cima da tropa ou prédio |
| **Mover, Encaixar no Muro ou Atacar Alvo** | `Clique Direito` no chão, muro, trincheira ou inimigo | `Toque Simples (1 Dedo)` no chão, muro, trincheira ou inimigo (com tropa selecionada) |
| **Caixa de Seleção vs Mover Câmera (1 Dedo)** | `Clique Esquerdo + Arrastar` = Caixa de Seleção; `WASD` / `Botão do Meio` = Câmera | Botão rápido no topo da tela alterna entre **`[▭ MODO SELEÇÃO]`** (arrastar 1 dedo desenha caixa verde) e **`[✋ MODO CÂMERA]`** (arrastar 1 dedo move a câmera) |
| **Mover Câmera a Qualquer Momento** | `WASD`, Setas ou `Botão do Meio + Arrastar` | `Arrastar com 2 Dedos` na tela |
| **Zoom da Câmera** | `Scroll do Mouse` | `Pinça com 2 Dedos` (*Pinch-to-Zoom*: abrir e fechar dois dedos) |
| **Rotacionar Direção da Formação no Chão** | `Segurar Botão Direito + Arrastar` | `Toque Longo (segurar 1 dedo por 0.4s no chão/muro) + Arrastar` |
| **Construir Trincheira / Muro / Arame Farpado** | Selecionar na barra inferior + `Clique Esquerdo e Arrastar` | Selecionar na barra inferior + `Tocar e Arrastar 1 Dedo` pelo terreno e soltar |

---

## 8. Menus Responsivos, Redimensionáveis e Fixáveis

Os 5 menus da HUD (**Mapa & Teatro**, **Ritmo Tático**, **Comando & Base**, **Barra de Ações** e **Comando de Esquadrão**) se adaptam automaticamente ao tamanho da tela e podem ser personalizados:

| Ação | Como fazer |
| :--- | :--- |
| **Mover o menu** | Arraste pela barra de título `⠿` no topo do menu (mouse ou dedo) |
| **Aumentar / Diminuir** | Botões `−` / `+` (passos de 10%, de 50% a 180%) ou arraste a alça amarela no canto do menu |
| **Recolher / Expandir** | Botão `▾` / `▸` |
| **Restaurar o menu** | Botão `⟲` ou duplo clique na barra de título |
| **Fixar o menu (travar posição e tamanho)** | Botão `📌`. O menu fixado mostra só um pequeno `📌` no canto; clique nele para soltar |
| **Fixar / Soltar todos** | Botão `📌 FIXAR TODOS` / `🔓 SOLTAR MENUS` no topo direito |
| **Restaurar todo o layout** | Botão `⟲ RESTAURAR LAYOUT` no topo direito |

- **Escala automática:** os menus diminuem em telas menores (notebook, tablet, celular) e crescem até 110% em monitores grandes; o tamanho manual é aplicado por cima dessa escala.
- **Layout salvo:** posição, tamanho, recolhido e fixado ficam salvos no navegador e voltam ao reabrir o jogo.
- **Celular:** o menu Comando & Base começa recolhido, a barra de ações rola na horizontal e os controles dos menus ficam sempre visíveis e maiores.

---

## 9. Waypoints Visuais, Transporte de Tropas, Árvore de Pesquisa (`[T]`), Fim de Jogo e Áudio Militar

1. **Slots 1-para-1 na Cobertura & Linha de Caminho Inteligente:**
   - Cada soldado `i` recebe um destino exclusivo (`soldier[i].targetPos = coverSlots[i]`) com espaçamento mínimo de `1.2m`, sem empilhamento.
   - Ao passar o mouse ou ordenar movimento, o jogo desenha no chão uma linha 3D luminosa (`THREE.Line` + pontos de waypoint) contornando construções, muros, carcaças e árvores até o destino/cobertura.
2. **Veículo de Transporte de Tropas (`[F2] -> Transporte de Tropas`):**
   - Carrega até **2 esquadrões de infantaria** (até **12 soldados**) protegidos em seu interior, exibindo o contador `🪖 X/2 (Y)` acima do veículo.
   - **Embarcar:** selecione a infantaria e clique sobre o Transporte aliado.
   - **Desembarcar (`[Tecla U]` ou botão `🚪 DESEMBARCAR TROPAS [TECLA U]
   `):** abre a rampa traseira 3D e posiciona os esquadrões em formação atrás do veículo prontos para o combate.
3. **Árvore de Pesquisa & Tecnologia Militar (`[Tecla T]`):**
   - **3 Ramos:** 🪖 Melhoria de Tropas (*Coletes Kevlar +25% HP*, *Munição Perfurante +20% dano*, *Marcha Tática +20% vel.*), 🚜 Melhoria de Veículos (*Blindagem Reativa +35% HP*, *Turbo Diesel +25% vel.*, *Recarga Rápida*), e 🛰️ Inteligência & Drones (*Drone Recon UAV 3D*, *Drone Kamikaze FPV*, *Interceptação de Rádio*).
   - **Custo em Porcentagem (`25%`, `50%`, `75%`):** escolha quanto do orçamento atual investir — quanto maior a porcentagem, mais rápido a pesquisa é concluída.
4. **Tela de Fim de Jogo (Vitória / Derrota):**
   - Ao destruir o QG Principal inimigo, atingir 100% dos Pontos de Vitória (`1000 PTS`) ou perder o QG aliado, a partida é encerrada (`gameOver = true`) e exibe o resumo estatístico (*Unidades Eliminadas*, *Prisioneiros Interrogados*, *Trincheiras Escavadas*, *Pesquisas Concluídas*, *Tempo de Batalha*) com botões **`[⚔ JOGAR NOVAMENTE]`** e **`[🏛 VOLTAR AO MENU PRINCIPAL]`**.
5. **Áudio Militar Procedural (`SoundManager`):**
   - Música orquestral militar no Menu Principal, som ambiente de guerra na batalha, motor diesel contínuo + esteiras metálicas modulado pela velocidade/distância, zunido de drones, tiros de fuzil com eco, metralhadora `.50` e estrondo grave de canhão `120mm`.

---

## 10. Teatros de Operações (Mapas Jogáveis)

No **Lobby Skirmish**, escolha o campo de batalha antes de mobilizar o batalhão:

1. **🌾 Campos da Normandia (`normandy_fields`)** — Frente Rural europeia com sebes fechadas, lavouras, vilarejos e estradas de terra ideais para emboscadas e cobertura em muros.
2. **🏜️ Deserto de El Alamein (`el_alamein_ridge`)** — Frente Árida com rodovia central, platôs rochosos, bacia do Oásis Central com palmeiras, leito seco do Wadi Sul, muros de arenito e 12 pontos estratégicos de petróleo, munição e suprimentos.

---

## 11. Progressão do QG (Nível 1–3), Pontos de Comando (CP), IA & PWA

1. **Pontos de Comando (CP) & Evolução do QG:**
   - Ganhe **CP** capturando setores (`+15 CP`), eliminando esquadrões inimigos (`+25 CP`), interrogando prisioneiros (`+50 CP`) e destruindo estruturas (`+100 CP`).
   - **QG Nível 1 (Início):** Infantaria básica (Fuzileiros `180 SUP`, Assalto `240 SUP + 30 MUN`), Transporte de Tropas (`280 SUP + 40 COMB`), Trincheiras, Arame Farpado e Muros.
   - **QG Nível 2 (`650 SUP + 150 COMB` | `150 CP`):** Adiciona radar e bunkers ao QG; libera Snipers, Equipe Antitanque (`360 SUP + 75 MUN`), Humvee (`420 SUP + 90 COMB`), APC BTR (`650 SUP + 160 COMB`), Torre, Bunker e Pesquisas Nv. 1–2.
   - **QG Nível 3 (`1.400 SUP + 350 COMB + 250 MUN` | `450 CP`):** Libera Tanque MBT (`1.100 SUP + 300 COMB + 150 MUN`), Artilharia MLRS, Apoio Aéreo (`Caça A-10`, `Bombardeio`), Pesquisa Drone UAV (`1.200 SUP + 300 MUN + 200 COMB` | `450 CP`) e Drone Kamikaze FPV (`1.800 SUP + 500 MUN + 350 COMB` | `700 CP`).
2. **Dificuldade da IA:** Escolha no Lobby Skirmish entre **🟢 FÁCIL (Recruta)**, **🟡 MÉDIO (Veterano)** e **🔴 DIFÍCIL (General)**.
3. **Câmera Tática & Bordas Naturais:** Zoom mais próximo da ação, limites rígidos de câmera e florestas densas + neblina atmosférica (`FogExp2`) nas bordas dos 2 mapas (12 pontos de conquista cada).
4. **Web App Instalável (PWA) & Mobile:** Suporte a instalação com 1 clique (`[📲 BAIXAR / INSTALAR WEB APP]`), botão de **Tela Cheia (`⛶`)** e aviso automático de modo paisagem em celulares.

---

## 12. HUD Superior Limpa (Menu de Engrenagem `⚙️`) & Terreno 3D Orgânico

1. **Menu de Engrenagem (`⚙️` — Canto Superior Direito):**
   - O topo central da tela fica 100% livre e transparente. No canto superior direito permanecem apenas os **Recursos**, **Nível do QG / CP** e os 3 ícones compactos: **`🔬 [T]`**, **`🗺️ [TAB]`** e **`⚙️`**.
   - O painel **COMANDO DE ESQUADRÃO** é exibido apenas quando há tropa ou prédio selecionado, e o painel direito da **Base / Comando Aéreo** inicia minimizado com botão **`[–]` / `[+]`**.
3. **Painel `COMANDO DE ESQUADRÃO` & VFX de Combate:**
   - Cabeçalho unificado sem duplicação, mini-abas clicáveis para múltiplas unidades, cards em 1 linha compacta com barra de HP individual sem corte de texto e espaçamento físico real (`3.5m–9m`) com força de repulsão entre soldados e proteção contra dano em área.
   - **Habilidades Táticas com Cooldown:** **`Granada [G]`** (`15 MUN` | `12s` | arco 3D), **`Supressão [F]`** (`10 MUN` | `8s` | `2×` cadência e aplica `⚠️ PINNED` `-70%` vel. / `-60%` precisão), **`Kit Médico [C]`** (`20 SUP` | `20s` | `+45 HP` em `5s`) e **Posturas Reais** (`Em Pé` `100%`, `Agachado` `65% vel. / +25% def`, `Rastejar` `30% vel. / +55% def`).
   - **Transporte de Tropas (`[U]`):** Raio de embarque ampliado (`5.5m`), aproximação automática do veículo parado e desembarque seguro em arco livre com `1.5s` de imunidade de colisão.
4. **Quadro de Operações Táticas (`[TAB]`) & Nitidez 3D:**
   - **Seleção & Ordens Diretas no Mapa `[TAB]`:** Clique esquerdo (ou arraste caixa) para selecionar esquadrões direto no mapa tático ou na barra lateral de esquadrões; clique direito para enviar para qualquer setor, posição ou inimigo com linhas tracejadas animadas em tempo real e botão **`▶ Seguir Seta`**. Etiquetas dos 12 setores ajustadas com offset inteligente sem sobreposição.
   - **Árvores & Solo Nítidos:** Pinheiros militares (cones suaves) e árvores de campo (esferas suaves) proporcionais (`3.5m–5.5m`) espaçadas a `5.4m+`, solo plano sob estradas (`y = 0` até `6m` do eixo) com malha subdividida, micro-detalhe `64×64`, grama 3D em "X" (`0.6m–1.1m`), casas com telhado de duas águas, ruínas bombardeadas fumegantes e barricadas detalhadas com sacos de areia, chapas de aço e ouriços checos.
5. **Névoa Suave, Arbustos com Camuflagem, 3º Mapa (`Bastogne Inverno`) & Skins (`🎨 ARSENAL & SKINS`):**
   - **Névoa de Guerra `512×512`:** Transição suave via `createRadialGradient` com interpolação temporal e nuvens escuras animadas.
   - **Arbustos Volumétricos (`InstancedMesh`):** Infantaria e Snipers parados em arbustos ganham `+35%` de Cobertura Leve + Camuflagem (`-45%` alcance de detecção inimiga).
   - **3º Mapa (`❄️ Bastogne — Inverno Ardenas`):** Neve branca, lago congelado, pinheiros nevados e nevasca 3D em partículas, selecionável por Cards Visuais com preview em Canvas no Lobby simplificado.
   - **Skins de Exército:** 5 padrões de camuflagem (*Verde-Oliva*, *Flecktarn*, *Desert Tan*, *Fantasma do Ártico* e *Black Ops*) aplicáveis em tempo real aos soldados e blindados.
6. **Retornar à Base (`[B]` / `[R]`) & Tropas de Assalto (SMG/Granada):**
   - **Retornar à Base / Reparar (`[B]` para veículos | `[R]` para infantaria):** Recua automaticamente até o QG/Fábrica de Blindados desviando de obstáculos; veículos estacionados na base recebem reparo automático (`+15 HP/s` com faíscas) e infantaria ferida é curada (`+12 HP/s`).
   - **Tropas de Assalto vs Fuzileiros:** 6 soldados com boina, óculos táticos, ombreiras, granadas no cinto e SMG com carregador tambor (`+25%` velocidade, rajada rápida com `2.5x` dano a curta distância e granadas automáticas em arco 3D contra trincheiras, muros e casas).




2. **Terreno 3D Real (`256×256` Heightmap + Texturização Orgânica):**
   - Relevo procedural com colinas, leito de estradas nivelado com valas laterais e crateras 3D afundadas com bordas elevadas (`getTerrainHeight(x, z)` aplicado a unidades, veículos, prédios, muros e árvores).
   - Textura orgânica multicamadas (`2048×2048` + `bumpMap`) sem grades repetidas, estradas de terra curvas com trilhos de lagarta/roda e vegetação rasteira 3D em `InstancedMesh` (grama alta, rochas, troncos caídos, fardos de feno, cercas rurais, postes e árvores compostas com múltiplas copas).





---

## 13. Estabilidade de Tropas, Pane Mecânica (30% HP), Quadro Tático `[TAB]` & Tutorial

1. **Anti-Jitter & Chegada Suave:**
   - Soldados possuem zona morta de chegada (`~0.45m`) com velocidade zerada e separação desligada quando estacionados; unidades travadas contra muros por `> 0.4s` param em posição estável, e a mira usa interpolação angular suave (`dt * 6`) com trava de troca de alvo (`0.5s`). Estrada oeste (`Munição Oeste`) e corredor central livres de muros bloqueadores.
2. **Pane Mecânica (`<= 30% HP`) & Reparo de Engenheiros:**
   - Veículos com `<= 30%` de vida entram em estado `isBrokenDown` (velocidade `0`, cadência reduzida pela metade, fumaça preta + faíscas laranjas e ícone piscante `🔧 AVARIADO`).
   - Engenheiros a `<= 6m` restauram `+40 HP/s` gratuitamente (com faíscas azuis e barra de progresso), reativando o veículo acima de `50% HP`. Botão rápido **`[🔧 Consertar Veículo Mais Próximo]`** no painel do esquadrão de Engenheiros.
3. **Quadro de Operações Táticas `[TAB]`:**
   - Lista **`ESQUADRÕES`** filtrada apenas para infantaria e veículos móveis, com 3 modos militares (**`⚔️ ASSALTO`**, **`🛡️ DEFENDER`**, **`🏃 EM MARCHA`**) e **desmarcação automática** ao emitir a ordem para agilizar o comando em cadeia.
4. **Tutorial Completo & Treinamento Guiado:**
   - Aba **`📖 TUTORIAL`** no Menu Principal e botão **`📖 TUTORIAL`** na HUD com 5 cartões passo a passo e botão **`▶️ INICIAR TREINAMENTO GUIADO PASSO A PASSO`**.

---

## 14. Multiplayer Online (`NetworkManager` + Firebase / BroadcastChannel)

1. **Aba `🌐 MULTIPLAYER` no Menu Principal:**
   - Perfil rápido de Comandante com Login Rápido (Anônimo/Google via Firebase Auth REST ou modo offline local via `BroadcastChannel` para testar em 2 abas no mesmo PC).
   - **Matchmaking 1v1 (`matchmaking_queue`)**, **Criar Sala Privada** com código de 6 dígitos (`#FRT-XXX`) e botão **Copiar Código**, e **Entrar com Código**.
2. **Sincronização Otimizada de RTS:**
   - Envio de ordens compactas em `rooms/{roomId}/commands`, semente única `mapSeed` para mapas idênticos nos dois clientes, e *heartbeat* de estado a cada `1.5s` em `rooms/{roomId}/state` (HP, captura de setores e prisioneiros).
   - Jogador 1 controla os **Aliados** (Sul/Oeste) e Jogador 2 controla o **Eixo** (Norte/Leste), com câmera e Névoa de Guerra individuais.
3. **Configuração para Vercel / Firebase:**
   - Suporta variáveis de ambiente `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN` ou colagem direta via **`⚙️ Configurar Chaves Firebase`** na aba **Sistema**.


---

## 15. Bases Militares 3D Evolutivas, Muralhas Contínuas e Modos Clássicos 1v1 / 2v2

1. **Evolução Visual e Funcional das Instalações da Base:**
   - **Quartel-General (QG) Nível 1:** Estrutura reforçada em concreto armado cinza-escuro com sacos de areia frontais, tenda tática de estado-maior lateral, mastro com bandeira da facção ondulante e antena de rádio militar.
   - **Quartel-General (QG) Nível 2:** Segundo pavimento blindado, torre de vigia com holofote tático, radar giratório contínuo no telhado e casamata defensiva integrada.
   - **Quartel-General (QG) Nível 3:** Cúpula de comando supremo blindada, baterias antiaéreas duplas decorativas no teto, contrafortes de aço estrutural e heliponto/pátio iluminado por balizas âmbar.
   - **Fábrica de Blindados (Tank Depot):** Galpão industrial pesado com estrutura arqueada de vigas de aço, guindaste pórtico frontal amarelo, 2 portas amplas de hangar com faixas zebradas de segurança, chaminés industriais com fumaça e pátio demarcado.
   - **Comando Aéreo & Radar:** Torre de controle elevada com prato de radar rotativo de alta potência (`rotation.y += dt * 1.25`), sinalizadores luminosos vermelhos de aviação e geradores auxiliares de energia.
   - **Operações Especiais:** Barracão camuflado com caixotes de munição, cobertura em rede de camuflagem militar e torre de treinamento tático.
   - **Campo de Prisioneiros (POW Camp):** Perímetro com arame farpado duplo, guaritas elevadas de madeira nos cantos e pátio central de detenção e interrogatório de comandantes inimigos.

2. **Muralha Perimetral Contínua por Arrasto (Click & Drag) & Portões Blindados:**
   - **Geometria de Alto Porte:** Muros de concreto armado com `3.2m` de altura (`46u`) e `1.4m` de espessura (`20u`), pilares de aço estruturais a cada `8m` (`110u`), passarela superior com ameias/merlões defensivos e resistência elevada (`2.500 HP` por segmento) para absorver impactos de canhões e blindados.
   - **Construção Contínua (Ponto A ➔ Ponto B):** Ao selecionar `[🧱 Construir Muralha Defensiva]` em `[F3]` ou `[F4]`, o primeiro clique define o ponto inicial e o arrasto do mouse exibe o preview verde translúcido com pilares automáticos e encaixe magnético (*snap* a `<= 42u`) nas pontas de muros já erguidos, permitindo fechar o perímetro sem frestas. O segundo clique consagra a muralha inteira com custo proporcional em SUP e registra a caixa AABB orientada na física.
   - **Portão Blindado Automático:** Gerado automaticamente ao cruzar vias ou através do comando contextual `[🚧 Transformar em Portão Blindado]` ao clicar em um segmento de muro existente. Possui folhas metálicas corrediças que se abrem suavemente na aproximação de aliados (`< 5.5m`) e permanecem travadas contra o inimigo.
   - **Reparo e Reforço de Muros:** Painel contextual com `[🔧 Reparar Estrutura (60 SUP)]` e `[🛡️ Reforçar Muro (80 SUP)]` para restaurar e ampliar a blindagem perimetral.

3. **Preservação Integral dos Modos Clássicos de Campanha / Escaramuça (1v1 & 2v2):**
   - Disponível na aba **`⚔️ CAMPANHA / 1v1 & 2v2`** no topo do menu:
     - **3 Mapas Oficiais:** *Campos da Normandia* (Rural), *Deserto de El Alamein* (Árido) e *Bastogne Inverno* (Neve nas Ardenas).
     - **Modos:** `1v1` (Duelo tático direto) e `2v2` (Comandante + IA Aliada vs 2 IAs Inimigas).
     - **Configurações Táticas Rápidas:** Dificuldade da IA (*Recruta*, *Veterano*, *General*), Recursos Iniciais (*450*, *600*, *1000 SUP*), atalho para continuar a última batalha salva e **`🛠️ Modo Caixa de Areia (Sandbox)`** para testes livres com recursos infinitos.


---

## 16. Painel de Administração Militar (Comando Supremo) & Economia de Ouro

1. **Economia Militar & Desbloqueio de Batalhões:**
   - **Saldo Inicial Padronizado:** Todas as contas iniciam com **`0 Ouro Militar`** e **`0 XP`** (Nível 1 - Recruta).
   - **Fim do Ganho Automático:** Atingir a patente exigida libera a autorização do batalhão, mas sua utilização em combate requer a aquisição com **Ouro Militar** na aba **`🎖️ PATENTE & BATALHÕES`** (ou concessão direta pelo Administrador):
     - *Engenheiros de Combate Avançados:* `200 Ouro` (Nv. 2)
     - *Batalhão de Paraquedistas (101st Airborne):* `350 Ouro` (Nv. 4)
     - *Batalhão de Comandos / Forças Especiais:* `500 Ouro` (Nv. 6)
     - *Divisão de Blindados Pesados (MBT):* `750 Ouro` (Nv. 8)
     - *Bateria de Artilharia Pesada:* `1.000 Ouro` (Nv. 10)
   - Botões públicos de teste de XP e Ouro foram completamente removidos da visão dos jogadores comuns.

2. **Conta de Administrador & Aba `🛡️ PAINEL ADMIN`:**
   - **Reconhecimento Automático:** Usuários com callsign `admin`, `clarielton`, `clarieltonjunior`, `comando supremo` ou email cadastrado assumem o papel de Administrador automaticamente.
   - **Chave de Segurança Mestra:** Qualquer comandante pode validar privilégios administrativos no botão **`[🔑 Admin]`** digitando a chave mestra (`FRONT-ADMIN-1944` ou `admin`).
   - **Funcionalidades do Painel Admin:**
     - **Punições & Disciplina:** Lista de todas as contas registradas no Firebase RTDB, com ações para **`🚫 Banir Conta`** (bloqueio total de login e multiplayer com tela de aviso), **`✅ Desbanir`**, **`🔇 Silenciar Chat`** e **`⚠️ Bloquear Acesso a Partidas PvP`**.
     - **Gerador de Recursos & Ouro:** Injeção de quantias predefinidas (`+500`, `+1.000`, `+2.500`, `+5.000`, `+10.000`, `+50.000` Ouro) ou definição exata de saldo para si mesmo ou para qualquer jogador cadastrado, incluindo opção de zerar ouro.
     - **Concessão & Remoção de Itens:** Liberar ou remover individualmente batalhões e pacotes VIP, ou conceder **`⭐ TODOS os Batalhões`** e **`👑 COMBO VIP Completo`** para o jogador selecionado, com KPIs de resumo no topo, badge de status Firebase e validação real de sucesso/erro em todas as ações.
     - **Sincronização Segura de Perfil (`_pullCloudProfile`):** Ao fazer login ou abrir o jogo, o cliente lê o perfil salvo no Firebase **antes** de sincronizar, evitando sobrescrever Ouro Militar, Batalhões e Pacotes VIP concedidos pelo Administrador.
     - **Patente & Reset Limpo:** Ajustar patente para qualquer nível (1 ao 10) ou **`⚠️ Resetar Conta para Nv. 1`** (0 Ouro, 0 XP, bloqueando todos os itens) para realização de testes limpos de novos jogadores.

3. **Limpeza da Aba `📖 GUIA / SIST.` & `TUTORIAL`:**
   - O botão `🛠️ CAMPO DE TREINAMENTO (SANDBOX)` foi totalmente removido do menu de Guia e Sistema.
   - A sub-aba `⚙ ARSENAL DE COMBATE` foi removida da aba Tutorial/Guia, mantendo o menu enxuto e focado em Doutrina Militar, Uniformes, Saves e Configurações de Áudio/Câmera.

---

## 21. Sistema Físico de Colisão em Muralhas & Roteamento por Portões

### 21.1 Travamento Físico de Asas e Passagem por Portões Automáticos
- **Divisão Geométrica das Muralhas com Portão:** Muralhas fortificadas dotadas de portão (`isGate: true`) são divididas em duas asas laterais sólidas (`left wing` e `right wing`) e um vão central livre (`gapHalf = Math.min(38, len * 0.32)`):
  - **Asas Laterais:** Permanecem 100% sólidas e intransponíveis o tempo todo, tanto em `resolveObstacleCollision` quanto em `getSolidBuildingBoxes` e `pushPointOutsideAllBoxes`. Nem soldados nem veículos blindados conseguem penetrar ou atravessar as laterais de concreto ao lado do portão.
  - **Vão Central do Portão:** Abre automaticamente quando unidades aliadas se aproximam (distância `<= 150u` ou waypoints de aproximação `<= 60u`). Quando aberto para aliados, o vão central é livre para passagem. Quando fechado (ou para unidades inimigas), o vão é bloqueado com colisão física total.
  - **Proteção do Chassi de Veículos:** Em `pushPointOutsideAllBoxes`, o envelope de colisão AABB respeita o raio físico de veículos (`radius 28–38u`), garantindo que a carenagem e esteiras do veículo parem com precisão na face externa de construções, carcaças e muralhas.

### 21.2 Roteamento Inteligente (Line-vs-Wall Gate Pathfinding)
- Quando o jogador emite uma ordem de movimentação com o destino do outro lado de uma muralha defensiva:
  1. `BattlefieldMap.computeObstacleDetourPath()` detecta a interseção com a muralha defensiva.
  2. Localiza o portão correspondente ou o portão mais próximo na linha fortificada.
  3. Gera automaticamente os waypoints táticos guiados:
     - `pApproachStart`: Ponto de aproximação perpendicular à muralha a 48u de distância.
     - `pGateMid`: Ponto central exato no meio do portal blindado.
     - `pApproachEnd`: Ponto de saída perpendicular do outro lado da muralha.
  4. O renderizador 3D (`Renderer3D.js`) desenha a linha tracejada de caminho passando exatamente pelo vão do portão, orientando o jogador visualmente sem cortes irreais através das paredes.

### 21.3 Status e Validação do Banco de Dados Firebase Realtime Database
- **URL Ativa:** `https://companyoffrontline-default-rtdb.firebaseio.com/`.
- **Autenticação Obrigatória por E-mail e Senha (`AuthGate.jsx`):** A tela de Login solicita exclusivamente **E-mail e Senha**, enquanto o botão **`CRIAR CONTA (REGISTRAR)`** abre a tela dedicada de registro com **Nome de Comandante, E-mail e Senha**. O `NetworkManager` persiste `refreshToken` e `tokenExpiresAt`, renovando automaticamente o `idToken` via `securetoken.googleapis.com/v1/token`.
- **Névoa de Guerra, Radar & Início Simétrico no Multiplayer (`BattlefieldMap.js`, `Minimap.jsx`, `MultiplayerLobby.jsx`, `NetworkManager.js`, `Game.js` & `Renderer3D.js`):**
  - **Radar & Névoa por Time:** O minimapa/radar e a Névoa de Guerra acompanham dinamicamente o `localPlayerTeam` (`allies` ou `enemies`), garantindo que o time inimigo veja no radar apenas suas próprias tropas/rotas e inimigos efetivamente avistados.
  - **Início Apenas com QG:** Em partidas online (`1v1` e `2v2`), todos os jogadores iniciam exclusivamente com seu **Quartel-General (`hq_command`)**, construindo suas instalações e recrutando unidades do zero.
  - **Bots IA no Multiplayer (`1v1` & `2v2`):** Na sala de espera online, o Host pode adicionar ou remover **Bots IA** em qualquer vaga aberta (como oponente ou aliado no `2v2`).
- **Conexão por Código de Sala:** `joinRoom` aceita tanto `#FRT-XXX`, `FRTXXX` quanto os 3 dígitos diretos (`XXX`), informando claramente caso haja erro de autenticação ou modo local.

---

## 22. Segurança do Painel Administrativo & APC BTR/Stryker (Canhão 30mm)

### 22.1 Acesso Administrativo Oculto e Exclusivo
- O botão `🔑 Admin` e a ação `Revogar Modo Admin` foram removidos 100% da interface pública para que nenhum jogador ou convidado visualize opções administrativas.
- O acesso ao painel administrativo (`#admin-panel`) é validado estritamente pela conta mestre autenticada (`clarielton` / `clarielton.empreendimentos@outlook.com`) ou pelo atalho secreto exclusivo do proprietário (`Ctrl + Shift + L` com senha mestre).

### 22.2 APC Blindado BTR / Stryker (8x8)
- **Custo de Produção Atualizado:** `680 SUP + 160 MUN + 140 COMB` • Tempo de Construção: `18s` (Fábrica de Blindados, QG Nv. 2).
- **Sistema de Armamento & Transporte:**
  - Canhão Automático 30mm / Metralhadora Pesada (`range: 34m / 476u`, `fireRate: 0.35s`, `damage: 24`, rajadas de 6 disparos com recarga de `1.8s`, traçantes visíveis e som dedicado `'autocannon'`).
  - Rotação independente da torre superior (`turret`) na direção do alvo inimigo e suporte a transporte de até `2` esquadrões embarcados (`isTransport: true`), mantendo disparos ativos mesmo com infantaria embarcada.

### 22.3 Tanque de Batalha Principal (MBT 120mm)
- **Custo de Produção Atualizado:** `1150 SUP + 280 MUN + 260 COMB` • Tempo de Construção: `26s` (Fábrica de Blindados, QG Nv. 3).
- **Canhão Principal 120mm (HE/AP):** Alcance de `42m` (`588u`), cadência de `2.6s` por disparo, `135` de dano base (com multiplicador crítico contra blindados e construções) e dano em área (`4.5m` / `45u`), com traçante pesado, clarão, recuo do cano e explosão.
- **Metralhadora Coaxial 7.62mm:** Dispara rajadas rápidas (`0.25s`, `10` de dano) contra infantaria próxima (`<= 28m`) enquanto o canhão principal recarrega.

### 22.4 Equipe Antitanque (Bazuca / Javelin — Munição Explosiva HEAT)
- **Munição Explosiva Antitanque (`explosiveShots: true`, `splashRadius: 4.2m / 42u`):** Os soldados da **Equipe Antitanque (`at_javelin_squad`)** disparam foguetes/mísseis explosivos HEAT de alta penetração (`damage: 64`, `antiArmorBonus: 2.2x` contra blindados e `+45%` contra fortificações/prédios) com sopro traseiro de lançamento (*backblast*), rastro contínuo de fumaça e fogo durante o voo 3D e detonação explosiva completa (`spawnHeavyExplosion` + dano em área de `4.2m` que ignora cobertura frontal de muros e trincheiras).

---

## 23. Barra Lateral Reestruturada: Construções da Base & Comando Aéreo Bloqueado
- **Barra de Acesso Rápido Lateral Esquerda (2 Botões Principais):**
  - `[ 🏗️ CONSTRUÇÕES DA BASE ]` (`B` / `ESC`): Abre/fecha o menu dedicado com 3 abas limpas (**🏢 COMANDO** com evolução visual do QG Nv. 1 ➔ 2 ➔ 3 e os 4 prédios táticos, **🧱 DEFESAS** com muralhas contínuas/bunkers/trincheiras e **⚡ LOGÍSTICA** com postos de suprimentos), sem truncamento de texto e com botão `[ ✕ Fechar ]`.
  - `[ 🔒 COMANDO AÉREO (Requer Radar) ]` (`V`): Permanece bloqueado até a construção do prédio **Comando Aéreo / Radar**, exibindo aviso ao passar o mouse ou clicar. Após construir o Radar, acende como `[ ✈️ COMANDO AÉREO (ATIVO) ]` com confirmação por rádio e abre o painel exclusivo de suporte aéreo (`[Z]` Reconhecimento Aéreo, `[X]` Rasante Caça A-10 e `[C]` Bombardeio Tático) com barra visual de Cooldown da pista.

---

## 24. Limite de 3 Postos por Setor Capturado & Terreno/Estradas Realistas
- **Limite por Setor (`Sector Outpost Cap = 3`):** Só é permitido construir até **3 Postos de Suprimentos** (`build_outpost`) dentro do raio (`<= 22m`) de cada setor dominado pela sua equipe, com contador ao vivo (`📦 Postos no Setor: X / 3`) no preview e próximo às bandeiras aliadas. Se um posto for destruído, a vaga reabre (`2 / 3`).
- **Terreno Procedural & Estradas Realistas (`terrainTexture.js`):** Solo sintetizado por pixel via `ImageData` (`512x512` interpolado em alta qualidade para `2048x2048` + `bumpMap` `1024x1024`) com **Domain Warping + FBM multicamadas contínuo** (eliminando 100% blocos quadrados/grade) em 5 transições orgânicas de bioma (grama verde-prado, musgo profundo, capim seco dourado, húmus/terra úmida e trevo rasteiro), poeira suave nas margens das estradas, campos agrícolas com bordas esfumadas por gradiente radial e sulcos curvos, além de camada de micro-detalhe (`84x84` repeat com tufos curvos de grama e grãos de solo) e `InstancedMesh` de vegetação rasteira fora das estradas. As estradas possuem trilhos paralelos contínuos de pneus/esteiras, cascalho central, `bumpMap` próprio e detalhes de sinalização militar, cascalho e manchas de óleo nos acessos de setores.
- **Acabamento Orgânico, Florestas Multi-Camadas & Bocage:** Campos agrícolas possuem bordas irregulares por ruído orgânico com valas de drenagem; bosques recebem camada escura de solo de floresta (`Forest Floor`); árvores são renderizadas em `InstancedMesh` como Pinheiros assimétricos (4 camadas), Carvalhos ramificados (`Icosahedron`) e árvores queimadas próximas a crateras; arbustos compostos de 4 tufos sobre base lenhosa e lâminas de capim alto com balanço ao vento. Apenas troncos grossos bloqueiam veículos, permitindo que a infantaria entre livremente sob as copas para ativar camuflagem.
- **Pathfinding A* em Grade (`NavGrid.js`) & Formação Inteligente ao Redor de Construções:** O cálculo de rotas utiliza busca A* em grade de 8 direções com suavização por linha de visão (*string pulling*), penalidade de proximidade às paredes para manter distância segura, proibição de corte de quinas diagonais, auto-recalculo se a unidade travar (`wallStuckTimer`) e compressão automática dos slots de formação (`_clampFormationSlot`) para que soldados das pontas nunca caminhem contra paredes de prédios.
- **Rede de Trincheiras Conectadas & Navegação Interna:** Trincheiras possuem fundo de terra úmida escavada (`#2b2118`) com estrados de madeira escura enlameada (*duckboards*), passarelas de travessia para veículos sobre trechos retos, encaixe automático (`<= 2.5m`) que abre paredes divisórias formando corredores contínuos e navegação nó-a-nó (`findTrenchNetworkPath`) com altura rebaixada (`-0.55m`), `+70%` de defesa e imunidade a supressão.
- **Simulação em Segundo Plano (Hybrid RAF + Web Worker Heartbeat):** Um Web Worker inline (`20 ticks/s`) mantém 100% da lógica de combate, movimento, recursos e sincronização Firebase rodando mesmo quando a aba está minimizada ou oculta (`document.hidden === true`), pausando apenas a chamada `renderer.render()` para economizar GPU.
- **Texturas Arquitetônicas Procedurais & Fortificações Detalhadas (`Renderer3D.js`):** Os materiais das construções (`brickBarn`, `masonryStone`, `plasterWarm`, `concrete`, `concreteDark`, `roofTile`, `roofSlate`) utilizam texturas procedurais com `bumpMap` (tijolos aparentes, blocos de pedra, reboco envelhecido com rodapé, painéis de concreto e telhas), casas com fechamento de oitões sob o telhado e cumeeira, além de modelos 3D completos para **Posto de Suprimento** (tenda logística, paletes, tonéis, sacos de areia e torre de rádio com farol) e **Bunker Blindado .50cal** (casamata chanfrada com visor de aço e rede de camuflagem).
- **Fogo & Invasão Contra Construções Guarnecidas (`isLineBlockedByStructures` & `Game.js`):** Tanques, APCs, veículos armados e infantaria mantêm linha de visão livre contra o prédio em que um inimigo está guarnecido (`targetEnemy.garrisonedBuildingId`), danificando inclusive a estrutura com disparos explosivos. Ao clicar com o botão direito em uma construção ocupada pelo inimigo usando a **Tropa de Assalto (`assault_squad`)**, o esquadrão invade o prédio (`storm_building`), expulsa e suprime os defensores com dano de brecha e assume a posição.
- **Fábrica de Drones Táticos (`drone_factory`, `[F5]` em `BASE_BUILDINGS`):** Nova construção de base (`320 SUP + 50 COMB`) obrigatória para fabricar e armazenar Drones **UAV Recon (`7s`)** e **FPV Kamikaze (`9s`)**. Ao clicar no prédio da Fábrica de Drones, o painel exibe os botões de fabricação e lançamento com **limite finito** (`máximo 3 em estoque/fila` e `máximo 2 ativos em voo simultaneamente`).
- **Tiro em Movimento, Movimentação Fluida & Reparo de Engenheiros (`Game.js` & `SquadUnit.js`):** Infantaria e blindados disparam continuamente enquanto caminham/avançam, soldados possuem resposta rápida sem atraso de partida, giro suave de formação (`dt * 8.5`) e aceleração para acompanhar o esquadrão (`1.38x`), e **Engenheiros de Combate** reparam automaticamente veículos danificados (`+45 HP/s`), prédios da base (`+50 HP/s`) e muralhas fortificadas (`+55 HP/s`) próximos.
- **Salvamento Automático (`autoSaveBattle` em `Game.js`):** Durante partidas locais/campanha, o jogo salva automaticamente a cada **30 segundos** e ao sair/fechar a aba no slot dedicado `Salvamento Automático` (`autosave_latest`), mantendo até 8 saves manuais intactos.
- **Boletim de Atualizações para Jogadores & HUD Vetorial Responsivo (`GameMenus.jsx`, `HUD.jsx`, `MilIcons.jsx` & `hudLayout.js`):** Ao acessar o Hub Principal, um popup exibe as novidades jogáveis mais recentes (podendo ser reaberto pelo botão `Novidades` com ícone SVG). As telas iniciais (Login e Hub Principal) contam com escala ajustada (`zoom: 1.16` em desktops) para melhor leitura, enquanto a HUD em partida utiliza ícones SVG vetoriais exclusivos do jogo (`MilIcons.jsx`), painel direito organizado em 2 zonas sem colisão (`hud-top-right` até `46vh` com recursos em grade de 3 colunas e botões rápidos em 2 colunas, e `hud-bottom-right` até `49vh`), painel esquerdo compacto com lista de setores rolável, barra inferior central ajustada entre os painéis (`calc(100vw - 620px)`) e barra Sandbox recolhível sem sobreposição (`cof_hud_layout_v2`).
- **Mapa Único Oficial (`src/game/data/customMaps.json`):** O teatro de operações ativo no jogo é **Campos da Normandia (`normandy_fields`)**, com seu layout customizado de setores, construções, muros e florestas salvo em `customMaps.json` (os mapas de deserto e neve foram removidos do seletor).
- **Modo Espectador (IA vs IA para Gravação), Diretor de Cenas & Novo Hub Militar (`GameMenus.jsx`, `SceneDirector.js`, `MilIcons.jsx`, `HUD.jsx`, `Game.js`):**
  - **Modo Espectador (`spectatorMode` — Exclusivo Admin):** Coloca dois Comandantes de IA completos (Aliados vs Eixo) lutando pelo mapa sem intervenção humana e sem Névoa de Guerra (`Full Map Vision`). Possui barra de gravação cinematográfica com **`[ Ocultar HUD (Tecla H) ]`** para vídeos limpos (TikTok/Shorts/Reels), **`Director Cam`** automática acompanhando os maiores combates, controle de velocidade **`1x | 2x | 3x`** e botão **`Forçar Onda de Blindados`**.
  - **Diretor de Cenas (`SceneDirector.js` — Exclusivo Admin no Modo Espectador):** Painel recolhível (oculto junto com `[H]`) com **8 Cenários Instantâneos** no centro do mapa (*Guerra de Trincheiras*, *Choque de Blindados*, *Enxame de Drones*, *Cerco à Fortaleza*, *Desembarque Aéreo*, *Combate Urbano*, *Tempestade Aérea* e *Batalha Total Noturna*), além de **`Repetir Cena Atual`**, seletor de clima/iluminação (**`Dia | Fim de Tarde | Noite`**) e **`Câmera Baixa (Close-up)`** cinematográfica.
  - **Controle de Acesso Rigoroso:** **Modo Espectador** e **Modo Sandbox (`[F10]`)** são exclusivos para contas **Admin**; o **Editor de Mapas 3D** aparece e funciona **exclusivamente em modo local** (`localhost` / `127.0.0.1` / `192.168.*`).
- **Multiplayer Online 1v1 / 2v2, Spawn Aleatório nos Cantos, Névoa Real & Bots IA (`Game.js`, `BattlefieldMap.js`, `Minimap.jsx`, `MultiplayerLobby.jsx`):**
  - **Interpolação de Rede & Anti-Stuck Tangencial:** Unidades sincronizadas em clientes remotos usam interpolação suave (`networkTargetPos` com `dt * 12`) sem teleportes, e unidades bloqueadas por mais de `0.6s` (`< 0.15m` de avanço) aplicam desvio tangencial perpendicular automático + recálculo de rota.
  - **Névoa de Guerra Real por Time (`teamId`):** No modo Online, cada equipe só enxerga suas próprias tropas, rotas, bases e inimigos dentro do raio de visão ativo no terreno 3D e no minimapa (o mapa 100% revelado fica restrito ao Modo Espectador IA vs IA).
  - **Início Limpo Apenas com QG + Spawn nos Cantos (`applyCornerRandomSpawns`):** Todos os participantes começam exclusivamente com 1 QG Nível 1 posicionado aleatoriamente via `mapSeed` nos 4 cantos seguros do mapa (`1v1` em cantos diagonais opostos; `2v2` em cantos adjacentes vs opostos).
  - **Comandantes IA no Lobby:** O dono da sala pode adicionar/remover **Comandantes IA** com dificuldade travada em **Difícil** em qualquer vaga aberta no `1v1` ou `2v2`.
- **Trava de Velocidade 1x no Online, Modos Exclusivos em Produção & Campanha Continental de 15 Dias (`Game.js`, `HUD.jsx`, `GameMenus.jsx`, `NetworkManager.js`, `campaign15Data.js`, `Campaign15Map.jsx`):**
  - **Velocidade Travada em `1.0x` no Online:** Em qualquer partida online (`1v1`, `2v2` ou Campanha de 15 Dias), os controles de `2x`, `3x` e `Pausar` são ocultados na HUD e `timeScale` é forçado para `1.0` no loop de simulação.
  - **Modos Exclusivos em Produção:** Fora de `localhost` / `127.0.0.1`, jogadores comuns veem apenas **⚔️ BATALHA ONLINE (1v1 & 2v2)** (com criação de sala `1v1`/`2v2` e lista de salas na mesma tela) e **🌍 GUERRA DE 15 DIAS (40 TERRITÓRIOS)** (modos offline, Sandbox e Editor permanecem restritos ao `localhost` / Admin).
  - **Sistema de Rede Elétrica & Montagem de Base Estilo Outlive (`rtsData.js`, `Game.js`, `Renderer3D.js`, `HUD.jsx`):**
    - **Rede Conectada (BFS):** O QG possui raio inicial de `28m` (`392u`, `+60 MW`); fábricas, bunkers e torres só podem ser posicionados e operar quando ligados à Rede Elétrica (via QG, **Usina Eólica `+45 MW`**, **Usina Termelétrica `+140 MW`** ou **Relé / Torre de Transmissão `+28m`**).
    - **Posicionamento Livre & Aviso de Falta de Energia:** Todas as construções da base (`Operações Especiais`, `Fábrica de Blindados`, `Comando Aéreo`, `Campo POW`, `Fábrica de Drones`, `Usinas` e `Relés`) são posicionadas livremente pelo jogador via Ghost Placement; se colocadas fora da rede ou com déficit de MW, exibem alerta explícito **`⚠️ FALTA DE ENERGIA EM: <Nome da Construção>`** até receberem energia.
    - **Balanço Energético & Corte de Linha:** Medidor `⚡ Energia: X / Y MW (Z% Eficiência)` na HUD; déficit global (`< 100%`) reduz produção e cadência das torres em 50% com alerta, e prédios isolados pelo corte de um Relé/Usina ficam **`⚡ OFFLINE`** até a reconexão.
  - **Sistema de Coleta Física Estilo Outlive & Console Tático Inferior (`BattlefieldMap.js`, `Game.js`, `Renderer3D.js`, `Minimap.jsx`, `HUD.jsx`):**
    - **Jazidas de Recursos (`resourceDeposits`):** 10 depósitos minerais espalhados pelo mapa (`3.500` de reserva cada), visíveis no terreno 3D e como losangos dourados no Radar, diminuindo visualmente conforme são extraídos.
    - **Refinaria & Caminhão Coletor (`refinery` & `harvester_truck`):** Construir uma **Refinaria (`300 SUP` • `25 MW`)** gera automaticamente `1` **Caminhão Coletor** (`450 HP`, blindado sem arma) que dirige até a jazida mais próxima, minera por `4s` (`0%` ➔ `100%`) e retorna à Refinaria energizada depositando **`+130 SUP` + `+40 MUN`** por viagem (caminhões extras custam `150 SUP`).
    - **HUD Clássica Estilo Outlive:** Barra superior fina (`36px`) com `📦 SUP`, `💣 MUN`, `⛽ COMB`, `⚡ ENERGIA`, `🚩 TERRITÓRIOS`, `[ 🔊 Som On/Off ]` e Menu; e **Console Tático Inferior (`175px`)** dividido em 3 módulos fixos (**Esquerda:** Radar quadrado `170×170px`; **Centro:** Visor de Telemetria da Seleção com HP, Energia, Carga do Coletor e grade de esquadrões; **Direita:** Comandos rápidos + **Grade `4×2` Contextual** que muda automaticamente conforme o prédio ou unidade selecionada + Tooltip inteligente de 1 linha).
  - **Canteiro de Obras Progressivo, Doca da Refinaria & Física/Áudio Procedural (`Game.js`, `Renderer3D.js`, `SoundManager.js`):**
    - **Canteiro de Obras (`underConstruction`):** Prédios iniciam em `scale.y = 0.15` com estacas amarelas e opacidade `0.45`, subindo até `100%` apenas enquanto Carros Construtores soldam no local.
    - **Doca Externa da Refinaria:** O Carro Coletor navega até `dockPos` na frente da rampa (sem colidir na AABB da Refinaria), descarrega por `1.8s` e credita `+130 SUP` e `+40 MUN`.
    - **Suspensão Dinâmica & Áudio Procedural (`SoundManager.js`):** Veículos inclinam (`pitch & roll`) em acelerações, curvas e recuos de canhão, emitem fumaça de escapamento e contam com ronco diesel (`lowpass 85Hz–140Hz`) e chiado de solda elétrica via Web Audio API.
  - **Controle Avançado de Drones & Painel Tático de Veículos Estilo Outlive (`Game.js`, `HUD.jsx`):**
    - **Modos de Drone (`drone_factory`):** Fileira superior com fabricação separada (**`🛸 Fabricar UAV`**, **`💥 Fabricar FPV`**, **`🛡️ Fabricar Int.`** e **`🎯 Fixo / 🔄 Patrulha`**) e fileira inferior dedicada ao Hangar (**`🚀 Lançar UAV`**, **`🚀 Lançar FPV`**, **`🚀 Lançar Int.`** e **`🏠 Recolher Base`**).
    - **Comandos de Veículos:** **`🔧 Chamar Reparo`** (despacha o Engenheiro/Construtor mais próximo com faíscas e som de solda), **`🔄 Patrulhar`** (rota contínua A↔B, com `Shift` para múltiplos pontos), **`➡️ Linha Reta`** (alinhamento em formação com velocidade sincronizada), **`⚓ Manter Posição`**, **`⚔️ Atacar Movendo`** e **`🛡️ Postura`** (*Agressiva* | *Defensiva* | *Passiva*).
  - **Centro de Pesquisa Obrigatório, Carros Construtores & Fortificações de Campo (`rtsData.js`, `techTreeData.js`, `Game.js`, `HUD.jsx`):**
    - **Centro de Pesquisa (`research_center` • `350 SUP + 80 MUN`):** Obrigatório e conectado à Rede Elétrica para liberar o painel de pesquisas (`[Y]` / `[T]`), incluindo *Blindagem Reativa MBT*, *Munição Perfurante*, *Motor Turbo*, *Rede Elétrica de Alta Eficiência (+25% MW)*, *Drone Interceptador*, *Bateria & Alcance de Drones* e *Carga Explosiva FPV*. Se perder energia ou for destruído, a pesquisa em andamento pausa automaticamente.
    - **Carros Construtores (`constructor_truck` • `140 SUP`):** Cada partida inicia com `1` Carro Construtor ao lado do QG (mais unidades podem ser produzidas no QG ou Fábrica de Blindados). Possui modelo 3D amarelo-industrial/grafite com giroflex âmbar, bobinas ciano e braço mecânico com laser de solda ao erguer estruturas de `0%` a `100%` (múltiplos construtores aceleram a construção).
    - **Modelos 3D Distintos (`Renderer3D.js`, `HUD.jsx`, `Minimap.jsx`):** **Humvee Tático (`🚙`)** em verde-oliva com capô inclinado, para-lamas e torreta `.50cal`; **Carro Construtor (`🏗️`)** com braço de solda e giroflex; e **Carro Coletor (`🚜`)** 6×6 laranja-ferrugem (`1.4×` maior) com pá dentada e caçamba dinâmica que exibe cristais subindo conforme a carga (`0%` ➔ `100%`).
    - **Fortificações de Campo pelas Tropas:** Ao selecionar infantaria/engenheiros, a grade `4×2` exibe *Cavar Trincheira*, *Sacos de Areia*, *Arame Farpado & Ouriços* e *Plantar Mina* para execução direta no front.
    - **Aba `⛰️ RELEVO`:** Pincéis em tempo real para **Elevar Morro / Colina**, **Montanha Rochosa** (com pintura de rocha cinza-escura e bloqueio de veículos pesados em encostas íngremes, permitindo infantaria/snipers), **Rebaixar / Vale / Cratera** e **Aplainar Terreno**, com sliders de Raio (`8m–40m`) e Intensidade (`Baixa | Média | Alta`).
    - **Bônus de Terreno Elevado (`High Ground`):** Unidades em elevações `>= 2.5m` recebem `+25%` de alcance de tiro.
    - **Aba `🚩 SETORES`:** Permite **Criar Novos Pontos de Conquista (`S1..S24`)**, editar nome, tipo de recurso (`SUP`, `MUN`, `COMB`, `Estratégico`), dono inicial (`Neutro`, `Time 1`, `Time 2`) e excluir pontos.
    - **Salvar & Carregar Mapas Customizados:** Ao salvar no Editor com nome personalizado, o mapa (heightmap + setores + estruturas) fica disponível nos seletores de **Sandbox**, **Modo Espectador (IA vs IA)** e **Salas Online (`1v1`, `2v2`, `3P` e `4P`)**.
    - Criação unificada de sala com escolha de modo (`1v1`, `2v2`, `3P FFA`, `4P FFA`), seletor visual estilizado em grade para **Mapas Padrão** e **Mapas Grandes** (*Vale do Reno — 18 Setores*, *Kursk — 20 Setores*), Matchmaking rápido (`⚡ Buscar 1v1`, `⚡ Buscar 2v2`, `⚡ Buscar 3P / 4P`), cores distintas por slot (Azul, Vermelho, Âmbar, Esmeralda) e selos de loadout sincronizados no lobby.
    - **5 Pacotes de Suprimentos Multiplayer:** *Kit Fortificação Inicial de QG*, *Impulso +100% XP*, *Paraquedistas & Comando*, *Arsenal Visual & Bandeira Dourada* e *Combo Comandante Supremo* (com `+1.000` Ouro bônus), ativados automaticamente ao entrar nas partidas online (modo Guerra de 15 Dias removido do Hub).
  - **Hub Militar Profissional em 2 Colunas:** Interface sobre batalha 3D em câmera lenta ao vivo ao fundo, cabeçalho com Perfil do Jogador (Patente, XP, Ouro Militar, `ONLINE` e `Sair`, sem expor Admin para contas comuns), menu lateral tático com ícones SVG militares limpos (sem emojis genéricos) e painel central dinâmico com prévia de operação e botão **`INICIAR OPERAÇÃO`**.
- **Editor de Mapa 3D Local Integrado ao Deploy (`vite.config.js`, `src/game/data/customMaps.json`, `BattlefieldMap.js`, `HUD.jsx`, `src/styles/game.css`):** Ao rodar em modo local (`localhost` / `127.0.0.1`) ou autenticado como Admin, a barra lateral exibe `[ 🛠️ EDITOR DE MAPA (LOCAL) ]`, que **oculta toda a HUD de combate da partida**, **pausa o jogo local automaticamente (`timeScale = 0`)**, oculta a Névoa de Guerra e apresenta um **Dock Militar Compacto** com:
  1. **Cabeçalho Compacto em 1 Linha:** `[ ✕ SAIR DO EDITOR ]`, `[ 💾 SALVAR MAPA ]` e `[ ◀ Recolher Menu ]` (recolhe o menu lateral com 1 clique para ver o mapa 3D em tela cheia enquanto posiciona itens) + barra de câmera de `34px` (`[ 🔍+ ]`, `[ 🔍- ]`, `[ 🌐 Visão Geral ]`).
  2. **Barra Fixa de Transformação do Objeto:** Rotação rápida (`[ ↺ -45° ]`, indicador ao vivo `90°`, `[ ↻ +45° (Tecla R) ]`), escala em linha (`0.8x`, `1x`, `1.25x`, `1.5x`), botão **`[ ✋ Mover / Girar ]`** (permite clicar e arrastar qualquer objeto já colocado no mapa para movê-lo, enquanto **`Botão Direito + Arrastar`** ou **`[R]`** rotaciona o objeto em tempo real mostrando uma seta direcional amarela e contorno verde no chão 3D indicando para qual lado está virado) e botões de exclusão (`[ 🗑️ Apagar ]` e `[ 🧹 Área ]`).
  3. **Navegação por 4 Abas Horizontais em Grade 2 Colunas (com Scrollbar Grafite `4px` `#2a2f2a` e borda verde-oliva brilhante `#84cc16` no item ativo):**
     - `🏠 PRÉDIOS`: Casa Rural Europeia, Sobrado Urbano (2 Andares), Celeiro + Silo, Galpão Industrial, Ruína de Tijolo, Bunker de Concreto, Casa Adobe (Deserto), Carcaça de Tanque e Caminhão Queimado.
     - `🧱 MUROS & DEFESAS`: Muralha Fortificada de Concreto, Muro de Tijolo / Alvenaria, Muro de Pedra Rural, Trincheira Conectável, Sacos de Areia e Ouriços Antitanque (clique e arraste de ponta a ponta com prévia em metros `Xm` no chão para criar trechos maiores do tamanho desejado; trincheiras e muros também são salvos em `customMaps.json`).
     - `🌲 NATUREZA`: **Área de Floresta (`forest_area`)** — clique e arraste o raio (ou clique 1x) para gerar um bosque completo com dezenas de pinheiros, carvalhos, arbustos e zona de camuflagem furtiva (`+50% DEF`) salva em `customMaps.json` — além de Pinheiro / Conífera 3D, Carvalho Copa Larga, Árvores Queimadas, Arbustos / Cerca Viva e Rochas / Crateras.
     - `🚩 SETORES (S1–S12)`: Grid compacto dos 12 pontos de captura (`S1` a `S12`) com botão `[ 🚩 Mover Bandeira Selecionada ]` e arraste direto no chão 3D.
  4. **Etiqueta Fixa de Feedback Ativo no Rodapé:** Exibe `Ativo: [Nome do Objeto] • Clique no mapa para colocar | [R] Girar | [Botão Dir.] Cancelar`. O **Modo Sandbox (`[F10]`)** permanece restrito exclusivamente a contas de Administrador (`isAdminUser()`).
