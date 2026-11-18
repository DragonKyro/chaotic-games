// Doomlings — in-app Rules & Expansion Reference.

import {
  DM_AGE_DEFS,
  DM_CATASTROPHE_DEFS,
  DM_EXPANSION_AGE_DEFS,
  DM_EXPANSION_CATASTROPHE_DEFS,
  DM_EXPANSION_TRAIT_SEEDS,
  DM_OBJECTIVE_DEFS,
} from './cards';
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

      <h4>Expansion Mechanics</h4>
      <ul>
        <li>
          <strong>Multi-Color Traits:</strong> Dual-color traits (e.g., Red/Green, Blue/Purple) count as{' '}
          <em>both</em> of their colors for play requirements, Drop of Life bonuses, Age restrictions, and Catastrophe
          effects.
        </li>
        <li>
          <strong>Attachments (📎):</strong> Traits like <em>Parasitic Tendrils</em>, <em>Symbiotic Coat</em>,{' '}
          <em>Cybernetic Implant</em>, and <em>Golden Crown</em> attach to a non-Dominant host trait in your Trait Pile,
          boosting your score, Gene Pool, or granting <strong>Indestructible (🛡️)</strong> to the host. If the host
          leaves your Trait Pile, its attachment is discarded with it!
        </li>
        <li>
          <strong>Suppress:</strong> Tucks a card face-down from your hand or Trait Pile into your Suppressed pile.
          Each Suppressed card is worth <strong>+1 point</strong> at World&apos;s End (and +2 more per card with
          Suppress-synergy traits like <em>Chronos Weaver</em>, <em>Fate Binder</em>, and <em>Umbral Echo</em>).
        </li>
        <li>
          <strong>Swarm &amp; Kidney Multiplication (🐝):</strong> Self-multiplying traits like <em>Kidney</em> and{' '}
          <em>Mokoko Sprout</em> score per copy in your own Trait Pile, while <em>Swarm</em>, <em>Mokoko Villager</em>,
          and <em>Mokoko Elder</em> score for every Swarm trait across <em>all</em> players&apos; Trait Piles!
        </li>
        <li>
          <strong>Meaning of Life &amp; Treasure Objectives (✨ / 🏆):</strong> When <em>Imaginary Ends</em> or{' '}
          <em>Legends of Enderas</em> is enabled, each player receives a personal objective card that awards{' '}
          <strong>+4 to +6 bonus points</strong> at World&apos;s End if its condition is fulfilled.
        </li>
      </ul>

      <h4>Scoring at World&apos;s End</h4>
      <p>
        When the 3rd Catastrophe flips, resolve all Trait <strong>World&apos;s End</strong> abilities in turn order,
        apply the 3rd Catastrophe&apos;s World&apos;s End effect, add Suppressed card points and fulfilled Objective
        bonuses, and sum your Trait face values + <strong>Drop of Life</strong> bonuses!
      </p>

      <h4>Official Expansions ({DM_EXPANSIONS.length})</h4>
      <ul>
        {DM_EXPANSIONS.map((exp) => (
          <li key={exp.id}>
            <strong>{exp.name}:</strong> {exp.summary}
          </li>
        ))}
      </ul>

      <h4>Card Pool Summary</h4>
      <p>
        Includes The Birth of Life, {DM_AGE_DEFS.length} Base Ages + {DM_EXPANSION_AGE_DEFS.length} Expansion Ages,{' '}
        {DM_CATASTROPHE_DEFS.length} Base Catastrophes + {DM_EXPANSION_CATASTROPHE_DEFS.length} Expansion Catastrophes,
        113 Base Traits + {DM_EXPANSION_TRAIT_SEEDS.length} unique Expansion Trait types, and{' '}
        {DM_OBJECTIVE_DEFS.length} Meaning of Life / Treasure Objectives.
      </p>
    </div>
  );
}
