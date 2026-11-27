import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/** Labelled text input with an optional error message, sized for touch. */
export function Field({ label, error, ...input }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-md border border-line bg-transparent px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 aria-invalid:border-red-600"
        {...input}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-paper hover:opacity-90'
      : 'border border-line hover:bg-line/60'
  return (
    <button
      className={`min-h-11 rounded-md px-4 text-sm font-medium transition disabled:opacity-50 ${styles}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-800 dark:text-red-300"
    >
      {children}
    </p>
  )
}
