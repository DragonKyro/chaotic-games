// The shell discovers games by importing this registry. To add a new game:
//   1. Create src/games/<id>/ with module.ts exporting a GameModule
//   2. Add it below
// No code outside the new folder needs to change.
//
// Every game here is currently an OUTLINE — types and design notes only, with
// a reducer that throws. See src/games/_scaffold/ and each game's types.ts.
// Exploding Kittens is first in line for a real implementation.

import type { AnyGameModule } from '@/core/module';
import { explodingKittensModule } from './exploding-kittens/module';
import { unstableUnicornsModule } from './unstable-unicorns/module';
import { hereToSlayModule } from './here-to-slay/module';
import { castingShadowsModule } from './casting-shadows/module';
import { happyLittleDinosModule } from './happy-little-dinos/module';
import { doomlingsModule } from './doomlings/module';

export const GAMES: AnyGameModule[] = [
  explodingKittensModule as unknown as AnyGameModule,
  unstableUnicornsModule as unknown as AnyGameModule,
  hereToSlayModule as unknown as AnyGameModule,
  castingShadowsModule as unknown as AnyGameModule,
  happyLittleDinosModule as unknown as AnyGameModule,
  doomlingsModule as unknown as AnyGameModule,
];

export function getGameById(id: string): AnyGameModule | undefined {
  return GAMES.find((g) => g.id === id);
}
