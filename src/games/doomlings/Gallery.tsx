// Doomlings art sheet (?gallery=doomlings): a spread of trait specimens across
// colours and types, ages and catastrophes, the back, a species evolving, and
// every card of each built expansion.

import { classicAgeCards, classicTraitCards, packAgeCards, packTraitCards } from './cards';
import { GenePool, Species } from './art';
import { AgeCard, MiniTrait, TraitBackCard, TraitCard } from './TraitCard';
import type { DmTraitCard } from './types';

function sampleTraits(): DmTraitCard[] {
  const all = classicTraitCards();
  const seen = new Set<string>();
  const unique = all.filter((c) => (seen.has(c.kind) ? false : (seen.add(c.kind), true)));
  const pick: DmTraitCard[] = [];
  const take = (pred: (c: DmTraitCard) => boolean, n: number) => {
    for (const c of unique) {
      if (pick.length >= 60 || n <= 0) break;
      if (!pick.includes(c) && pred(c)) { pick.push(c); n--; }
    }
  };
  for (const col of ['red', 'blue', 'green', 'purple', 'colorless'] as const) take((c) => c.color === col && !c.secondaryColor && !c.dominant, 7);
  take((c) => c.dominant, 6);
  take((c) => !!c.compassStar, 4);
  take((c) => !!c.playWhen, 3);
  take((c) => !!c.isSwarm, 1);
  return pick;
}

export function Gallery() {
  const traits = sampleTraits();
  const { ages, catastrophes: cats, birthOfLife: birth } = classicAgeCards(1000);
  return (
    <div className="dm-gallery">
      <h3>Traits</h3>
      <div className="dm-gallery-row">
        {traits.map((c) => <TraitCard key={c.kind} card={c} size="md" inspect={false} />)}
        <TraitBackCard size="md" />
      </div>
      <div className="dm-gallery-row">
        {traits.slice(35, 40).map((c) => <TraitCard key={c.kind} card={c} size="lg" />)}
      </div>
      <div className="dm-gallery-row">
        {traits.slice(0, 18).map((c) => <MiniTrait key={c.kind} card={c} />)}
        <GenePool size={5} />
        <GenePool size={8} />
      </div>
      <h3>A species evolving</h3>
      <div className="dm-gallery-row">
        {[0, 1, 2, 4, 6, 8, 10, 12].map((n) => (
          <div key={n} className="dm-gallery-species">
            <Species traits={traits.slice(0, n).concat(n >= 6 ? [traits.find((t) => t.dominant)!] : [])} seedKey="gallery-seat" tint="#46e07f" size={130} />
            <span>{n} traits</span>
          </div>
        ))}
      </div>
      <div className="dm-gallery-row">
        {['ash', 'mabel', 'rook', 'juniper', 'ozzie', 'wren'].map((k, i) => (
          <Species key={k} traits={traits.slice(i * 7, i * 7 + 3 + i)} seedKey={k} tint="#38a6ff" size={110} />
        ))}
      </div>
      <h3>Ages</h3>
      <div className="dm-gallery-row">
        <AgeCard age={birth} />
        {ages.map((a) => <AgeCard key={a.id} age={a} />)}
      </div>
      <h3>Catastrophes</h3>
      <div className="dm-gallery-row">
        {cats.map((a) => <AgeCard key={a.id} age={a} />)}
      </div>
      <div className="dm-gallery-row">
        <AgeCard age={cats[0]!} wide />
        <AgeCard age={ages[2]!} wide />
      </div>
      <CastleGlass />
      <Overlush />
      <ImaginaryEnds />
    </div>
  );
}

function ImaginaryEnds() {
  const traits = packTraitCards('imaginary-ends', 4000);
  const { ages, catastrophes } = packAgeCards('imaginary-ends', 4200);
  const host = { ...traits.find((t) => t.kind === 'untold')!, under: traits.slice(0, 2) };
  return (
    <>
      <h3>Imaginary Ends</h3>
      <div className="dm-gallery-row">
        {traits.map((c) => <TraitCard key={c.id} card={c} size="md" inspect={false} />)}
      </div>
      <div className="dm-gallery-row">
        {['awesome', 'stygian', 'popplebelly', 'scintillant'].map((k) => <TraitCard key={k} card={traits.find((t) => t.kind === k)!} size="lg" />)}
        <TraitCard card={host} size="lg" />
        <MiniTrait card={host} />
      </div>
      <div className="dm-gallery-row">
        {[2, 5].map((n) => (
          <div key={n} className="dm-gallery-species">
            <Species traits={[{ ...host, under: traits.slice(0, n) }, ...traits.slice(10, 13)]} seedKey={`deep-${n}`} tint="#b56cff" size={130} />
            <span>{n} suppressed</span>
          </div>
        ))}
      </div>
      <div className="dm-gallery-row">
        {ages.map((a) => <AgeCard key={a.id} age={a} />)}
        {catastrophes.map((a) => <AgeCard key={a.id} age={a} />)}
      </div>
    </>
  );
}

function Overlush() {
  const traits = packTraitCards('overlush', 3000);
  const { ages, catastrophes } = packAgeCards('overlush', 3400);
  const doms = traits.filter((t) => t.dominant);
  const duals = traits.filter((t) => t.secondaryColor && !t.dominant);
  const sample = [...traits.filter((t) => !t.dominant && !t.secondaryColor).slice(0, 20), ...duals.slice(0, 6), ...doms.slice(0, 10)];
  return (
    <>
      <h3>Overlush</h3>
      <div className="dm-gallery-row">
        {sample.map((c) => <TraitCard key={c.id} card={c} size="md" inspect={false} />)}
      </div>
      <div className="dm-gallery-row">
        {['opposable-thumbs', 'patches', 'epic', 'sparkles', 'pinchy'].map((k) => <TraitCard key={k} card={traits.find((t) => t.kind === k)!} size="lg" />)}
      </div>
      <div className="dm-gallery-row">
        {ages.map((a) => <AgeCard key={a.id} age={a} />)}
      </div>
      <div className="dm-gallery-row">
        {catastrophes.map((a) => <AgeCard key={a.id} age={a} />)}
      </div>
    </>
  );
}

function CastleGlass() {
  const traits = packTraitCards('castle-glass', 2000);
  const { ages, catastrophes } = packAgeCards('castle-glass', 2100);
  const by = (k: string) => traits.find((t) => t.kind === k)!;
  return (
    <>
      <h3>Castle Glass</h3>
      <div className="dm-gallery-row">
        {traits.map((c) => <TraitCard key={c.kind} card={c} size="md" inspect={false} />)}
      </div>
      <div className="dm-gallery-row">
        {['keystone', 'buttery-fins', 'spiral-dome', 'thermal-tolerance', 'pearl'].map((k) => <TraitCard key={k} card={by(k)} size="lg" />)}
        {traits.slice(0, 8).map((c) => <MiniTrait key={c.kind} card={c} />)}
      </div>
      <div className="dm-gallery-row">
        {[3, 6, 9].map((n, i) => (
          <div key={n} className="dm-gallery-species">
            <Species traits={traits.filter((t) => !t.dominant).slice(i * 4, i * 4 + n)} seedKey={`tide-${n}`} tint="#4fd8e8" size={130} />
            <span>{n} Castle Glass traits</span>
          </div>
        ))}
      </div>
      <div className="dm-gallery-row">
        {ages.map((a) => <AgeCard key={a.id} age={a} />)}
        {catastrophes.map((a) => <AgeCard key={a.id} age={a} />)}
        <AgeCard age={ages[0]!} wide />
        <AgeCard age={catastrophes[0]!} wide />
      </div>
    </>
  );
}
