import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

/** Bottom sheet that slides up over the screen. Tap the backdrop to dismiss. */
export default function Sheet({ open, onClose, label, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="pointer-events-auto fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={label}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-3xl border-t border-white/10 bg-[#1a1a19]/95 pb-[env(safe-area-inset-bottom)] text-left backdrop-blur"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-white/20" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
