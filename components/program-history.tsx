"use client"

import React from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { History, User, Clock, Loader2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface HistoryItem {
  id: string
  program_type: string
  program_id: string
  user_name: string
  action_type: string
  description: string
  created_at: string
}

interface ProgramHistoryProps {
  programId: string
  programType: string
}

export function ProgramHistory({ programId, programType }: ProgramHistoryProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const { data: history, error, isLoading } = useSWR<HistoryItem[]>(
    isOpen && programId ? `/api/history?program_id=${programId}` : null,
    fetcher,
    { refreshInterval: isOpen ? 5000 : 0 } // Refresh every 5 seconds when open
  )

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-primary/20 text-primary hover:bg-primary/10">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">Histórico</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6 mt-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5 text-muted-foreground" />
            <span>Últimas Alterações</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
              {programType}
            </span>
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col">
          {isLoading && (
            <div className="flex items-center justify-center p-6 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando histórico...</span>
            </div>
          )}
          
          {error && (
            <div className="p-4 text-sm text-red-500 bg-red-500/10 rounded-lg">
              Erro ao carregar o histórico de alterações.
            </div>
          )}

          {history && history.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
              Nenhuma alteração registrada recentemente.
            </div>
          )}

          {history && history.length > 0 && (
            <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {history.map((item) => (
                <div key={item.id} className="relative flex items-start justify-between gap-4 py-4 px-2">
                  <div className="absolute left-0 w-[24px] flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  </div>
                  
                  <div className="flex flex-col gap-1 pl-8 w-full">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold text-primary">{item.user_name}</span> {item.description}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
