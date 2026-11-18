import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function Modal({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current!,
      trigger = document.activeElement as HTMLElement | null
    el.showModal()
    return () => {
      el.close()
      trigger?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="fb-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="fb-dialog-inner">
        <button className="modal-close" onClick={onClose} aria-label={closeLabel}>
          <X size={18} />
        </button>
        {children}
      </div>
    </dialog>
  )
}
