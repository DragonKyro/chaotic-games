// Casting Shadows — in-app Rules & Card Reference.

import {
  CS_CHARACTERS,
  CS_COMPANION_DEFS,
  CS_COUNTERSPELL_DEFS,
  CS_HEX_DEFS,
  CS_ICE_STORM_CHARACTERS,
  CS_ICE_STORM_COMPANION_DEFS,
  CS_ICE_STORM_COUNTERSPELL_DEFS,
  CS_ICE_STORM_HEX_DEFS,
  CS_ICE_STORM_MAIN_DECK_DEFS,
  CS_MAIN_DECK_DEFS,
  CS_MOLTEN_ROCK_CHARACTERS,
  CS_MOLTEN_ROCK_COMPANION_DEFS,
  CS_MOLTEN_ROCK_COUNTERSPELL_DEFS,
  CS_MOLTEN_ROCK_HEX_DEFS,
  CS_MOLTEN_ROCK_MAIN_DECK_DEFS,
} from './cards';

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>
        Explore the Hex World Map, gather Resources, collect Spells, transform into your Shadow Form, summon a Companion,
        and eliminate all rivals! Everyone starts at <strong>18 HP</strong>; last player standing wins (2–4 players in
        Base Game, up to 6 players with The Ice Storm or The Molten Rock expansion).
      </p>

      <h4>3-Phase Turn Structure</h4>
      <ol>
        <li>
          <strong>Phase 1 — Resource Roll:</strong> Roll the 5 Resource Dice (2 Red, 2 Blue, 1 Purple/Shadow) and add
          any start-of-turn Resource tokens from your current Hex tile and Resource cards in your Spell Book.
        </li>
        <li>
          <strong>Phase 2 — Action Phase (4 AP, or 5 AP if started on Ancient Rune):</strong> Spend 1 AP each to{' '}
          <strong>Travel</strong> to an adjacent Hex, <strong>Reroll</strong> any non-Cursed dice,{' '}
          <strong>Protect</strong> to remove 1 Cursed Crystal (or extinguish Burn / break Freeze),{' '}
          <strong>Refresh</strong> the face-up card on your Hex,{' '}
          <strong>Collect</strong> a Spell/Resource/Counterspell card into your Spell Book, or <strong>Cast</strong> a
          Spell in your Spell Book (once per Spell per turn).
        </li>
        <li>
          <strong>Phase 3 — Shadow Absorption:</strong> Absorb remaining Shadow Fragments into Shadow Energy. At 3
          Shadow Energy in Base Form, you may transform into <strong>Shadow Form</strong> and summon 1 Companion from
          the Companion Portal! Then take 1 DMG for each remaining Cursed Crystal (and 1 DMG if Burning).
        </li>
      </ol>

      <h4>Expansion Status Effects</h4>
      <ul>
        <li>
          <strong>💫 Stunned (stunned):</strong> A Stunned player starts their turn with <strong>1 fewer Action Point (-1 AP)</strong>,
          then clears Stun.
        </li>
        <li>
          <strong>❄️ Frozen (frozen):</strong> A Frozen player <strong>cannot use the Travel action</strong> during their
          turn unless they spend 1 AP to break the ice / unfreeze. Frozen automatically clears at the end of their turn.
        </li>
        <li>
          <strong>🛡️ Fortified (fortified):</strong> Fortify shield tokens reduce the next incoming DMG from an enemy by
          your Fortify amount (unless on Crystal Crypt or unreducible), consuming the Fortify shield.
        </li>
        <li>
          <strong>🔥 Burning (burning):</strong> At the end of a Burning player&apos;s turn (Phase 3), they take{' '}
          <strong>1 DMG</strong> from Burn, then clear Burn (or they may spend 1 AP during Phase 2 to Protect/extinguish Burn).
        </li>
      </ul>

      <h4>Expansions &amp; Components</h4>
      <ul>
        <li>
          <strong>Base Game:</strong> {CS_CHARACTERS.length} Characters, {CS_HEX_DEFS.length} Hex Tiles,{' '}
          {CS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} Main Deck cards,{' '}
          {CS_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0)} Counterspells, and{' '}
          {CS_COMPANION_DEFS.reduce((s, d) => s + d.count, 0)} Companions.
        </li>
        <li>
          <strong>The Ice Storm Expansion:</strong> +{CS_ICE_STORM_CHARACTERS.length} Characters (Talon Lightfeather, Nyx Frostpaw),{' '}
          +{CS_ICE_STORM_HEX_DEFS.length} Hex Tiles (Floating Temple, Glimmering Woods),{' '}
          +{CS_ICE_STORM_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} Main Deck cards,{' '}
          +{CS_ICE_STORM_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0)} Counterspells, and{' '}
          +{CS_ICE_STORM_COMPANION_DEFS.reduce((s, d) => s + d.count, 0)} Companions.
        </li>
        <li>
          <strong>The Molten Rock Expansion:</strong> +{CS_MOLTEN_ROCK_CHARACTERS.length} Characters (Dread Terrashell, Pyra Ashwing),{' '}
          +{CS_MOLTEN_ROCK_HEX_DEFS.length} Hex Tiles (Cobble Cove, Molten Quarry),{' '}
          +{CS_MOLTEN_ROCK_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} Main Deck cards,{' '}
          +{CS_MOLTEN_ROCK_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0)} Counterspells, and{' '}
          +{CS_MOLTEN_ROCK_COMPANION_DEFS.reduce((s, d) => s + d.count, 0)} Companions.
        </li>
      </ul>
    </div>
  );
}
