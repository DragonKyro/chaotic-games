// Doomlings — in-app Rules & Card Reference.

import { DM_AGE_DEFS, DM_CATASTROPHE_DEFS } from './cards';
import { DM_EXPANSIONS } from './types';

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>
        Score the most points before the <strong>3rd Catastrophe</strong> triggers <strong>World&apos;s End</strong>!
      </p>

      <h4>Setup &amp; Eras</h4>
      <p>
        Everyone starts with a <strong>Gene Pool of 5</strong> and 5 Trait cards. The Age Deck is built from 3 Era
        piles (each containing 3 random Ages and 1 random Catastrophe shuffled together), topped by{' '}
        <strong>The Birth of Life</strong> (13 Age/Catastrophe cards total).
      </p>

      <h4>Taking a Turn</h4>
      <ol>
        <li>Play 1 Trait from your hand into your Trait Pile (you may hold at most 2 Dominant ⭐ traits).</li>
        <li>Resolve the Trait&apos;s Action (unless the active Age disables Actions).</li>
        <li>
          <strong>Stabilize:</strong> Draw or discard until your hand size equals your current Gene Pool size (clamped
          between 1 and 8).
        </li>
      </ol>

      <h4>Scoring at World&apos;s End</h4>
      <p>
        When the 3rd Catastrophe flips, resolve all Trait <strong>World&apos;s End</strong> abilities in turn order,
        apply the 3rd Catastrophe&apos;s World&apos;s End effect, and sum your Trait face values +{' '}
        <strong>Drop of Life</strong> bonuses!
      </p>

      <h4>Card Pool &amp; Expansions</h4>
      <p>
        Includes The Birth of Life, {DM_AGE_DEFS.length} Ages, {DM_CATASTROPHE_DEFS.length} Catastrophes, 113 Traits
        (including 17 Dominants), and metadata for all {DM_EXPANSIONS.length} official expansions.
      </p>
    </div>
  );
}
