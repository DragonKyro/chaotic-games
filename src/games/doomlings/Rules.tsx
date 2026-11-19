// Doomlings — in-app rules reference (Classic, 2nd edition). Keep in sync with reducer.ts.

import { CLASSIC_AGES, CLASSIC_CATASTROPHES, CLASSIC_TRAITS } from './cards';
import { DM_EXPANSIONS } from './types';

const TRAIT_CARDS = CLASSIC_TRAITS.reduce((n, t) => n + (t.copies ?? 1), 0);

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>Score the most points by the end of the world — the 3rd Catastrophe.</p>

      <h4>Setup</h4>
      <p>
        The 25 Ages are shuffled and dealt into 3 piles of 3; each pile gets 1 random Catastrophe (of 15) and is
        shuffled on its own. The piles are stacked with <strong>The Birth of Life</strong> on top. Everyone&apos;s
        Gene Pool starts at <strong>5</strong> and everyone is dealt 5 traits ({TRAIT_CARDS} trait cards in all).
      </p>

      <h4>Rounds</h4>
      <p>
        The first player flips the next Age; everyone follows its effect <em>before</em> turns are taken, and the
        effect lasts that round only. Then each player takes a turn, clockwise.
      </p>

      <h4>Taking a turn</h4>
      <ol>
        <li>
          <strong>Play 1 trait</strong> from your hand into your trait pile. If you can play a trait, you must.
        </li>
        <li>
          Resolve its effect. An <strong>Action</strong> only happens when the trait is played straight from your hand
          (not when it is stolen, swapped or played from the discard pile, unless a card says so), and if you can do it,
          you must.
        </li>
        <li>
          <strong>Stabilize</strong> to end your turn: draw or discard until your hand equals your Gene Pool.
        </li>
      </ol>
      <p>
        If you can&apos;t play a trait, your turn is skipped and you don&apos;t stabilize: with an empty hand you draw 5;
        otherwise you may discard your whole hand and draw 3.
      </p>

      <h4>Gene Pool</h4>
      <p>
        Your Gene Pool changes only your stabilize size — you don&apos;t draw or discard when it changes. It can&apos;t go
        above 8 or below 1: an effect that would push it past is ignored. But when a trait leaves your pile, its Gene Pool
        change is always reversed.
      </p>

      <h4>Dominant traits</h4>
      <p>
        You may play only 2. Once played they can&apos;t be swapped, stolen, discarded or otherwise removed. (Birth of a
        Hero can give you a 3rd: Heroic. A 3rd Dominant drawn at random is discarded.)
      </p>

      <h4>Out-of-turn traits</h4>
      <ul>
        <li><strong>Automimicry / Chromatophores</strong>: when an Action is about to happen, anyone holding one is asked whether to play it to stop that Action.</li>
        <li><strong>Parasitic</strong>: when an opponent plays a trait, you are asked whether to play Parasitic to steal it and stop its Action.</li>
        <li><strong>Self-Awareness</strong>: you may slip it into an opponent&apos;s pile during your own turn; that doesn&apos;t use up your turn.</li>
        <li><strong>Late</strong>: offered right after you stabilize. <strong>Sneaky</strong>: offered at World&apos;s End.</li>
      </ul>

      <h4>Catastrophes</h4>
      <p>
        When a Catastrophe is flipped the first player moves one seat to the left. Everyone applies its Gene Pool change
        (permanently), then its Catastrophic effect, and the round is played as normal. Its gold World&apos;s End effect
        is ignored — until the 3rd Catastrophe.
      </p>

      <h4>World&apos;s End</h4>
      <ol>
        <li>The 3rd Catastrophe&apos;s Gene Pool and Catastrophic effects happen as usual. No more turns are taken.</li>
        <li>In turn order, each player resolves the World&apos;s End effects of their traits (choosing their order).</li>
        <li>The final Catastrophe&apos;s World&apos;s End effect resolves (Prepper can swap it for an earlier one).</li>
        <li>Score: face values (compass stars ★ count as 0) + Drop of Life bonuses + World&apos;s End points.</li>
      </ol>
      <p>
        <strong>Ties:</strong> each tied player draws a trait from the deck and adds its face value.
      </p>

      <h4>Readings we had to choose</h4>
      <p>The rulesheet doesn&apos;t settle these; this is what the game does.</p>
      <ul>
        <li>If players are still tied after the tie-break draw, they share the win.</li>
        <li>Denial ignores the next catastrophe&apos;s Gene Pool and Catastrophic effects (not a final World&apos;s End effect). If that catastrophe is The Four Horsemen, Denial is used up anyway.</li>
        <li>A card stolen by Clever or Nosy lands in your hand and is played from there, so its Action happens. If it can&apos;t be played, it stays in your hand.</li>
        <li>Endurance and Regenerative Tissue trigger on any discard from your pile, even when an opponent&apos;s effect chooses it.</li>
        <li>Inventive and Painted Shell can&apos;t borrow each other&apos;s Actions (that could loop forever).</li>
        <li>Telekinetic / Tentacles compare colours; colorless traits have no colour, so they can&apos;t be swapped by either.</li>
        <li>Self-Awareness &ldquo;at any time&rdquo; is offered during your own turn only; reaction cards played out of turn don&apos;t open new reaction windows.</li>
        <li>Galactic Drift / High Tides: each extra colorless / effectless trait you play lets you play another.</li>
      </ul>

      <h4>Card pool</h4>
      <p>
        Classic 2nd edition: {CLASSIC_TRAITS.length} different traits ({TRAIT_CARDS} cards), {CLASSIC_AGES.length} Ages,{' '}
        {CLASSIC_CATASTROPHES.length} Catastrophes and The Birth of Life.
      </p>

      <h4>Expansions</h4>
      <p>Not available yet. The published expansions are:</p>
      <ul>
        {DM_EXPANSIONS.map((exp) => (
          <li key={exp.id}>
            <strong>{exp.name}:</strong> {exp.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}
