interface Props {
  onClick: () => void
}

/** Share button. Video / PNG generation is wired up in the Share milestone. */
export default function ShareButton({ onClick }: Props) {
  return (
    <button onClick={onClick} className="cta w-full">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        <path d="M12 3v13" />
        <path d="m7 8 5-5 5 5" />
      </svg>
      Share my air
    </button>
  )
}
