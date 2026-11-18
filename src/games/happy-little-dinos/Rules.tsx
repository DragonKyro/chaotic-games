// Happy Little Dinosaurs — in-app Rules & Card Reference (Base + all 4 Expansions).

import { HLD_DINO_DEFS, HLD_HAZARD_CARD_DEFS, HLD_MAIN_DECK_DEFS } from './cards';
import { HLD_EXPANSIONS } from './types';

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>
        Be the first Dinosaur to reach <strong>50 points</strong> on your Escape Route, OR be the{' '}
        <strong>last Dinosaur standing</strong>!
      </p>

      <h4>Round Structure</h4>
      <ol>
        <li>Draw up to 5 cards in hand (re-dealing if you hold no Point cards).</li>
        <li>Flip the top <strong>Disaster Card</strong> (Natural, Predatory, Emotional, or Meteor).</li>
        <li>Everyone simultaneously selects 1 <strong>Point Card (0–9)</strong> face-down and reveals it.</li>
        <li>Point card effects resolve from lowest value to highest value, followed by Scoring Instants.</li>
        <li>
          The player with the <strong>highest score</strong> advances on their Escape Route by their score. (In{' '}
          <strong>5–6 Player games</strong>, the top <strong>two</strong> highest-scoring players each collect points
          equal to their respective scores!) The player with the <strong>lowest score</strong> adds the Disaster card to
          their Disaster Area (ties for lowest go to Sudden Death).
        </li>
        <li>Every surviving player advances +1 space per Disaster card in their Disaster Area.</li>
      </ol>

      <h4>Elimination</h4>
      <p>
        If you ever collect <strong>3 Disasters of the same type</strong> OR <strong>3 Disasters of 3 different types</strong>{' '}
        (with Meteor counting as wild), you are eliminated!
      </p>

      <h4>Expansions ({HLD_EXPANSIONS.length})</h4>
      <ul>
        {HLD_EXPANSIONS.map((e) => (
          <li key={e.id}>
            <strong>{e.name}:</strong> {e.summary}
          </li>
        ))}
      </ul>

      <h4>Hazards Ahead — Hazard Cards ({HLD_HAZARD_CARD_DEFS.reduce((s, d) => s + d.count, 0)} cards)</h4>
      <p>
        Certain Disaster cards in <em>Hazards Ahead</em> instruct the victim to also draw a <strong>Hazard Card</strong>{' '}
        into their Hazard Area. Hazard cards apply a persistent penalty until removed by cards like{' '}
        <em>Molotov Crocktail</em>, <em>Suck Up</em>, <em>Caution Sign</em>, or <em>Detour</em>:
      </p>
      <ul>
        {HLD_HAZARD_CARD_DEFS.map((h) => (
          <li key={h.name}>
            <strong>{h.name} (×{h.count}):</strong> {h.text}
          </li>
        ))}
      </ul>

      <h4>Dinosaurs ({HLD_DINO_DEFS.length}) &amp; Base Main Deck ({HLD_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} cards)</h4>
      <ul>
        {HLD_DINO_DEFS.map((d) => (
          <li key={d.id}>
            <strong>{d.name}:</strong> {d.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
