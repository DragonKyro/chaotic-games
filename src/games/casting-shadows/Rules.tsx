// Casting Shadows — in-app Rules & Card Reference (kept in step with reducer.ts).

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

const count = (defs: readonly { count: number }[]) => defs.reduce((s, d) => s + d.count, 0);

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>
        Explore the map, gather Resources, collect Spells, transform into your Shadow Form, summon a Companion, and
        eliminate every rival. Everyone starts at <strong>18 HP</strong>; reach 0 and you are out (your Spell Book is
        discarded). The last player standing wins. 2–4 players with the base game; 5–6 players need The Ice Storm or
        The Molten Rock for the 10-tile map.
      </p>

      <h4>The map</h4>
      <p>
        Dusty Desert, the Ancient Rune and the Underground Volcano run across the middle; each player&apos;s Home Hex tile
        sits in their seat&apos;s spot (spare spots take the remaining tiles), and everyone starts on their Home Hex. A
        face-up card from the Main deck sits beside every tile except the Ancient Rune and Dusty Desert (on the 10-tile
        map, only beside the tiles on the left and right edges).
      </p>

      <h4>Your turn</h4>
      <ol>
        <li>
          <strong>Resource Roll:</strong> roll the 5 Resource dice (2 red, 2 blue, 1 purple). Purple Gems and Orbs count
          as red <em>or</em> blue. If you start on a tile that grants a token, add it. The Ancient Rune heals you 2 HP.
        </li>
        <li>
          <strong>Action Phase — 4 Action points</strong> (5 with Hydrattle Snake), 1 each, in any order and as often as
          you like:
          <ul>
            <li><strong>Travel</strong> to an adjacent Hex tile (Speed Mouster: up to two).</li>
            <li><strong>Cast</strong> a Spell in your Spell Book — pay its Resources; each Spell once per turn. &quot;Spend up to N&quot; spells let you choose how much to pour in.</li>
            <li><strong>Reroll</strong> any of your dice except Cursed Crystals (Cursemaster Raccoon: those too).</li>
            <li><strong>Protect</strong>: remove 1 Cursed Crystal from your pool (Swamp Monster: any number).</li>
            <li><strong>Refresh</strong> the card beside your tile (not on the Ancient Rune or Dusty Desert).</li>
            <li><strong>Collect</strong> the card beside your tile by paying its Collection Cost — or a Counterspell at Dusty Desert for 1 Gem + 1 Orb. Nothing can be collected on the Ancient Rune.</li>
          </ul>
          Your Shadow Ability and Resource cards cost no Action point.
        </li>
        <li>
          <strong>Shadow Absorption:</strong> leftover Shadow Fragments become Shadow Energy (Base Form holds 3, Shadow Form
          5). With 3 in Base Form you <em>may</em> transform: flip to Shadow Form, energy back to 0, and summon a Companion
          from the portal. Then take 1 DMG per Cursed Crystal left in your pool, and your pool empties.
        </li>
      </ol>

      <h4>Spell Book</h4>
      <p>
        At most 5 cards (your Companion doesn&apos;t count). Collecting into a full book means discarding a Spell or
        Resource card of your choice — never a Counterspell. Level 2 and 3 Spells also cost a lower Spell from your book:
        a Level 1 (for Level 2) or Level 2 (for Level 3) Attack or Conversion Spell, which you choose. Resource cards are
        collected for no Resources; discard one at any time on your turn for its token.
      </p>

      <h4>Range</h4>
      <p>
        Each Attack Spell shows its range: your Hex tile only; adjacent tiles only; yours or adjacent; yours and up to 2
        tiles away; or 1–2 tiles away but not yours. &quot;An enemy in range&quot; hits one enemy; &quot;a Hex tile in
        range&quot; hits every enemy on that tile.
      </p>

      <h4>Counterspells</h4>
      <p>
        Kept face down. Reveal one when its trigger happens — the base game&apos;s all answer &quot;when an enemy deals DMG
        to you with an Attack Spell&quot;. One per trigger; if several players answer the same spell, they resolve in turn
        order from the next player. A used Counterspell goes to the bottom of its deck. You are only asked when you hold
        one, and your options stay hidden from everyone else.
      </p>

      <h4>Shadow Abilities</h4>
      <p>
        In Shadow Form your Character&apos;s Ability is used in the Action Phase for no Action point — but only with a
        fully charged tracker (5 Shadow Energy); it then spends the board&apos;s cost.
      </p>
      <ul>
        {[...CS_CHARACTERS, ...CS_ICE_STORM_CHARACTERS, ...CS_MOLTEN_ROCK_CHARACTERS].map((c) => (
          <li key={c.id}>
            <strong>{c.shadowName}</strong>: {c.shadowAbilityText}
          </li>
        ))}
      </ul>

      <h4>Hex tiles</h4>
      <ul>
        {[...CS_HEX_DEFS, ...CS_ICE_STORM_HEX_DEFS, ...CS_MOLTEN_ROCK_HEX_DEFS].map((h) => (
          <li key={h.id}>
            <strong>{h.name}</strong>{h.expansion ? ` (${h.expansion === 'ice-storm' ? 'The Ice Storm' : 'The Molten Rock'})` : ''}: {h.effectText}
          </li>
        ))}
      </ul>

      <h4>The Ice Storm — status effects</h4>
      <ul>
        <li>
          <strong>Frozen:</strong> you cannot Travel. Frozen during your own turn, you can&apos;t spend your remaining
          Action points on Travel. If you started your turn Frozen, the token comes off at the end of that turn.
        </li>
        <li>
          <strong>Stunned:</strong> you roll only 4 Resource dice (you pick the one to leave out). Stunned during your own
          turn, the player who did it may remove one Resource from your pool. If you started your turn Stunned, the token
          comes off at the end of that turn.
        </li>
        <li>You can only carry one Freeze and one Stun token at a time.</li>
      </ul>

      <h4>What this build has not confirmed</h4>
      <p>
        Frill the Regenerator&apos;s ability, and the base cards Magma Hand, Sapphire Synthesis, the Blue Orb resource and
        Sharp Hedge, have no surviving card text; the faces of the Resource dice are only partly visible in the rulebook.
        The expansions&apos; hex tiles, Characters&apos; names and the Ice Storm status rules are official, but their decks,
        Frost&apos;s, Dread&apos;s and Ashe&apos;s abilities, and the Molten Rock&apos;s Burn / Fortify shield are this
        app&apos;s own reconstruction — not the printed cards. Cobble Cove&apos;s Fortify and Fiery Meadows&apos; Scorch are
        not modeled.
      </p>

      <h4>Components</h4>
      <ul>
        <li>
          <strong>Base game:</strong> {CS_CHARACTERS.length} Characters, {CS_HEX_DEFS.length} Hex Tiles,{' '}
          {count(CS_MAIN_DECK_DEFS)} Main Deck cards, {count(CS_COUNTERSPELL_DEFS)} Counterspells,{' '}
          {count(CS_COMPANION_DEFS)} Companions.
        </li>
        <li>
          <strong>The Ice Storm:</strong> +{CS_ICE_STORM_CHARACTERS.length} Characters, +{CS_ICE_STORM_HEX_DEFS.length} Hex
          Tiles, +{count(CS_ICE_STORM_MAIN_DECK_DEFS)} Main Deck cards, +{count(CS_ICE_STORM_COUNTERSPELL_DEFS)}{' '}
          Counterspells, +{count(CS_ICE_STORM_COMPANION_DEFS)} Companions (reconstructed deck).
        </li>
        <li>
          <strong>The Molten Rock:</strong> +{CS_MOLTEN_ROCK_CHARACTERS.length} Characters, +{CS_MOLTEN_ROCK_HEX_DEFS.length}{' '}
          Hex Tiles, +{count(CS_MOLTEN_ROCK_MAIN_DECK_DEFS)} Main Deck cards, +{count(CS_MOLTEN_ROCK_COUNTERSPELL_DEFS)}{' '}
          Counterspells, +{count(CS_MOLTEN_ROCK_COMPANION_DEFS)} Companions (reconstructed deck).
        </li>
      </ul>
    </div>
  );
}
