import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-3xl">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-accent underline">
        Back to the library
      </Link>
    </section>
  )
}
