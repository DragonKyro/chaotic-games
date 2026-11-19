// Doomlings — in-app rules reference (Classic, 2nd edition, and the built
// expansions). Keep in sync with reducer.ts.

import { CLASSIC_AGES, CLASSIC_CATASTROPHES, CLASSIC_TRAITS } from './cards';
import { CASTLE_GLASS_AGES, CASTLE_GLASS_CATASTROPHES, CASTLE_GLASS_TRAITS } from './packs/castle-glass';
import { IMAGINARY_ENDS_AGES, IMAGINARY_ENDS_CATASTROPHES, IMAGINARY_ENDS_TRAITS } from './packs/imaginary-ends';
import { OVERLUSH_AGES, OVERLUSH_CATASTROPHES, OVERLUSH_MYSTERY_DRAW, OVERLUSH_TRAITS } from './packs/overlush';
import { DM_EXPANSIONS, dmExpansionLockedReason } from './types';

const TRAIT_CARDS = CLASSIC_TRAITS.reduce((n, t) => n + (t.copies ?? 1), 0);
const CG_DOMINANTS = CASTLE_GLASS_TRAITS.filter((t) => t.dominant).length;
const OV_DOMINANTS = OVERLUSH_TRAITS.filter((t) => t.dominant).length;
const IE_DOMINANTS = IMAGINARY_ENDS_TRAITS.filter((t) => t.dominant).length;

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
      <p>Castle Glass readings (its rules card covers only the classes):</p>
      <ul>
        <li>Its traits, Ages and Catastrophe are shuffled into the Classic decks before dealing.</li>
        <li>&ldquo;Play at any time&rdquo; (Conchomancy, Sea Glass, Sunny) is offered during your own turn — before you play your trait, and again right after you stabilize — and doesn&apos;t use up your turn.</li>
        <li>Castle Glass (the Age): you draw 2 even if you had fewer than 2 cards you were allowed to discard.</li>
        <li>Pearl: a dual-colour trait uses up both of its colours.</li>
        <li>Opulent, Pearl, Pip and Resplendent are &ldquo;when played&rdquo; effects, not Actions: they happen however the Dominant is played, and Age of Peace or Automimicry can&apos;t stop them.</li>
        <li>Age of Wonder&apos;s &ldquo;end your turn with exactly 4&rdquo; wins over Harboring&apos;s 6 (Ages outrank traits).</li>
        <li>Brainy&apos;s ban lasts for each opponent&apos;s next turn only, and only for plays during that turn.</li>
        <li>Class labels aren&apos;t effects, so AI Takeover&apos;s World&apos;s End doesn&apos;t remove a colorless trait&apos;s class.</li>
      </ul>
      <p>Overlush readings (its rulesheet covers only the setup):</p>
      <ul>
        <li>Plays made during an Age&apos;s effect (The Stranger, Backwoods Melodies, Age of Adventure) or at World&apos;s End don&apos;t open Parasitic / Pinchy windows.</li>
        <li>Star Tails&apos; &ldquo;no more drawing this turn&rdquo; lasts the rest of the round.</li>
        <li>King of the Jungle: if the highest face value is tied, nobody keeps their hand.</li>
        <li>Tragedy of the Commons: colorless cards aren&apos;t a colour you can keep.</li>
        <li>Woolly: if the top card is colorless, everyone discards their colorless cards.</li>
        <li>Psychedelic can restart an age only once, and the turn it interrupts isn&apos;t stabilized.</li>
        <li>Skimmer and Strange trigger on effectless traits you play during your own turn.</li>
        <li>Firebite steals only when played in its after-stabilizing window. Muse can&apos;t be saved when it&apos;s discarded on your own turn (&ldquo;Cannot be played on your turn&rdquo;).</li>
        <li>Scavenger: one choice per stabilize — draw from the discard pile (top first) or from the deck.</li>
        <li>Catastrophes that pass cards right skip a player whose Denial ignores them, as Mega Tsunami does.</li>
        <li>Patches returns a removed trait from wherever it went (another pile, a hand or the discard pile), unless a Dominant&apos;s effect removed it.</li>
        <li>Antennae and Compound Eyes still make you discard when you have no Action to borrow; like Inventive, no borrowed Action can be Inventive&apos;s or Painted Shell&apos;s.</li>
        <li>Spots: you play the revealed card into your own pile. Crackletown&apos;s colours are named and passed one player at a time.</li>
        <li>Opposable Thumbs keeps the copy for the rest of the game, including its &ldquo;when played&rdquo; effect.</li>
      </ul>
      <p>Imaginary Ends readings (its rules cards cover suppress only):</p>
      <ul>
        <li>Its traits, Ages and Catastrophes are shuffled into the Classic decks; &ldquo;friends&rdquo; means opponents.</li>
        <li>Suppress effects happen when the trait is played (they aren&apos;t Actions, so Age of Peace doesn&apos;t stop them). All the cards one effect suppresses go under the same trait, which you choose.</li>
        <li>Chemotroph enters your pile first, so it can be the trait it suppresses under. Remarkable&apos;s &ldquo;3 or fewer cards&rdquo; doesn&apos;t count Remarkable.</li>
        <li>Glitterstorm: you choose 1, 2 or 3; the cards are random. Age of Reverie&apos;s passes happen together.</li>
        <li>Mimsy: giving a colorless card suppresses your colorless cards. Scintillant counts a card that is both a Deepling and a Glitterling once.</li>
        <li>Too Much Pink at World&apos;s End: a colorless card turned up counts your colorless traits; a dual-colour one counts both colours.</li>
        <li>Awesome! scores your best 2 face values in hand; Feisty&apos;s draw happens as it is played.</li>
      </ul>

      <h4>Card pool</h4>
      <p>
        Classic 2nd edition: {CLASSIC_TRAITS.length} different traits ({TRAIT_CARDS} cards), {CLASSIC_AGES.length} Ages,{' '}
        {CLASSIC_CATASTROPHES.length} Catastrophes and The Birth of Life.
      </p>

      <h4>Expansion: Castle Glass</h4>
      <p>
        A bolster pack of {CASTLE_GLASS_TRAITS.length - CG_DOMINANTS} traits, {CG_DOMINANTS} Dominants,{' '}
        {CASTLE_GLASS_AGES.length} Ages ({CASTLE_GLASS_AGES.map((a) => a.name).join(', ')}) and{' '}
        {CASTLE_GLASS_CATASTROPHES.length} Catastrophe ({CASTLE_GLASS_CATASTROPHES.map((c) => c.name).join(', ')}), shuffled into the Classic decks.
      </p>
      <p>
        <strong>Classes.</strong> Many Castle Glass traits belong to a class — <strong>Shell</strong>, <strong>Coral</strong>{' '}
        or <strong>Fish</strong> — shown by the badge on the card (a blue ring = Curious, a gold ring = Exotic). At the end
        of the game, after Drop of Life bonuses, each class you have <strong>2 or more</strong> cards of scores extra:{' '}
        <strong>+1</strong> per class card, <strong>+2</strong> per Curious one, <strong>+3</strong> per Exotic one. A single
        card of a class scores nothing extra. Example: Shell + Curious Shell + Exotic Shell = +6.
      </p>
      <p>
        <strong>Still Water</strong> (Catastrophe, −2 Gene Pool): everyone draws 3, and nobody stabilizes at the end of their
        turn that round. At World&apos;s End: +8 if your Gene Pool is 1.
      </p>

      <h4>Expansion: Overlush</h4>
      <p>
        The Mystery Expansion collection: {OVERLUSH_TRAITS.length} traits ({OV_DOMINANTS} Dominants), {OVERLUSH_AGES.length} Ages and{' '}
        {OVERLUSH_CATASTROPHES.length} Catastrophes. As its rulesheet sets it up, each game shuffles them into four piles — basic
        traits, Dominants, Ages, Catastrophes — and adds {OVERLUSH_MYSTERY_DRAW.traits} traits, {OVERLUSH_MYSTERY_DRAW.dominants}{' '}
        Dominants, {OVERLUSH_MYSTERY_DRAW.ages} Ages and {OVERLUSH_MYSTERY_DRAW.catastrophes} Catastrophes to the Classic decks.
      </p>
      <ul>
        <li><strong>Reactions out of turn:</strong> Dart, Quills, Patches and Motion Dazzle answer a trait leaving your pile; Pinchy answers an opponent&apos;s play; Snap-Trap answers an opponent&apos;s 2nd trait in a turn; Sleepy answers a catastrophe; Procrastination is offered when the round ends; Elusive and Muse when they reach your hand or the discard pile.</li>
        <li><strong>Can&apos;t be played on your turn:</strong> Dart, Elusive, Muse and Super Sneaky.</li>
        <li><strong>On your turn, without using it:</strong> Lucky, Booster and Trippy can be played at any time; Nimble (from your hand) and Seedwing (from your pile) can be discarded for their effect.</li>
        <li><strong>After you stabilize:</strong> Firebite, Harrier, Illusory and Mimicry are offered with Late.</li>
        <li><strong>Age of Certainty</strong> flips the deck: the next card is face up for everyone. Epic takes both Dominant slots; Opposable Thumbs becomes an exact copy of your other Dominant.</li>
      </ul>

      <h4>Expansion: Imaginary Ends</h4>
      <p>
        The Deeplings, Glitterlings, Moonlings and Fuzelings: {IMAGINARY_ENDS_TRAITS.length} traits ({IE_DOMINANTS} Dominants),{' '}
        {IMAGINARY_ENDS_AGES.length} Ages and {IMAGINARY_ENDS_CATASTROPHES.length} Catastrophes, shuffled into the Classic decks.
      </p>
      <p>
        <strong>Suppress.</strong> A suppressed card goes face down under a trait in your pile (not under a Dominant; a Dominant
        in your pile can&apos;t be suppressed, one in your hand can). Suppressed cards aren&apos;t traits — no face value, no Drop
        of Life — but score <strong>+1 each</strong>. Effects can&apos;t touch them; if their trait leaves your pile, they go to the
        bottom of the deck. If a suppress effect can&apos;t be done, the trait is still played.
      </p>
      <p>The box&apos;s Magical Merchants (trinkets and merchant Ages) is a separate add-on and isn&apos;t available yet.</p>

      <h4>All published expansions</h4>
      <p>From the card data and rules in the sources. Only built packs can be switched on.</p>
      <ul>
        {DM_EXPANSIONS.map((exp) => {
          const locked = dmExpansionLockedReason(exp.id);
          return (
            <li key={exp.id}>
              <strong>{exp.name}</strong>{locked ? ' (locked)' : ''}: {exp.summary}
              {locked ? ` ${locked}` : ''}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
