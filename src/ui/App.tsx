// Top-level shell. Offline, three screens — game picker, lobby, in-game —
// selected by a local route state. While this device is in an online room the
// room decides instead: connecting / error card, the room's lobby, or its
// match. The shell is game-agnostic; everything game-specific loads via
// GameModule.ui().

import { useEffect, useRef, useState } from 'react';
import { GAMES, getGameById } from '@/games/registry';
import type { Seat } from '@/core/types';
import { useNetworkStore } from '@/store/networkStore';
import { Brand, Burst } from './Brand';
import { GameLobby } from './GameLobby';
import { GameHost } from './GameHost';
import { OnlineLobby } from './OnlineLobby';
import { JoinRoomBox, OnlineStatusCard, useRejoinFromUrl } from './OnlineStatus';
import { playerRange } from './lobbyParts';
import { demoRoute } from './devDemo';

type Screen =
  | { kind: 'pick' }
  /** `initial` pre-fills the lobby when a finished match returns to it. */
  | { kind: 'lobby'; gameId: string; initial?: { config: unknown; seats: Seat[] } }
  | { kind: 'playing' }
  /** Dev only (?gallery=): every card face of one game. */
  | { kind: 'gallery'; gameId: string };

export default function App() {
  // Dev builds honour ?demo= / ?lobby= deep links (art reviews, scripts/render.mjs).
  const [screen, setScreen] = useState<Screen>(() => (import.meta.env.DEV ? demoRoute() : null) ?? { kind: 'pick' });
  // Bumped on every return from a match so the lobby remounts and re-seeds
  // its state from the new `initial`.
  const [lobbyVisit, setLobbyVisit] = useState(0);
  const connection = useNetworkStore((s) => s.connection);
  const urlCode = useRejoinFromUrl();

  // Leaving a room lands on the game picker.
  const wasOnline = useRef(false);
  useEffect(() => {
    if (connection !== 'disconnected') wasOnline.current = true;
    else if (wasOnline.current) {
      wasOnline.current = false;
      setScreen({ kind: 'pick' });
    }
  }, [connection]);

  const online = connection !== 'disconnected';
  const inGame = (online && connection === 'in-game') || (!online && screen.kind === 'playing');

  return (
    <div className="app-shell">
      <header>
        <Brand onClick={online ? undefined : () => setScreen({ kind: 'pick' })} />
      </header>
      <main className={inGame ? 'wide' : undefined}>
        {online && (connection === 'connecting' || connection === 'error') && <OnlineStatusCard />}
        {online && connection === 'lobby' && <OnlineLobby />}
        {online && connection === 'in-game' && (
          <GameHost onExit={() => {}} onReturnToLobby={() => {}} />
        )}
        {!online && screen.kind === 'pick' && (
          <Home urlCode={urlCode} onPick={(gameId) => setScreen({ kind: 'lobby', gameId })} />
        )}
        {!online && screen.kind === 'lobby' && (() => {
          const module = getGameById(screen.gameId);
          if (!module) return <p>Unknown game.</p>;
          return (
            <GameLobby
              key={lobbyVisit}
              module={module}
              initial={screen.initial}
              onBack={() => setScreen({ kind: 'pick' })}
              onStart={() => setScreen({ kind: 'playing' })}
            />
          );
        })()}
        {import.meta.env.DEV && screen.kind === 'gallery' && <DevGallery gameId={screen.gameId} />}
        {!online && screen.kind === 'playing' && (
          <GameHost
            onExit={() => setScreen({ kind: 'pick' })}
            onReturnToLobby={(gameId, initial) => {
              setLobbyVisit((n) => n + 1);
              setScreen({ kind: 'lobby', gameId, initial });
            }}
          />
        )}
      </main>
    </div>
  );
}

/** Dev only: a game's Gallery on a plain page, for scripts/render.mjs. */
function DevGallery({ gameId }: { gameId: string }) {
  const [Gallery, setGallery] = useState<React.ComponentType | null | undefined>(undefined);
  useEffect(() => {
    void getGameById(gameId)?.ui().then((b) => setGallery(() => b.Gallery ?? null));
  }, [gameId]);
  if (Gallery === undefined) return <div className="cg-spinner" />;
  if (Gallery === null) return <p>{gameId} has no Gallery yet.</p>;
  return <div className="dev-gallery"><Gallery /></div>;
}

function Home({ urlCode, onPick }: { urlCode: string | null; onPick(gameId: string): void }) {
  return (
    <>
      <section className="home-hero">
        <div className="home-pitch">
          <h1>
            Card games that <em>end friendships.</em>
          </h1>
          <p>
            Nope your neighbour, neigh their unicorn, slay their monster, then blow up
            the whole table. Hot-seat, online with friends, or against the bots.
          </p>
          <div className="home-stats">
            <span className="home-stat">{GAMES.length} games</span>
            <span className="home-stat">No sign-up</span>
            <span className="home-stat">Rooms by code</span>
          </div>
          <Burst className="home-pitch-burst" />
        </div>
        <JoinRoomBox initialCode={urlCode} />
      </section>
      <div className="game-list">
        {GAMES.map((g, i) => {
          const Thumb = g.Thumbnail;
          return (
            <div
              key={g.id}
              className="game-card"
              role="button"
              tabIndex={0}
              style={{ '--i': i, '--tile-accent': g.accent } as React.CSSProperties}
              onClick={() => onPick(g.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(g.id); } }}
            >
              <div className="game-card-art">{Thumb && <Thumb />}</div>
              <div className="game-card-meta">
                <div className="game-card-title">
                  <h3>{g.name}</h3>
                  <span className="player-range">{playerRange(g)}</span>
                </div>
                <p className="game-card-tagline">{g.tagline}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
