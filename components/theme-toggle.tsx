"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="md:h-9 md:w-9 h-10 w-10 opacity-50 cursor-default">
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="md:h-9 md:w-9 h-10 w-10 text-muted-foreground hover:bg-muted"
      title="Alternar tema"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 transition-all text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 transition-all text-slate-700" />
      )}
      <span className="sr-only">Mudar tema</span>
    </Button>
  )
}
