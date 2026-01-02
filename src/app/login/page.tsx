'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LinkIcon, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [view, setView] = useState<'login' | 'forgot_password'>('login')
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw error
            router.push('/dashboard')
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid credentials')
        } finally {
            setIsLoading(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/dashboard/reset-password`,
            })
            if (error) throw error
            setSuccessMessage('Check your email for the password reset link.')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send reset email')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <Link href="/" className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                        <LinkIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">WiseURL</span>
                </Link>

                {/* Card */}
                <div className="card bg-white/5 border-white/10 p-8 backdrop-blur-lg">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {view === 'login' ? 'Admin Login' : 'Reset Password'}
                        </h1>
                        <p className="text-gray-400">
                            {view === 'login'
                                ? 'Sign in to manage your links'
                                : 'Enter your email to receive a reset link'}
                        </p>
                    </div>

                    <form onSubmit={view === 'login' ? handleLogin : handleResetPassword} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                                {successMessage}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                                    placeholder="admin@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {view === 'login' && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-300">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setView('forgot_password')
                                            setError('')
                                            setSuccessMessage('')
                                        }}
                                        className="text-sm text-primary hover:text-primary-400 transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary w-full py-3 text-base"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {view === 'login' ? 'Sign In' : 'Send Reset Link'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        {view === 'forgot_password' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setView('login')
                                    setError('')
                                    setSuccessMessage('')
                                }}
                                className="w-full text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Back to Login
                            </button>
                        )}
                    </form>
                </div>
            </div>

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
