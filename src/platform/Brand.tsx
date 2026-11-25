export function BlockMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path fill="#bae6fd" d="m3 10 15-8 19 6-15 9z" />
      <path fill="#38bdf8" d="m3 10 19 7v7l-11-4v5l8 3v6l-8-3v7l-8-3z" />
      <path fill="#0284c7" d="m22 17 15-9v7l-15 9zm-3 11 8-5v6l-8 5zm-8 3 5-3v7l-5 3z" />
    </svg>
  )
}
export function Brand() {
  return (
    <span className="hub-brand">
      <BlockMark />
      <span>
        FreshBlox<span className="brand-dot">.</span>
      </span>
    </span>
  )
}
