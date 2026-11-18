// Casting Shadows — in-app Rules & Card Reference.

import { CS_CHARACTERS, CS_COMPANION_DEFS, CS_COUNTERSPELL_DEFS, CS_HEX_DEFS, CS_MAIN_DECK_DEFS } from './cards';

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>
        Explore the 7-Hex Map, gather Resources, collect Spells, transform into your Shadow Form, summon a Companion,
        and eliminate all rivals! Everyone starts at <strong>18 HP</strong>; last player standing wins.
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
          <strong>Protect</strong> to remove 1 Cursed Crystal, <strong>Refresh</strong> the face-up card on your Hex,{' '}
          <strong>Collect</strong> a Spell/Resource/Counterspell card into your Spell Book, or <strong>Cast</strong> a
          Spell in your Spell Book (once per Spell per turn).
        </li>
        <li>
          <strong>Phase 3 — Shadow Absorption:</strong> Absorb remaining Shadow Fragments into Shadow Energy. At 3
          Shadow Energy in Base Form, you may transform into <strong>Shadow Form</strong> and summon 1 Companion from
          the Companion Portal! Then take 1 DMG for each remaining Cursed Crystal.
        </li>
      </ol>

      <h4>Components</h4>
      <p>
        {CS_CHARACTERS.length} Characters, {CS_HEX_DEFS.length} Hex Tiles,{' '}
        {CS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} Main Deck cards,{' '}
        {CS_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0)} Counterspells, and{' '}
        {CS_COMPANION_DEFS.reduce((s, d) => s + d.count, 0)} Companions.
      </p>
    </div>
  );
}
