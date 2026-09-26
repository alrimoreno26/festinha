// QR "de mentira" determinístico a partir do código Pix. No real, o Mercado Pago devolve
// `point_of_interaction.transaction_data.qr_code_base64`.

const SIZE = 25

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function isFinder(x: number, y: number) {
  const inBox = (bx: number, by: number) => x >= bx && x < bx + 7 && y >= by && y < by + 7
  return inBox(0, 0) || inBox(SIZE - 7, 0) || inBox(0, SIZE - 7)
}

export function FakePixQr({ code, className }: { code: string; className?: string }) {
  const rand = hash(code)
  const cells: [number, number][] = []
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) if (!isFinder(x, y) && rand() > 0.5) cells.push([x, y])

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#111" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#111" />
    </g>
  )

  return (
    <svg viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`} className={className} role="img" aria-label="QR code Pix (simulado)" shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={SIZE + 4} height={SIZE + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" />
      ))}
      {finder(0, 0)}
      {finder(SIZE - 7, 0)}
      {finder(0, SIZE - 7)}
    </svg>
  )
}
