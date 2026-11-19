// The game-view kit: layout, player plates, the decision dock, a hand fan,
// the log, FX, game over, and small parts. Game-agnostic — every game's
// ui.tsx builds on it and themes it with the --cg-* variables in kit.css.

import './kit.css';

export { GameTable, PlayerStrip, PlayerPlate, Chip, Panel } from './Table';
export { Dock, type DockTone } from './Dock';
export { CardFan } from './CardFan';
export { CardShell } from './CardShell';
export { GameLog } from './GameLog';
export { useFx, FxLayer, TurnCue, type Fx, type FxTone } from './Fx';
export { GameOverPanel } from './GameOver';
export { ExpansionPicker, Die, Tally, Inspect } from './Bits';
export { useSvgIds, useChangeKey, usePulse, type SvgIds } from './hooks';
