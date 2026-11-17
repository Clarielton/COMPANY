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
   - **Desembarcar (`[Tecla U]` ou botão `🚪 DESEMBARCAR TROPAS [TECLA U]`):** abre a rampa traseira 3D e posiciona os esquadrões em formação atrás do veículo prontos para o combate.
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
