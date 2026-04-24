"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { Phone, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AppUser {
  name: string
  phone: string
  expiresAt: number
}

interface PhoneLoginContextType {
  user: AppUser | null
}

const PhoneLoginContext = createContext<PhoneLoginContextType>({ user: null })

export function usePhoneLogin() {
  return useContext(PhoneLoginContext)
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function PhoneLoginProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<AppUser | null>(null)
  
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [knownName, setKnownName] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem("appUser")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          setUser(parsed)
        } else {
          localStorage.removeItem("appUser")
        }
      } catch (err) {
        localStorage.removeItem("appUser")
      }
    }
    setMounted(true)
  }, [])

  const loginUser = (phoneNum: string, userName: string) => {
    const plainPhone = phoneNum.replace(/\D/g, "")
    const newUser: AppUser = {
      name: userName.trim(),
      phone: phoneNum,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 1 dia = 24 horas
    }

    localStorage.setItem("appUser", JSON.stringify(newUser))
    
    try {
      const storedMap = localStorage.getItem("appKnownUsers")
      const knownUsers = storedMap ? JSON.parse(storedMap) : {}
      knownUsers[plainPhone] = userName.trim()
      localStorage.setItem("appKnownUsers", JSON.stringify(knownUsers))
    } catch {}

    setUser(newUser)
  }

  const plainPhone = phone.replace(/\D/g, "")

  useEffect(() => {
    if (plainPhone.length === 11 && knownName) {
      const timer = setTimeout(() => {
        loginUser(phone, knownName)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [plainPhone, knownName, phone])

  if (!mounted) return null // Hide until hydration completes

  if (user) {
    return (
      <PhoneLoginContext.Provider value={{ user }}>
        {children}
      </PhoneLoginContext.Provider>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (plainPhone.length < 10) {
      setError("Por favor, preencha um telefone válido.")
      return
    }

    if (knownName) {
      loginUser(phone, knownName)
      return
    }

    if (name.trim().length < 3) {
      setError("Por favor, preencha um nome válido.")
      return
    }
    
    loginUser(phone, name)
  }

  const isCompletePhone = plainPhone.length >= 10
  const showNameField = isCompletePhone && !knownName

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 relative" style={{ backgroundImage: "linear-gradient(to bottom right, #09090b, #18181b, #0d121c)"}}>
      <div className="absolute inset-0 bg-blue-500/5 mix-blend-screen pointer-events-none" />
      
      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-2xl p-6 sm:p-8 relative z-10 relative overflow-hidden">
        {/* Glow effect inside form box */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full" />
        
        <div className="flex flex-col items-center space-y-2 mb-8 relative z-10">
          <div className="p-3 bg-primary/10 rounded-full mb-2 border border-primary/20">
            <User className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Acesso Restrito</h1>
          <p className="text-sm text-zinc-400 text-center">Informe seu telefone e nome para registrar suas alterações nos programas.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-zinc-300">Celular / WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input 
                id="phone" 
                type="tel"
                placeholder="(00) 00000-0000" 
                className="pl-10 h-12 bg-zinc-950/50 border-zinc-800 text-zinc-100 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary/50 transition-all placeholder:text-zinc-700" 
                value={phone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value)
                  setPhone(formatted)
                  const plain = formatted.replace(/\D/g, "")
                  try {
                    const storedMap = localStorage.getItem("appKnownUsers")
                    if (storedMap) {
                      const knownUsers = JSON.parse(storedMap)
                      setKnownName(knownUsers[plain] || "")
                    } else {
                      setKnownName("")
                    }
                  } catch {
                    setKnownName("")
                  }
                }}
                required
              />
            </div>
            {knownName && plainPhone.length >= 10 && (
              <p className="text-xs text-primary/80 mt-1 animate-in fade-in duration-300">
                Bem-vindo de volta, {knownName.split(" ")[0]}!
              </p>
            )}
          </div>
          
          {showNameField && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="name" className="text-zinc-300">Seu Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input 
                  id="name" 
                  type="text"
                  placeholder="Ex: João da Silva" 
                  className="pl-10 h-12 bg-zinc-950/50 border-zinc-800 text-zinc-100 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary/50 transition-all placeholder:text-zinc-700" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={showNameField}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all duration-300 relative overflow-hidden group">
            <span className="relative z-10 flex items-center justify-center gap-2">
              Entrar no Sistema
            </span>
            {/* Hover glare effect */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          </Button>
        </form>
      </div>
    </div>
  )
}

