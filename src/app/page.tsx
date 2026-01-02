import Link from 'next/link'
import { LinkIcon, Github } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <LinkIcon className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-bold text-white">WiseURL</span>
        </div>

        <p className="text-gray-400 mb-8 max-w-md">
          Open source link manager with analytics.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/login" className="btn btn-primary px-8 py-3">
            Sign In
          </Link>
          <Link
            href="https://github.com"
            target="_blank"
            className="btn btn-ghost text-gray-400 hover:text-white px-8 py-3"
          >
            <Github className="w-5 h-5" />
            GitHub
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center">
        <p className="text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} Crafted by{' '}
          <a
            href="https://www.couponswift.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            CouponSwift
          </a>
        </p>
      </div>
    </div>
  )
}
