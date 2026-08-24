import type { SVGProps } from "react"

/**
 * The illustrations for empty states: simple, flat, drawn in theme ink so
 * they hold in light and dark alike (Astryx's illustration guidance). Each is
 * decorative — EmptyState renders its icon slot aria-hidden — and sized for
 * the 120–240px band the guidelines name.
 *
 * Ghosts of the real thing, deliberately: an empty library shows the shape
 * of the clip cards that will fill it, an empty account list the rows.
 */

const stroke = "currentColor"

/** Stacked ghost clip-cards, for empty libraries and rooms. */
export function GhostCards(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden width={160} height={120} {...props}>
      <g opacity={0.14}>
        <rect x="30" y="10" width="100" height="64" rx="8" stroke={stroke} strokeWidth="2" />
      </g>
      <g opacity={0.28}>
        <rect x="22" y="20" width="116" height="72" rx="8" stroke={stroke} strokeWidth="2" />
      </g>
      <g opacity={0.6}>
        <rect x="14" y="32" width="132" height="78" rx="10" stroke={stroke} strokeWidth="2.4" />
        <path d="M72 62.5v17.4c0 1.2 1.3 1.9 2.3 1.3l14.6-8.7a1.5 1.5 0 0 0 0-2.6l-14.6-8.7c-1-.6-2.3.1-2.3 1.3Z" fill={stroke} opacity={0.8} />
        <rect x="26" y="96" width="56" height="5" rx="2.5" fill={stroke} opacity={0.5} />
        <rect x="26" y="88" width="88" height="5" rx="2.5" fill={stroke} opacity={0.7} />
      </g>
    </svg>
  )
}

/** Ghost account rows, for the empty connected-accounts list. */
export function GhostRows(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden width={160} height={120} {...props}>
      <g opacity={0.6}>
        <rect x="14" y="16" width="132" height="26" rx="8" stroke={stroke} strokeWidth="2.4" />
        <circle cx="30" cy="29" r="7" fill={stroke} opacity={0.5} />
        <rect x="44" y="26" width="60" height="6" rx="3" fill={stroke} opacity={0.7} />
      </g>
      <g opacity={0.35}>
        <rect x="14" y="50" width="132" height="26" rx="8" stroke={stroke} strokeWidth="2" />
        <circle cx="30" cy="63" r="7" fill={stroke} opacity={0.5} />
        <rect x="44" y="60" width="44" height="6" rx="3" fill={stroke} opacity={0.7} />
      </g>
      <g opacity={0.16}>
        <rect x="14" y="84" width="132" height="26" rx="8" stroke={stroke} strokeWidth="2" />
        <circle cx="30" cy="97" r="7" fill={stroke} opacity={0.5} />
        <rect x="44" y="94" width="72" height="6" rx="3" fill={stroke} opacity={0.7} />
      </g>
    </svg>
  )
}

/** Ghost shared room — two card stacks side by side, for no shared workspaces. */
export function GhostRoom(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden width={160} height={120} {...props}>
      <g opacity={0.3}>
        <rect x="10" y="30" width="64" height="46" rx="8" stroke={stroke} strokeWidth="2" />
        <rect x="18" y="82" width="40" height="5" rx="2.5" fill={stroke} opacity={0.6} />
      </g>
      <g opacity={0.6}>
        <rect x="60" y="18" width="88" height="60" rx="10" stroke={stroke} strokeWidth="2.4" />
        <rect x="70" y="86" width="56" height="5" rx="2.5" fill={stroke} opacity={0.7} />
        <circle cx="120" cy="102" r="8" stroke={stroke} strokeWidth="2" opacity={0.7} />
        <circle cx="104" cy="102" r="8" stroke={stroke} strokeWidth="2" opacity={0.5} />
        <circle cx="88" cy="102" r="8" stroke={stroke} strokeWidth="2" opacity={0.35} />
      </g>
    </svg>
  )
}
