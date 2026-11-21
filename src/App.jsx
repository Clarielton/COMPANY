import React, { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game.js';
import HUD from './components/HUD.jsx';
import GameMenus from './components/GameMenus.jsx';

export default function App() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const gameRef = useRef(null);

  const [hud, setHud] = useState(null);
  const [gameState, setGameState] = useState('MENU'); // 'MENU' | 'PLAYING' | 'PAUSED' | 'INTERROGATION'
  const [menuInitialTab, setMenuInitialTab] = useState('skirmish');
  const [interrogationTarget, setInterrogationTarget] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalledPwa(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayRef.current;
    if (!canvas) return;

    const game = new Game({
      canvas,
      overlayCanvas,
      onHudUpdate: (snapshot) => setHud(snapshot),
      onInterrogate: (target) => {
        setInterrogationTarget(target);
        setGameState('INTERROGATION');
      },
    });
    gameRef.current = game;
    game.start();

    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    const isMenu = gameState === 'MENU';
    const isPaused = gameState === 'PAUSED' || gameState === 'INTERROGATION';
    game.setMenuActive(isMenu);
    game.setPaused(isPaused);
  }, [gameState]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Escape') {
        const game = gameRef.current;
        if (game?.activeCommandMode) {
          game.activeCommandMode = null;
          game.trenchPreview = null;
          return;
        }
        if (gameState === 'INTERROGATION') {
          setInterrogationTarget(null);
          setGameState('PLAYING');
        } else if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState]);

  const startWithMode = (mode, startingResources, mapId, aiDifficulty) => {
    const game = gameRef.current;
    if (game) {
      game.setupMatch(mode, startingResources, mapId, aiDifficulty);
      game.setMenuActive(false);
      game.setPaused(false);
      game.lockPointer();
    }
    setInterrogationTarget(null);
    setGameState('PLAYING');
  };

  const resumeGame = () => {
    const game = gameRef.current;
    if (game) {
      game.setMenuActive(false);
      game.setPaused(false);
      game.lockPointer();
    }
    setInterrogationTarget(null);
    setGameState('PLAYING');
  };

  const game = gameRef.current;

  return (
    <div className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" />
      <canvas ref={overlayRef} className="overlay-canvas" />

      {gameState !== 'MENU' && (
        <HUD
          gameRef={gameRef}
          hud={hud}
          onPause={() => {
            setMenuInitialTab('skirmish');
            setGameState('PAUSED');
          }}
          onOpenSaves={() => {
            setMenuInitialTab('saves');
            setGameState('PAUSED');
          }}
          onSelectCommandSlot={(slot) => game?.triggerCommandSlot(slot)}
          onToggleMute={() => game?.audio.toggleMute()}
        />
      )}

      <GameMenus
        gameState={gameState}
        initialTab={menuInitialTab}
        hud={hud}
        interrogationTarget={interrogationTarget}
        onPlayMode={startWithMode}
        onPlaySandbox={(mode, mapId) => {
          startWithMode(mode, 1000, mapId, 'medium');
          gameRef.current?.enableSandboxMode();
        }}
        onPlaySpectator={(mapId) => {
          startWithMode('2v2', 1000, mapId, 'hard');
          gameRef.current?.enableSpectatorMode();
        }}
        onOpenMapEditor={(mapId) => {
          startWithMode('1v1', 1000, mapId, 'medium');
          gameRef.current?.setMapEditorOpen(true, 'farmhouse', 0, 1.0);
        }}
        onStartOnlineMatch={({ networkManager, room, localSlot }) => {
          const game = gameRef.current;
          if (game) {
            game.startOnlineMatch({ networkManager, room, localSlot });
            game.setMenuActive(false);
            game.setPaused(false);
            game.lockPointer();
          }
          setInterrogationTarget(null);
          setGameState('PLAYING');
        }}
        onResume={resumeGame}
        onSaveBattle={(customTitle) => game?.saveBattle(customTitle)}
        onLoadBattle={(saveId) => {
          const ok = game?.loadSavedBattle(saveId);
          if (ok) resumeGame();
        }}
        onDeleteBattle={(saveId) => game?.deleteSavedBattle(saveId)}
        onExportBattle={(saveId) => {
          if (!game) return;
          const list = game.getSavedBattles();
          const target = saveId
            ? list.find((s) => s.id === saveId)
            : game.serializeBattleState('Operação Exportada');
          if (!target) return;
          const blob = new Blob([JSON.stringify(target, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `batalha-${target.gameMode || 'rts'}-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onImportBattle={(stateObj) => {
          const ok = game?.loadBattleState(stateObj);
          if (ok) resumeGame();
        }}
        onReturnMainMenu={() => {
          setInterrogationTarget(null);
          setMenuInitialTab('skirmish');
          setGameState('MENU');
        }}
        onRestart={(mode, startingResources) => {
          game?.restart(mode, startingResources);
          resumeGame();
        }}
        onUpdateSettings={(partial) => game?.updateSettings(partial)}
        onSelectSkin={(skinId) => game?.setPlayerSkin(skinId)}
        canInstallPwa={Boolean(installPrompt) && !isInstalledPwa}
        isInstalledPwa={isInstalledPwa}
        onInstallPwa={async () => {
          if (installPrompt) {
            installPrompt.prompt();
            await installPrompt.userChoice.catch(() => null);
            setInstallPrompt(null);
          } else {
            alert(
              'Para instalar o Web App: clique no ícone de instalação na barra de endereços do navegador (Chrome/Edge) ou em "Adicionar à Tela Inicial" no celular.'
            );
          }
        }}
        onResolveInterrogation={(method) => {
          if (interrogationTarget) {
            game?.resolveInterrogation(method, interrogationTarget.id);
          }
          setInterrogationTarget(null);
          resumeGame();
        }}
      />
    </div>
  );
}
