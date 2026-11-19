// Every card face plus the back, for art reviews (?gallery=exploding-kittens).

import { Card, FaceDownCard } from './Card';
import { CARD_LABEL } from './cards';
import type { EkBaseCardKind } from './types';

export function Gallery() {
  const kinds = Object.keys(CARD_LABEL) as EkBaseCardKind[];
  return (
    <div className="ek-gallery">
      {kinds.map((k) => <Card key={k} kind={k} size="lg" />)}
      <FaceDownCard size="lg" />
    </div>
  );
}
