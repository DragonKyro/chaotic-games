// Placeholder lobby form + board for games that are outlines only. Lazily
// imported from module.ui() so it stays out of the picker bundle, same as real
// game UI would be. Delete with the rest of _scaffold/ once every game is real.

import type { GameStateShape, GameUiBundle } from '@/core/module';
import type { Seat } from '@/core/types';
import type { ScaffoldConfig, ScaffoldUiOptions } from './index';

/**
 * Builds a lobby config form (expansion toggles) + a placeholder board that
 * states plainly that the game isn't implemented and lists what's outstanding.
 */
export function makeScaffoldUi<S extends GameStateShape, A, C extends ScaffoldConfig>(
  opts: ScaffoldUiOptions,
): GameUiBundle<S, A, C> {
  function LobbyConfig({ config, onChange }: {
    config: C;
    seats: Seat[];
    onChange: (config: C) => void;
  }) {
    function toggle(id: string) {
      const next = config.expansions.includes(id)
        ? config.expansions.filter((x) => x !== id)
        : [...config.expansions, id];
      onChange({ ...config, expansions: next } as C);
    }
    return (
      <div className="scaffold-config">
        <p className="scaffold-premise">{opts.premise}</p>
        {opts.expansions.length > 0 ? (
          <>
            <div className="scaffold-expansion-list">
              {opts.expansions.map((e) => (
                <label key={e.id} className="scaffold-expansion" title={e.summary}>
                  <input
                    type="checkbox"
                    checked={config.expansions.includes(e.id)}
                    onChange={() => toggle(e.id)}
                  />
                  <span>
                    {e.name}
                    {!e.verified && <em className="scaffold-unverified"> (unverified)</em>}
                    <small>{e.summary}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="scaffold-warn">
              Toggles are recorded in the match config but have no effect yet —
              no game logic is implemented.
            </p>
          </>
        ) : (
          <p className="scaffold-warn">
            No expansion list for this game yet — it still needs to be sourced
            from the publisher.
          </p>
        )}
      </div>
    );
  }

  function GameView() {
    return (
      <div className="scaffold-board">
        <h2>{opts.gameName}</h2>
        <p className="scaffold-badge">Outline only — not playable yet</p>
        <p className="scaffold-premise">{opts.premise}</p>
        <h4>Still to build</h4>
        <ul>
          {opts.todo.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
    );
  }

  return {
    LobbyConfig: LobbyConfig as GameUiBundle<S, A, C>['LobbyConfig'],
    GameView: GameView as GameUiBundle<S, A, C>['GameView'],
  };
}
