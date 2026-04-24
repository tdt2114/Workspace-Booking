"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Mail, Lock, ArrowRight, User, AlertCircle, CheckCircle2, UserPlus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { getSafeRedirectTo } from "@/lib/auth-redirect"
import { Button } from "@/components/premium/ui/button"
import { Input } from "@/components/premium/ui/input"
import { cn } from "@/lib/utils"

type AuthMode = "sign-in" | "sign-up"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"))
  
  const [mode, setMode] = React.useState<AuthMode>("sign-in")
  const [email, setEmail] = React.useState("admin@demo.com")
  const [password, setPassword] = React.useState("password123")
  const [fullName, setFullName] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setIsSubmitting(false)
          return
        }

        setSuccess("Signed in successfully. Redirecting...")
        setTimeout(() => {
          router.push(redirectTo)
          router.refresh()
        }, 1000)
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          setIsSubmitting(false)
          return
        }

        if (data.session) {
          setSuccess("Account created and signed in. Redirecting...")
          setTimeout(() => {
            router.push(redirectTo)
            router.refresh()
          }, 1000)
        } else {
          setSuccess("Account created! Please check your email for confirmation.")
          setIsSubmitting(false)
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.")
      setIsSubmitting(false)
    }
  }

  const toggleMode = () => {
    setMode(prev => prev === "sign-in" ? "sign-up" : "sign-in")
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-6 font-inter overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-900/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-[1000px] grid lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left Side: Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block space-y-8"
        >
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Shield className="text-white" size={32} />
            </div>
            <div className="space-y-2">
              <h1 className="text-6xl font-black text-white tracking-tight leading-none">
                Workspace <br/>
                <span className="text-gradient">Executive</span>
              </h1>
              <p className="text-lg text-slate-400 max-w-sm leading-relaxed">
                Management for the modern executive. Clean, efficient, and exceptionally powerful.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <FeatureItem icon={<CheckCircle2 className="text-emerald-500" size={18} />} text="One-click workspace reservations" />
            <FeatureItem icon={<CheckCircle2 className="text-emerald-500" size={18} />} text="Real-time occupancy monitoring" />
            <FeatureItem icon={<CheckCircle2 className="text-emerald-500" size={18} />} text="Enterprise-grade security standards" />
          </div>
        </motion.div>

        {/* Right Side: Auth Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass-panel border-white/10 p-8 lg:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-30" />
            
            <div className="mb-10 flex flex-col items-center">
              <h2 className="text-3xl font-bold text-white tracking-tight">
                {mode === "sign-in" ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-slate-500 mt-2 text-center text-sm">
                {mode === "sign-in" 
                  ? "Enter your credentials to access your secure workspace." 
                  : "Join our premium network and start booking smarter."}
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <AnimatePresence mode="wait">
                {mode === "sign-up" && (
                  <motion.div 
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-slate-400 ml-1">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                      <Input 
                        placeholder="Nguyen Van A" 
                        className="pl-12 bg-white/5 border-white/10 h-14 rounded-2xl focus:border-primary-500 transition-all text-white"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={mode === "sign-up"}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                  <Input 
                    type="email" 
                    placeholder="admin@demo.com" 
                    className="pl-12 bg-white/5 border-white/10 h-14 rounded-2xl focus:border-primary-500 transition-all text-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-sm font-medium text-slate-400">Password</label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-12 bg-white/5 border-white/10 h-14 rounded-2xl focus:border-primary-500 transition-all text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm"
                  >
                    <AlertCircle size={18} />
                    <p>{error}</p>
                  </motion.div>
                )}
                {success && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm"
                  >
                    <CheckCircle2 size={18} />
                    <p>{success}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-lg shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98] group disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {mode === "sign-in" ? "Sign In" : "Register Now"}
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-xs"><span className="bg-[#12161D] px-4 text-slate-500 font-bold uppercase tracking-widest">Account Options</span></div>
              </div>
              
              <button 
                onClick={toggleMode}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
              >
                {mode === "sign-in" ? (
                  <>
                    <UserPlus size={18} />
                    Don't have an account? Register here
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    Already have an account? Sign in
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function FeatureItem({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-slate-300 text-sm font-medium">{text}</span>
    </div>
  )
}
