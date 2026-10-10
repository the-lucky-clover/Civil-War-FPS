/**
 * BattleFlags — procedurally-drawn SVG battle flags for the faction select screen.
 *
 * UNION: the 35-star Stars and Stripes (West Virginia entered the Union in
 * June 1863, weeks before Gettysburg — 35 stars is the historically correct
 * count for the battle).
 *
 * CSA: the Army of Northern Virginia battle flag — red field, blue saltire
 * with white fimbriation, 13 white stars — the flag that actually flew at
 * Gettysburg.
 *
 * Both are pure SVG: crisp at any size, zero image assets, with a gentle
 * cloth-wave animation.
 */

/** Five-pointed star polygon points, centered at (cx, cy) with outer radius r. */
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.382;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

interface FlagProps {
  className?: string;
  /** Accessible label for screen readers. */
  label?: string;
}

export function UnionFlag({ className, label = 'Flag of the Union — 35 stars, 1863' }: FlagProps) {
  const W = 190;
  const H = 100;
  const stripeH = H / 13;
  const stripes = Array.from({ length: 13 }, (_, i) => i);
  // Canton spans 7 stripes high, 40% of the width.
  const cantonW = W * 0.4;
  const cantonH = stripeH * 7;
  // 35 stars: 5 rows of 7.
  const stars: Array<[number, number]> = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      stars.push([
        (cantonW / 7) * (col + 0.5),
        (cantonH / 5) * (row + 0.5),
      ]);
    }
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={label}
      style={{ transformOrigin: 'left center' }}
    >
      <g className="flag-wave">
        {stripes.map((i) => (
          <rect
            key={i}
            x={0}
            y={i * stripeH}
            width={W}
            height={stripeH + 0.5}
            fill={i % 2 === 0 ? '#B31942' : '#FFFFFF'}
          />
        ))}
        <rect x={0} y={0} width={cantonW} height={cantonH} fill="#0A3161" />
        {stars.map(([cx, cy], i) => (
          <polygon key={i} points={starPoints(cx, cy, 4.6)} fill="#FFFFFF" />
        ))}
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke="#00000055" strokeWidth={1} />
      </g>
    </svg>
  );
}

export function ConfederateBattleFlag({
  className,
  label = 'Confederate battle flag — Army of Northern Virginia',
}: FlagProps) {
  const W = 180;
  const H = 120;
  const cx = W / 2;
  const cy = H / 2;
  // Diagonal from corner to corner.
  const diagLen = Math.sqrt(W * W + H * H);
  const angle = (Math.atan2(H, W) * 180) / Math.PI;
  // 13 stars: one at the center, three along each arm of the saltire.
  const stars: Array<[number, number]> = [[cx, cy]];
  const armFractions = [0.22, 0.38, 0.54];
  for (const f of armFractions) {
    const dx = (W / 2) * f;
    const dy = (H / 2) * f;
    stars.push([cx + dx, cy + dy]);
    stars.push([cx - dx, cy - dy]);
    stars.push([cx + dx, cy - dy]);
    stars.push([cx - dx, cy + dy]);
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={label}
      style={{ transformOrigin: 'left center' }}
    >
      <g className="flag-wave">
        <rect x={0} y={0} width={W} height={H} fill="#A6192E" />
        {/* White fimbriation underlay, then the blue saltire */}
        <g transform={`translate(${cx} ${cy})`}>
          <g transform={`rotate(${angle})`}>
            <rect x={-diagLen / 2} y={-13} width={diagLen} height={26} fill="#FFFFFF" />
          </g>
          <g transform={`rotate(${-angle})`}>
            <rect x={-diagLen / 2} y={-13} width={diagLen} height={26} fill="#FFFFFF" />
          </g>
          <g transform={`rotate(${angle})`}>
            <rect x={-diagLen / 2} y={-8} width={diagLen} height={16} fill="#0A3161" />
          </g>
          <g transform={`rotate(${-angle})`}>
            <rect x={-diagLen / 2} y={-8} width={diagLen} height={16} fill="#0A3161" />
          </g>
        </g>
        {stars.map(([sx, sy], i) => (
          <polygon key={i} points={starPoints(sx, sy, 6)} fill="#FFFFFF" />
        ))}
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke="#00000055" strokeWidth={1} />
      </g>
    </svg>
  );
}
