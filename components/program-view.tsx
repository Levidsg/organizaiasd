"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import useSWR from "swr"
import { ClipboardList, Download, Pencil, Check, Loader2, Eraser, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

import { usePhoneLogin } from "@/components/phone-login-provider"
import { ProgramHistory } from "@/components/program-history"
import { logHistory } from "@/lib/history-tracker"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatTimeInput(raw: string): string {
  if (!raw) return ""
  
  if (raw.includes(":")) {
    const parts = raw.split(":")
    const cleanH = parts[0].replace(/\D/g, "").slice(0, 2)
    const cleanM = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2)
    return `${cleanH}:${cleanM}`
  }

  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  if (digits.length === 3) return digits.slice(0, 1) + ":" + digits.slice(1)
  return digits.slice(0, 2) + ":" + digits.slice(2)
}

function formatDurationInput(raw: string): string {
  if (!raw) return ""
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  return digits + " min"
}

function calcNextTime(time: string, duration: string): string {
  const timeMatch = time.match(/^(\d{1,2})[h:](\d{2})$/)
  if (!timeMatch) return ""
  const hours = parseInt(timeMatch[1], 10)
  const mins = parseInt(timeMatch[2], 10)
  const durMins = parseInt(duration.replace(/\D/g, ""), 10)
  if (isNaN(durMins)) return ""
  const totalMins = hours * 60 + mins + durMins
  const newH = Math.floor(totalMins / 60) % 24
  const newM = totalMins % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

interface ProgramItem {
  id?: string
  section: string
  time: string
  duration: string
  activity: string
  responsible: string
  sort_order: number
}

interface Program {
  id: string
  title: string
  program_date: string
  leader: string
  program_type: string
  program_items: ProgramItem[]
}

interface ProgramListItem {
  id: string
  title: string
  program_date: string
  leader: string
  program_type: string
}

type TabType = "sabado" | "domingo" | "quarta" | "especiais"

const TAB_LABELS: Record<TabType, string> = {
  sabado: "Sábado",
  domingo: "Domingo",
  quarta: "Quarta",
  especiais: "Especiais",
}

/* ══════════════════════════════════
   Main Component with Tabs
   ══════════════════════════════════ */
export function ProgramView() {
  const [activeTab, setActiveTab] = useState<TabType>("sabado")

  return (
    <div className="p-3 md:p-6 w-full">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          Programa do Culto
        </h1>

        {/* Tab navigation */}
        <div className="flex border-b border-border overflow-x-auto">
          {(["sabado", "domingo", "quarta", "especiais"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors relative capitalize whitespace-nowrap ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {activeTab === "sabado" && <SabadoTab />}
        {activeTab === "domingo" && <DomingoTab />}
        {activeTab === "quarta" && <QuartaTab />}
        {activeTab === "especiais" && <EspeciaisTab />}
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   SABADO - only responsible editable
   ══════════════════════════════════ */
function SabadoTab() {
  const { data: programs } = useSWR<ProgramListItem[]>("/api/programs?program_type=sabado", fetcher)
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const tableRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (programs && programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  const { data: selectedProgram, mutate } = useSWR<Program>(
    selectedProgramId ? `/api/programs?id=${selectedProgramId}` : null,
    fetcher,
  )

  const [editingLeader, setEditingLeader] = useState(false)
  const [leaderValue, setLeaderValue] = useState("")
  const [editingDate, setEditingDate] = useState(false)
  const [dateValue, setDateValue] = useState("")
  const [savingField, setSavingField] = useState("")
  const [clearing, setClearing] = useState(false)
  const { user } = usePhoneLogin()

  useEffect(() => {
    if (selectedProgram) {
      setLeaderValue(selectedProgram.leader || "")
      setDateValue(selectedProgram.program_date || "")
    }
  }, [selectedProgram])

  const saveProgram = useCallback(
    async (updates: Partial<Program> & { items?: ProgramItem[] }) => {
      if (!selectedProgram) return false
      const res = await fetch("/api/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProgram.id,
          title: updates.title ?? selectedProgram.title,
          program_date: updates.program_date ?? selectedProgram.program_date,
          leader: updates.leader ?? selectedProgram.leader,
          items: updates.items ?? selectedProgram.program_items,
        }),
      })
      if (res.ok) { await mutate(); return true }
      return false
    },
    [selectedProgram, mutate],
  )

  const handleCellSave = useCallback(
    async (itemId: string, field: string, value: string) => {
      if (!selectedProgram) return
      setSavingField(`${itemId}-${field}`)
      const targetItem = selectedProgram.program_items.find(i => i.id === itemId)
      const updatedItems = selectedProgram.program_items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      )
      const ok = await saveProgram({ items: updatedItems })
      setSavingField("")
      if (ok) {
        toast.success("Salvo!")
        const fTranslated = { time: "o horário", duration: "o tempo", activity: "a atividade", responsible: "o responsável" }[field] || field
        if (targetItem && user) logHistory(selectedProgram.id, "sabado", user.name, "updated", `alterou ${fTranslated} de "${targetItem.activity}" para "${value || 'vazio'}"`)
      }
    },
    [selectedProgram, saveProgram, user],
  )

  async function handleAddRowBelow(itemId: string, section: string) {
    if (!selectedProgram) return
    const items = [...selectedProgram.program_items]
    const idx = items.findIndex(i => i.id === itemId)
    if (idx === -1) return
    
    const currentItem = items[idx]
    const nextTime = calcNextTime(currentItem.time || "", currentItem.duration || "")
    
    const newItem: ProgramItem = {
      section: section,
      time: nextTime,
      duration: "",
      activity: "",
      responsible: "",
      sort_order: 0
    }
    
    items.splice(idx + 1, 0, newItem)
    const reordered = items.map((item, i) => ({ ...item, sort_order: i }))
    
    const ok = await saveProgram({ items: reordered })
    if (ok) toast.success("Linha adicionada!")
  }

  async function handleDeleteRow(itemId: string) {
    if (!selectedProgram) return
    if (!window.confirm("Deseja excluir esta linha?")) return
    const updatedItems = selectedProgram.program_items.filter(i => i.id !== itemId).map((item, i) => ({ ...item, sort_order: i }))
    const ok = await saveProgram({ items: updatedItems })
    if (ok) toast.success("Linha removida!")
  }

  async function handleLeaderSave() {
    setSavingField("leader")
    const ok = await saveProgram({ leader: leaderValue })
    setSavingField("")
    if (ok) {
      toast.success("Dirigente salvo!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "sabado", user.name, "updated", `alterou o dirigente para "${leaderValue || 'vazio'}"`)
      setEditingLeader(false) 
    }
  }

  async function handleDateSave() {
    setSavingField("date")
    const ok = await saveProgram({ program_date: dateValue })
    setSavingField("")
    if (ok) {
      toast.success("Data salva!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "sabado", user.name, "updated", `alterou a data para "${dateValue}"`)
      setEditingDate(false) 
    }
  }

  async function handleClearAll() {
    if (!selectedProgram) return
    if (!window.confirm("Limpar campos de responsáveis, dirigentes e data? (horário, tempo e atividade NÃO serão afetados)")) return
    setClearing(true)
    const clearedItems = selectedProgram.program_items.map((item) => ({ ...item, responsible: "" }))
    const ok = await saveProgram({ items: clearedItems, leader: "", program_date: "" })
    setClearing(false)
    if (ok) {
      setLeaderValue("")
      setDateValue("")
      toast.success("Campos limpos!")
      if (user) logHistory(selectedProgram.id, "sabado", user.name, "cleared", `limpou todos os campos de responsáveis, dirigentes e data`)
    }
  }

  async function handleExportPNG() {
    if (!tableRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 900 })
      const link = document.createElement("a")
      link.download = `programa-sabado-${selectedProgram?.program_date || "culto"}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Imagem exportada!")
    } catch { toast.error("Erro ao exportar imagem") }
    setExporting(false)
  }

  const cultoItems: ProgramItem[] = []
  const escolaItems: ProgramItem[] = []
  if (selectedProgram?.program_items) {
    for (const item of selectedProgram.program_items) {
      if (item.section === "Escola Sabatina") escolaItems.push(item)
      else cultoItems.push(item)
    }
  }

  if (!selectedProgram) {
    return <LoadingState />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs md:text-sm text-muted-foreground">Toque nos campos para editar responsáveis, dirigente e data</p>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <ProgramHistory programId={selectedProgram.id} programType="sabado" />
          <ClearButton clearing={clearing} onClick={handleClearAll} />
          <ExportButton exporting={exporting} onClick={handleExportPNG} />
        </div>
      </div>

      {programs && programs.length > 1 && (
        <ProgramSelector programs={programs} selectedId={selectedProgramId} onSelect={setSelectedProgramId} />
      )}

      <div ref={tableRef} className="w-full rounded-lg border border-border shadow-sm bg-card overflow-hidden">
        {/* CABEÇALHO GLOBAL */}
        <div className="w-full px-3 py-3 text-center text-sm md:text-base font-bold uppercase tracking-wide" style={{ backgroundColor: "#2c3e6b", color: "#ffffff" }}>
          <HeaderEditable
            title={selectedProgram.title}
            date={selectedProgram.program_date}
            leader={selectedProgram.leader}
            editingDate={editingDate}
            editingLeader={editingLeader}
            dateValue={dateValue}
            leaderValue={leaderValue}
            savingField={savingField}
            setEditingDate={setEditingDate}
            setEditingLeader={setEditingLeader}
            setDateValue={setDateValue}
            setLeaderValue={setLeaderValue}
            handleDateSave={handleDateSave}
            handleLeaderSave={handleLeaderSave}
          />
        </div>

        {/* CULTO */}
        <div className="hidden md:grid grid-cols-[40px_80px_80px_1fr_250px_40px] lg:grid-cols-[40px_100px_100px_1fr_300px_40px]" style={{ backgroundColor: "#3b5998" }}>
          <div></div>
          <div className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white">Horário</div>
          <div className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white">Tempo</div>
          <div className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white">Atividade</div>
          <div className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white">Responsável</div>
          <div></div>
        </div>

        <div className="flex flex-col">
          {cultoItems.map((item, index) => (
            <div 
              key={item.id || `culto-${index}`} 
              className="flex flex-col md:grid md:grid-cols-[40px_80px_80px_1fr_250px_40px] lg:grid-cols-[40px_100px_100px_1fr_300px_40px] border-b border-[#c5d0e0] p-3 md:p-0 gap-2 md:gap-0 relative group"
              style={{ backgroundColor: index % 2 === 0 ? "#dce3f0" : "#e8eef6" }}
            >
              <div className="hidden md:flex items-center justify-center">
                <button type="button" onClick={() => handleAddRowBelow(item.id!, "Culto")} className="p-1 rounded hover:bg-white/50 text-[#3b5998] transition-colors" title="Adicionar linha abaixo">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile Content */}
              <div className="flex items-center justify-between md:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#3b5998", color: "white" }}>{item.time}</span>
                  {item.duration && <span className="text-xs text-muted-foreground">{item.duration}</span>}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleAddRowBelow(item.id!, "Culto")} className="p-1.5 rounded-md bg-white/50 text-[#3b5998]">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDeleteRow(item.id!)} className="p-1.5 rounded-md bg-white/50 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="hidden md:flex px-1 md:px-2 py-1 items-center">
                <EditableCell value={item.time} saving={savingField === `${item.id}-time`} onSave={(v) => handleCellSave(item.id!, "time", v)} placeholder="Horário" type="time" />
              </div>
              <div className="hidden md:flex px-1 md:px-2 py-1 items-center">
                <EditableCell value={item.duration} saving={savingField === `${item.id}-duration`} onSave={(v) => handleCellSave(item.id!, "duration", v)} placeholder="Tempo" type="duration" />
              </div>
              
              <div className="w-full md:w-auto md:px-2 py-1 flex items-center">
                <EditableCell value={item.activity} saving={savingField === `${item.id}-activity`} onSave={(v) => handleCellSave(item.id!, "activity", v)} placeholder="Atividade" />
              </div>
              
              <div className="w-full md:w-auto md:px-2 py-1 flex items-center">
                <ResponsibleCell item={item} saving={savingField === `${item.id}-responsible`} onSave={(id, v) => handleCellSave(id, "responsible", v)} colorScheme="blue" />
              </div>

              <div className="hidden md:flex items-center justify-center">
                <button type="button" onClick={() => handleDeleteRow(item.id!)} className="p-1 rounded hover:bg-white/50 text-destructive/70 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100" title="Excluir linha">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ESCOLA SABATINA */}
        <div className="w-full px-3 py-2 text-left text-xs font-bold uppercase tracking-wider mt-4 md:mt-0 md:grid md:grid-cols-[40px_80px_80px_1fr_250px_40px] lg:grid-cols-[40px_100px_100px_1fr_300px_40px] hidden" style={{ backgroundColor: "#5a7a3a", color: "#ffffff" }}>
          <div></div>
          <div>Horário</div>
          <div>Tempo</div>
          <div>Escola Sabatina</div>
          <div>Responsável</div>
          <div></div>
        </div>
        <div className="md:hidden w-full px-3 py-2 text-center text-xs font-bold uppercase tracking-wider mt-4" style={{ backgroundColor: "#5a7a3a", color: "#ffffff" }}>
          ESCOLA SABATINA
        </div>

        <div className="flex flex-col">
          {escolaItems.map((item, index) => (
            <div 
              key={item.id || `escola-${index}`} 
              className="flex flex-col md:grid md:grid-cols-[40px_80px_80px_1fr_250px_40px] lg:grid-cols-[40px_100px_100px_1fr_300px_40px] border-b border-[#b8ccaa] p-3 md:p-0 gap-2 md:gap-0 relative group"
              style={{ backgroundColor: index % 2 === 0 ? "#d6e4c8" : "#e4eeda" }}
            >
              <div className="hidden md:flex items-center justify-center">
                <button type="button" onClick={() => handleAddRowBelow(item.id!, "Escola Sabatina")} className="p-1 rounded hover:bg-white/50 text-[#5a7a3a] transition-colors" title="Adicionar linha abaixo">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile Content */}
              <div className="flex items-center justify-between md:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#5a7a3a", color: "white" }}>{item.time}</span>
                  {item.duration && <span className="text-xs text-muted-foreground">{item.duration}</span>}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleAddRowBelow(item.id!, "Escola Sabatina")} className="p-1.5 rounded-md bg-white/50 text-[#5a7a3a]">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDeleteRow(item.id!)} className="p-1.5 rounded-md bg-white/50 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="hidden md:flex px-1 md:px-2 py-1 items-center">
                <EditableCell value={item.time} saving={savingField === `${item.id}-time`} onSave={(v) => handleCellSave(item.id!, "time", v)} placeholder="Horário" type="time" />
              </div>
              <div className="hidden md:flex px-1 md:px-2 py-1 items-center">
                <EditableCell value={item.duration} saving={savingField === `${item.id}-duration`} onSave={(v) => handleCellSave(item.id!, "duration", v)} placeholder="Tempo" type="duration" />
              </div>
              
              <div className="w-full md:w-auto md:px-2 py-1 flex items-center">
                <EditableCell value={item.activity} saving={savingField === `${item.id}-activity`} onSave={(v) => handleCellSave(item.id!, "activity", v)} placeholder="Atividade" />
              </div>
              
              <div className="w-full md:w-auto md:px-2 py-1 flex items-center">
                <ResponsibleCell item={item} saving={savingField === `${item.id}-responsible`} onSave={(id, v) => handleCellSave(id, "responsible", v)} colorScheme="green" />
              </div>

              <div className="hidden md:flex items-center justify-center">
                <button type="button" onClick={() => handleDeleteRow(item.id!)} className="p-1 rounded hover:bg-white/50 text-destructive/70 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100" title="Excluir linha">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   DOMINGO - all fields editable, clear only responsavel
   ══════════════════════════════════ */
function DomingoTab() {
  const { data: programs } = useSWR<ProgramListItem[]>("/api/programs?program_type=domingo", fetcher)
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const tableRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (programs && programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  const { data: selectedProgram, mutate } = useSWR<Program>(
    selectedProgramId ? `/api/programs?id=${selectedProgramId}` : null,
    fetcher,
  )

  const [editingLeader, setEditingLeader] = useState(false)
  const [leaderValue, setLeaderValue] = useState("")
  const [editingDate, setEditingDate] = useState(false)
  const [dateValue, setDateValue] = useState("")
  const [savingField, setSavingField] = useState("")
  const [clearing, setClearing] = useState(false)
  const { user } = usePhoneLogin()

  useEffect(() => {
    if (selectedProgram) {
      setLeaderValue(selectedProgram.leader || "")
      setDateValue(selectedProgram.program_date || "")
    }
  }, [selectedProgram])

  const saveProgram = useCallback(
    async (updates: Partial<Program> & { items?: ProgramItem[] }) => {
      if (!selectedProgram) return false
      const res = await fetch("/api/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProgram.id,
          title: updates.title ?? selectedProgram.title,
          program_date: updates.program_date ?? selectedProgram.program_date,
          leader: updates.leader ?? selectedProgram.leader,
          items: updates.items ?? selectedProgram.program_items,
        }),
      })
      if (res.ok) { await mutate(); return true }
      return false
    },
    [selectedProgram, mutate],
  )

  const handleCellSave = useCallback(
    async (itemIndex: number, field: string, value: string) => {
      if (!selectedProgram) return
      setSavingField(`${itemIndex}-${field}`)
      const targetItem = selectedProgram.program_items[itemIndex]
      const updatedItems = selectedProgram.program_items.map((item, idx) =>
        idx === itemIndex ? { ...item, [field]: value } : item,
      )
      const ok = await saveProgram({ items: updatedItems })
      setSavingField("")
      if (ok) {
        toast.success("Salvo!")
        const fTranslated = { time: "o horário", duration: "o tempo", activity: "a atividade", responsible: "o responsável" }[field] || field
        if (targetItem && user) logHistory(selectedProgram.id, "domingo", user.name, "updated", `alterou ${fTranslated} de "${targetItem.activity}" para "${value || 'vazio'}"`)
      }
    },
    [selectedProgram, saveProgram, user],
  )

  async function handleAddRowBelow(itemIndex: number) {
    if (!selectedProgram) return
    const items = [...selectedProgram.program_items]
    const currentItem = items[itemIndex]
    const nextTime = calcNextTime(currentItem.time || "", currentItem.duration || "")
    
    const newItem: ProgramItem = {
      section: "Domingo",
      time: nextTime,
      duration: "",
      activity: "",
      responsible: "",
      sort_order: 0
    }
    
    items.splice(itemIndex + 1, 0, newItem)
    const reordered = items.map((item, i) => ({ ...item, sort_order: i }))
    
    const ok = await saveProgram({ items: reordered })
    if (ok) toast.success("Linha adicionada!")
  }

  async function handleDeleteRow(itemIndex: number) {
    if (!selectedProgram) return
    if (!window.confirm("Deseja excluir esta linha?")) return
    const updatedItems = selectedProgram.program_items.filter((_, i) => i !== itemIndex).map((item, i) => ({ ...item, sort_order: i }))
    const ok = await saveProgram({ items: updatedItems })
    if (ok) toast.success("Linha removida!")
  }

  async function handleLeaderSave() {
    setSavingField("leader")
    const ok = await saveProgram({ leader: leaderValue })
    setSavingField("")
    if (ok) {
      toast.success("Dirigente salvo!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "domingo", user.name, "updated", `alterou o dirigente para "${leaderValue || 'vazio'}"`)
      setEditingLeader(false) 
    }
  }

  async function handleDateSave() {
    setSavingField("date")
    const ok = await saveProgram({ program_date: dateValue })
    setSavingField("")
    if (ok) {
      toast.success("Data salva!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "domingo", user.name, "updated", `alterou a data para "${dateValue}"`)
      setEditingDate(false) 
    }
  }

  async function handleClearAll() {
    if (!selectedProgram) return
    if (!window.confirm("Limpar campos de responsáveis, dirigentes e data? (horário, tempo e atividade NÃO serão afetados)")) return
    setClearing(true)
    const clearedItems = selectedProgram.program_items.map((item) => ({ ...item, responsible: "" }))
    const ok = await saveProgram({ items: clearedItems, leader: "", program_date: "" })
    setClearing(false)
    if (ok) {
      setLeaderValue("")
      setDateValue("")
      toast.success("Campos limpos!")
      if (user) logHistory(selectedProgram.id, "domingo", user.name, "cleared", `limpou todos os campos de responsáveis, dirigentes e data`)
    }
  }

  async function handleExportPNG() {
    if (!tableRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 900 })
      const link = document.createElement("a")
      link.download = `programa-domingo-${selectedProgram?.program_date || "culto"}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Imagem exportada!")
    } catch { toast.error("Erro ao exportar imagem") }
    setExporting(false)
  }

  if (!selectedProgram) return <LoadingState />

  const items = selectedProgram.program_items || []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs md:text-sm text-muted-foreground">Todos os campos são editáveis. Limpar afeta somente responsáveis.</p>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <ProgramHistory programId={selectedProgram.id} programType="domingo" />
          <ClearButton clearing={clearing} onClick={handleClearAll} />
          <ExportButton exporting={exporting} onClick={handleExportPNG} />
        </div>
      </div>

      {programs && programs.length > 1 && (
        <ProgramSelector programs={programs} selectedId={selectedProgramId} onSelect={setSelectedProgramId} />
      )}

      <div ref={tableRef} className="w-full overflow-x-auto rounded-lg border border-border shadow-sm bg-card">
        <table className="w-full border-collapse min-w-[480px]">
          <thead>
            <tr>
              <th colSpan={6} className="px-3 py-3 text-center text-sm md:text-base font-bold uppercase tracking-wide" style={{ backgroundColor: "#5b7fa5", color: "#ffffff" }}>
                <HeaderEditable
                  title="PROGRAMA DOMINGO"
                  date={selectedProgram.program_date}
                  leader={selectedProgram.leader}
                  editingDate={editingDate}
                  editingLeader={editingLeader}
                  dateValue={dateValue}
                  leaderValue={leaderValue}
                  savingField={savingField}
                  setEditingDate={setEditingDate}
                  setEditingLeader={setEditingLeader}
                  setDateValue={setDateValue}
                  setLeaderValue={setLeaderValue}
                  handleDateSave={handleDateSave}
                  handleLeaderSave={handleLeaderSave}
                />
              </th>
            </tr>
            <ColumnHeaders color="#7a9cc6" />
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || `dom-${index}`} className="border-b border-[#b8ccdd] group" style={{ backgroundColor: index % 2 === 0 ? "#dce8f4" : "#e8f0f8" }}>
                <td className="px-1 py-1 text-center">
                  <button type="button" onClick={() => handleAddRowBelow(index)} className="p-1 rounded hover:bg-white/50 text-[#5b7fa5] transition-colors" title="Adicionar linha abaixo">
                    <Plus className="h-4 w-4" />
                  </button>
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.time} saving={savingField === `${index}-time`} onSave={(v) => handleCellSave(index, "time", v)} placeholder="Horário" type="time" />
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.duration} saving={savingField === `${index}-duration`} onSave={(v) => handleCellSave(index, "duration", v)} placeholder="Tempo" type="duration" />
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.activity} saving={savingField === `${index}-activity`} onSave={(v) => handleCellSave(index, "activity", v)} placeholder="Atividade" />
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.responsible} saving={savingField === `${index}-responsible`} onSave={(v) => handleCellSave(index, "responsible", v)} placeholder="Responsável" />
                </td>
                <td className="px-1 py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => handleDeleteRow(index)} className="p-1 rounded hover:bg-white/50 text-destructive/70 hover:text-destructive" title="Excluir linha">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   QUARTA - create custom programs, clear only responsavel
   ══════════════════════════════════ */

function QuartaTab() {
  const { data: programs } = useSWR<ProgramListItem[]>("/api/programs?program_type=quarta", fetcher)
  const programId = programs?.[0]?.id
  const { data: program, mutate } = useSWR<Program>(programId ? `/api/programs?id=${programId}` : null, fetcher)
  const tableRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [editingLeader, setEditingLeader] = useState(false)
  const [leaderValue, setLeaderValue] = useState("")
  const [savingField, setSavingField] = useState("")
  const [clearing, setClearing] = useState(false)
  const { user } = usePhoneLogin()

  useEffect(() => {
    if (program) setLeaderValue(program.leader || "")
  }, [program])

  const saveProgram = useCallback(
    async (updates: Partial<Program> & { items?: ProgramItem[] }) => {
      if (!program) return false
      const res = await fetch("/api/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: program.id,
          title: updates.title ?? program.title,
          program_date: updates.program_date ?? program.program_date,
          leader: updates.leader ?? program.leader,
          items: updates.items ?? program.program_items,
        }),
      })
      if (res.ok) { await mutate(); return true }
      return false
    },
    [program, mutate],
  )

  const handleCellSave = useCallback(
    async (itemIndex: number, field: string, value: string) => {
      if (!program) return
      setSavingField(`${itemIndex}-${field}`)
      const targetItem = (program.program_items || [])[itemIndex]
      const updatedItems = (program.program_items || []).map((item, idx) =>
        idx === itemIndex ? { ...item, [field]: value } : item,
      )
      const ok = await saveProgram({ items: updatedItems })
      setSavingField("")
      if (ok) {
        toast.success("Salvo!")
        const fTranslated = { time: "o horário", duration: "o tempo", activity: "a atividade", responsible: "o responsável" }[field] || field
        if (targetItem && user) logHistory(program.id, "quarta", user.name, "updated", `alterou ${fTranslated} de "${targetItem.activity}" para "${value || 'vazio'}"`)
      }
    },
    [program, saveProgram, user],
  )

  async function handleAddRowBelow(itemIndex: number) {
    if (!program) return
    const items = [...(program.program_items || [])]
    const currentItem = items[itemIndex]
    const nextTime = calcNextTime(currentItem.time || "", currentItem.duration || "")
    
    const newItem: ProgramItem = {
      section: "Quarta",
      time: nextTime,
      duration: "",
      activity: "",
      responsible: "",
      sort_order: 0
    }
    
    items.splice(itemIndex + 1, 0, newItem)
    const reordered = items.map((item, i) => ({ ...item, sort_order: i }))
    
    const ok = await saveProgram({ items: reordered })
    if (ok) toast.success("Linha adicionada!")
  }

  async function handleDeleteRow(itemIndex: number) {
    if (!program) return
    if (!window.confirm("Deseja excluir esta linha?")) return
    const updatedItems = (program.program_items || []).filter((_, i) => i !== itemIndex).map((item, i) => ({ ...item, sort_order: i }))
    const ok = await saveProgram({ items: updatedItems })
    if (ok) toast.success("Linha removida!")
  }

  async function handleLeaderSave() {
    setSavingField("leader")
    const ok = await saveProgram({ leader: leaderValue })
    setSavingField("")
    if (ok) {
      toast.success("Dirigente salvo!")
      if (user && program) logHistory(program.id, "quarta", user.name, "updated", `alterou o dirigente para "${leaderValue || 'vazio'}"`)
      setEditingLeader(false) 
    }
  }

  async function handleClearAll() {
    if (!program) return
    if (!window.confirm("Limpar campos de responsáveis, dirigentes e data? (horário, tempo e atividade NÃO serão afetados)")) return
    setClearing(true)
    const clearedItems = (program.program_items || []).map((item) => ({ ...item, responsible: "" }))
    const ok = await saveProgram({ items: clearedItems, leader: "", program_date: "" })
    setClearing(false)
    if (ok) {
      setLeaderValue("")
      toast.success("Campos limpos!")
      if (user) logHistory(program.id, "quarta", user.name, "cleared", `limpou todos os campos de responsáveis, dirigentes e data`)
    }
  }

  async function handleMoveRow(fromIndex: number, direction: "up" | "down") {
    if (!program) return
    const items = [...(program.program_items || [])]
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= items.length) return
    ;[items[fromIndex], items[toIndex]] = [items[toIndex], items[fromIndex]]
    const reordered = items.map((item, idx) => ({ ...item, sort_order: idx }))
    const ok = await saveProgram({ items: reordered })
    if (ok) {
      toast.success("Ordem alterada!")
      if (user) logHistory(program.id, "quarta", user.name, "updated", `alterou a ordem da atividade "${items[toIndex].activity}" para ${direction === "up" ? "cima" : "baixo"}`)
    }
  }

  async function handleExportPNG() {
    if (!tableRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 900 })
      const link = document.createElement("a")
      link.download = `programa-quarta-feira.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Imagem exportada!")
    } catch { toast.error("Erro ao exportar imagem") }
    setExporting(false)
  }

  if (!program) return <LoadingState />

  const quartaColor = "#3a6b4f"
  const quartaColorLight = "#4d8a65"
  const items = program.program_items || []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs md:text-sm text-muted-foreground">Todos os campos são editáveis. Limpar afeta somente responsáveis.</p>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <ProgramHistory programId={programId || ""} programType="quarta" />
          <ClearButton clearing={clearing} onClick={handleClearAll} />
          <ExportButton exporting={exporting} onClick={handleExportPNG} />
        </div>
      </div>

      <div ref={tableRef} className="w-full overflow-x-auto rounded-lg border border-border shadow-sm bg-card" style={{ minWidth: 600 }}>
        <table className="w-full border-collapse" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th colSpan={7} className="px-3 py-3 text-center text-sm md:text-base font-bold uppercase tracking-wide" style={{ backgroundColor: quartaColor, color: "#ffffff" }}>
                PROGRAMA DE QUARTA-FEIRA - {editingLeader ? (
                  <span className="inline-flex items-center gap-1">
                    <input value={leaderValue} onChange={(e) => setLeaderValue(e.target.value)} onBlur={handleLeaderSave} onKeyDown={(e) => e.key === "Enter" && handleLeaderSave()} autoFocus className="bg-white/20 border border-white/40 rounded px-2 py-0.5 text-sm w-48 text-white placeholder-white/60 outline-none" placeholder="Dirigentes" />
                    {savingField === "leader" && <Loader2 className="h-3 w-3 animate-spin" />}
                  </span>
                ) : (
                  <button onClick={() => setEditingLeader(true)} className="hover:bg-white/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                    {program.leader || "Definir dirigentes"} <Pencil className="h-3 w-3 opacity-60" />
                  </button>
                )}
              </th>
            </tr>
            <tr>
              <th className="w-[40px]" style={{ backgroundColor: quartaColorLight }}></th>
              <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: quartaColorLight, color: "#ffffff" }}>Horário</th>
              <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: quartaColorLight, color: "#ffffff" }}>Tempo</th>
              <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: quartaColorLight, color: "#ffffff" }}>Atividade</th>
              <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[140px] md:w-[280px]" style={{ backgroundColor: quartaColorLight, color: "#ffffff" }}>Responsável</th>
              <th className="w-[50px]" style={{ backgroundColor: quartaColorLight }}></th>
              <th className="w-[40px]" style={{ backgroundColor: quartaColorLight }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || `qua-${index}`} className="border-b border-[#a8ccb8] group" style={{ backgroundColor: index % 2 === 0 ? "#d4e8dc" : "#e2f0e8" }}>
                <td className="px-1 py-1 text-center">
                  <button type="button" onClick={() => handleAddRowBelow(index)} className="p-1 rounded hover:bg-white/50 text-[#3a6b4f] transition-colors" title="Adicionar linha abaixo">
                    <Plus className="h-4 w-4" />
                  </button>
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.time} saving={savingField === `${index}-time`} onSave={(v) => handleCellSave(index, "time", v)} placeholder="Horário" type="time" />
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.duration} saving={savingField === `${index}-duration`} onSave={(v) => handleCellSave(index, "duration", v)} placeholder="Tempo" type="duration" />
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.activity} saving={savingField === `${index}-activity`} onSave={(v) => handleCellSave(index, "activity", v)} placeholder="Atividade" />
                </td>
                <td className="px-1 md:px-2 py-1">
                  <EditableCell value={item.responsible} saving={savingField === `${index}-responsible`} onSave={(v) => handleCellSave(index, "responsible", v)} placeholder="Responsável" />
                </td>
                <td className="px-1 py-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <button type="button" onClick={() => handleMoveRow(index, "up")} disabled={index === 0} className="p-0.5 rounded hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                    <button type="button" onClick={() => handleMoveRow(index, "down")} disabled={index === items.length - 1} className="p-0.5 rounded hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                  </div>
                </td>
                <td className="px-1 py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => handleDeleteRow(index)} className="p-1 rounded hover:bg-white/50 text-destructive/70 hover:text-destructive" title="Excluir linha">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   EspeciaisTab - Custom Programs
   ══════════════════════════════════ */

function EspeciaisTab() {
  const { data: programs, mutate: mutateList } = useSWR<ProgramListItem[]>("/api/programs?program_type=especial", fetcher)
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const [creating, setCreating] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (programs && programs.length > 0 && !selectedProgramId && !creating) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId, creating])

  const { data: selectedProgram, mutate } = useSWR<Program>(
    selectedProgramId && !creating ? `/api/programs?id=${selectedProgramId}` : null,
    fetcher,
  )

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const [editingLeader, setEditingLeader] = useState(false)
  const [leaderValue, setLeaderValue] = useState("")
  const [editingDate, setEditingDate] = useState(false)
  const [dateValue, setDateValue] = useState("")
  const [savingField, setSavingField] = useState("")
  const [clearing, setClearing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { user } = usePhoneLogin()

  const [newTitle, setNewTitle] = useState("")
  const [newDate, setNewDate] = useState("")
  const [newLeader, setNewLeader] = useState("")
  const [newItems, setNewItems] = useState<ProgramItem[]>([
    { section: "Especial", time: "", duration: "", activity: "", responsible: "", sort_order: 0 },
  ])

  useEffect(() => {
    if (selectedProgram) {
      setTitleValue(selectedProgram.title || "")
      setLeaderValue(selectedProgram.leader || "")
      setDateValue(selectedProgram.program_date || "")
    }
  }, [selectedProgram])

  const saveProgram = useCallback(
    async (updates: Partial<Program> & { items?: ProgramItem[] }) => {
      if (!selectedProgram) return false
      const res = await fetch("/api/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProgram.id,
          title: updates.title ?? selectedProgram.title,
          program_date: updates.program_date ?? selectedProgram.program_date,
          leader: updates.leader ?? selectedProgram.leader,
          items: updates.items ?? selectedProgram.program_items,
        }),
      })
      if (res.ok) { await mutate(); await mutateList(); return true }
      return false
    },
    [selectedProgram, mutate, mutateList],
  )

  const handleCellSave = useCallback(
    async (itemIndex: number, field: string, value: string) => {
      if (!selectedProgram) return
      setSavingField(`${itemIndex}-${field}`)
      const targetItem = (selectedProgram.program_items || [])[itemIndex]
      const updatedItems = (selectedProgram.program_items || []).map((item, idx) =>
        idx === itemIndex ? { ...item, [field]: value } : item,
      )
      const ok = await saveProgram({ items: updatedItems })
      setSavingField("")
      if (ok) {
        toast.success("Salvo!")
        const fTranslated = { time: "o horário", duration: "o tempo", activity: "a atividade", responsible: "o responsável" }[field] || field
        if (targetItem && user) logHistory(selectedProgram.id, "especiais", user.name, "updated", `alterou ${fTranslated} de "${targetItem.activity}" para "${value || 'vazio'}"`)
      }
    },
    [selectedProgram, saveProgram, user],
  )

  async function handleTitleSave() {
    setSavingField("title")
    const ok = await saveProgram({ title: titleValue })
    setSavingField("")
    if (ok) {
      toast.success("Titulo salvo!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "especiais", user.name, "updated", `alterou o titulo para "${titleValue}"`)
      setEditingTitle(false) 
    }
  }

  async function handleLeaderSave() {
    setSavingField("leader")
    const ok = await saveProgram({ leader: leaderValue })
    setSavingField("")
    if (ok) {
      toast.success("Dirigente salvo!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "especiais", user.name, "updated", `alterou o dirigente para "${leaderValue || 'vazio'}"`)
      setEditingLeader(false) 
    }
  }

  async function handleDateSave() {
    setSavingField("date")
    const ok = await saveProgram({ program_date: dateValue })
    setSavingField("")
    if (ok) {
      toast.success("Data salva!")
      if (user && selectedProgram) logHistory(selectedProgram.id, "especiais", user.name, "updated", `alterou a data para "${dateValue}"`)
      setEditingDate(false) 
    }
  }

  async function handleClearAll() {
    if (!selectedProgram) return
    if (!window.confirm("Limpar campos de responsáveis, dirigentes e data? (horário, tempo e atividade NÃO serão afetados)")) return
    setClearing(true)
    const clearedItems = (selectedProgram.program_items || []).map((item) => ({ ...item, responsible: "" }))
    const ok = await saveProgram({ items: clearedItems, leader: "", program_date: "" })
    setClearing(false)
    if (ok) {
      setLeaderValue("")
      setDateValue("")
      toast.success("Campos limpos!")
      if (user) logHistory(selectedProgram.id, "especiais", user.name, "cleared", `limpou todos os campos de responsáveis, dirigentes e data`)
    }
  }

  async function handleAddRow() {
    if (!selectedProgram) return
    const existingItems = selectedProgram.program_items || []
    const lastItem = existingItems[existingItems.length - 1]
    const nextTime = lastItem ? calcNextTime(lastItem.time || "", lastItem.duration || "") : ""
    const newItem: ProgramItem = { section: "Especial", time: nextTime, duration: "", activity: "", responsible: "", sort_order: existingItems.length }
    const ok = await saveProgram({ items: [...existingItems, newItem] })
    if (ok) toast.success("Linha adicionada!")
  }

  async function handleDeleteRow(idx: number) {
    if (!selectedProgram) return
    const updatedItems = (selectedProgram.program_items || []).filter((_, i) => i !== idx).map((item, i) => ({ ...item, sort_order: i }))
    const ok = await saveProgram({ items: updatedItems })
    if (ok) toast.success("Linha removida!")
  }

  async function handleMoveRow(fromIndex: number, direction: "up" | "down") {
    if (!selectedProgram) return
    const items = [...(selectedProgram.program_items || [])]
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= items.length) return
    ;[items[fromIndex], items[toIndex]] = [items[toIndex], items[fromIndex]]
    const reordered = items.map((item, idx) => ({ ...item, sort_order: idx }))
    const ok = await saveProgram({ items: reordered })
    if (ok) {
      toast.success("Ordem alterada!")
      if (user) logHistory(selectedProgram.id, "especiais", user.name, "updated", `alterou a ordem da atividade "${items[toIndex].activity}" para ${direction === "up" ? "cima" : "baixo"}`)
    }
  }

  async function handleAddRowBelow(itemIndex: number) {
    if (!selectedProgram) return
    const items = [...(selectedProgram.program_items || [])]
    const currentItem = items[itemIndex]
    const nextTime = calcNextTime(currentItem.time || "", currentItem.duration || "")
    
    const newItem: ProgramItem = {
      section: "Especial",
      time: nextTime,
      duration: "",
      activity: "",
      responsible: "",
      sort_order: 0
    }
    
    items.splice(itemIndex + 1, 0, newItem)
    const reordered = items.map((item, i) => ({ ...item, sort_order: i }))
    
    const ok = await saveProgram({ items: reordered })
    if (ok) toast.success("Linha adicionada!")
  }

  function handleNewItemChange(idx: number, field: string, raw: string) {
    const c = [...newItems]
    let value = raw
    if (field === "time") value = formatTimeInput(raw)
    // Para duration, deixamos apenas dígitos enquanto digita para não atrapalhar
    if (field === "duration") value = raw.replace(/\D/g, "")
    
    c[idx] = { ...c[idx], [field]: value }
    if ((field === "time" || field === "duration") && idx < c.length - 1) {
      const next = calcNextTime(c[idx].time || "", c[idx].duration || "")
      if (next) c[idx + 1] = { ...c[idx + 1], time: next }
    }
    setNewItems(c)
  }

  function handleAddNewRowBelow(idx: number) {
    const c = [...newItems]
    const current = c[idx]
    const nextTime = calcNextTime(current.time || "", current.duration || "")
    c.splice(idx + 1, 0, { section: "Especial", time: nextTime, duration: "", activity: "", responsible: "", sort_order: c.length })
    setNewItems(c.map((item, i) => ({ ...item, sort_order: i })))
  }

  async function handleCreateProgram() {
    if (!newTitle) { toast.error("Preencha o titulo"); return }
    if (!newDate) { toast.error("Preencha a data"); return }
    setSaving(true)
    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        program_date: newDate,
        leader: newLeader,
        program_type: "especial",
        items: newItems,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setCreating(false)
      setSelectedProgramId(data.id)
      setNewTitle("")
      setNewDate("")
      setNewLeader("")
      setNewItems([{ section: "Especial", time: "", duration: "", activity: "", responsible: "", sort_order: 0 }])
      mutateList()
      toast.success("Programa criado!")
    } else {
      toast.error("Erro ao criar programa")
    }
  }

  async function handleDeleteProgram() {
    if (!selectedProgram) return
    if (!window.confirm("Deseja excluir este programa?")) return
    await fetch(`/api/programs?id=${selectedProgram.id}`, { method: "DELETE" })
    setSelectedProgramId("")
    mutateList()
    toast.success("Programa excluido!")
  }

  async function handleExportPNG() {
    if (!tableRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 900 })
      const link = document.createElement("a")
      link.download = `programa-especial-${selectedProgram?.program_date || "culto"}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Imagem exportada!")
    } catch { toast.error("Erro ao exportar imagem") }
    setExporting(false)
  }

  const specialColor = "#6b4f8a"
  const specialColorLight = "#8a65a8"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {programs?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setSelectedProgramId(p.id); setCreating(false) }}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              selectedProgramId === p.id && !creating
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted text-foreground"
            }`}
          >
            {p.title} - {formatDate(p.program_date)}
          </button>
        ))}
        <Button
          size="sm"
          variant={creating ? "default" : "outline"}
          onClick={() => { setCreating(true); setSelectedProgramId("") }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Novo programa
        </Button>
      </div>

      {creating && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Titulo</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Culto de Pascoa" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Data</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Dirigente</label>
              <Input value={newLeader} onChange={(e) => setNewLeader(e.target.value)} placeholder="Nome do dirigente" />
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-lg border border-border shadow-sm" style={{ minWidth: 600 }}>
            <table className="w-full border-collapse" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th colSpan={7} className="px-3 py-3 text-center text-sm md:text-base font-bold uppercase tracking-wide" style={{ backgroundColor: specialColor, color: "#ffffff" }}>
                    {newTitle || "PROGRAMA ESPECIAL"}{newDate ? ` - ${formatDate(newDate)}` : ""}{newLeader ? ` - ${newLeader}` : ""}
                  </th>
                </tr>
                <tr>
                  <th className="w-[40px]" style={{ backgroundColor: specialColorLight }}></th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Horário</th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Tempo</th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Atividade</th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[140px] md:w-[200px]" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Responsável</th>
                  <th className="w-[40px]" style={{ backgroundColor: specialColorLight }}></th>
                </tr>
              </thead>
              <tbody>
                {newItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-[#c4b8d4] group" style={{ backgroundColor: idx % 2 === 0 ? "#e8dff0" : "#f0eaf6" }}>
                    <td className="px-1 py-1 text-center">
                      <button type="button" onClick={() => handleAddNewRowBelow(idx)} className="p-1 rounded hover:bg-white/50 text-[#6b4f8a] transition-colors" title="Adicionar linha abaixo">
                        <Plus className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <input type="text" value={item.time} onChange={(e) => handleNewItemChange(idx, "time", e.target.value)} placeholder="19:00" className="w-full text-xs md:text-sm py-1.5 px-2 rounded border border-dashed border-gray-300 bg-white/40 text-left outline-none focus:ring-1 focus:ring-purple-400" />
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <input type="text" value={item.duration} onChange={(e) => handleNewItemChange(idx, "duration", e.target.value)} onBlur={(e) => handleNewItemChange(idx, "duration", formatDurationInput(e.target.value))} placeholder="15 min" className="w-full text-xs md:text-sm py-1.5 px-2 rounded border border-dashed border-gray-300 bg-white/40 text-left outline-none focus:ring-1 focus:ring-purple-400" />
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <input type="text" value={item.activity} onChange={(e) => handleNewItemChange(idx, "activity", e.target.value)} placeholder="Atividade" className="w-full text-xs md:text-sm py-1.5 px-2 rounded border border-dashed border-gray-300 bg-white/40 text-left outline-none focus:ring-1 focus:ring-purple-400" />
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <input type="text" value={item.responsible} onChange={(e) => handleNewItemChange(idx, "responsible", e.target.value)} placeholder="Responsável" className="w-full text-xs md:text-sm py-1.5 px-2 rounded border border-dashed border-gray-300 bg-white/40 text-left outline-none focus:ring-1 focus:ring-purple-400" />
                    </td>
                    <td className="px-1 py-1 text-center">
                      {newItems.length > 1 && (
                        <button type="button" onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="text-destructive hover:text-destructive/80 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => {
                const last = newItems[newItems.length - 1]
                const nextTime = last ? calcNextTime(last.time || "", last.duration || "") : ""
                setNewItems([...newItems, { section: "Especial", time: nextTime, duration: "", activity: "", responsible: "", sort_order: newItems.length }])
              }}
              className="w-full py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 border-t border-border flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar linha
            </button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreateProgram} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Programa
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {selectedProgram && !creating && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs md:text-sm text-muted-foreground">Todos os campos são editáveis. Use as setas para reordenar.</p>
            <div className="flex gap-2 self-start sm:self-auto flex-wrap">
              <ProgramHistory programId={selectedProgram.id} programType="especiais" />
              <ClearButton clearing={clearing} onClick={handleClearAll} />
              <Button onClick={handleDeleteProgram} size="sm" variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive bg-transparent">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <ExportButton exporting={exporting} onClick={handleExportPNG} />
            </div>
          </div>

          <div ref={tableRef} className="w-full overflow-x-auto rounded-lg border border-border shadow-sm bg-card" style={{ minWidth: 600 }}>
            <table className="w-full border-collapse" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th colSpan={7} className="px-3 py-3 text-center text-sm md:text-base font-bold uppercase tracking-wide" style={{ backgroundColor: specialColor, color: "#ffffff" }}>
                    {editingTitle ? (
                      <span className="inline-flex items-center gap-1">
                        <input value={titleValue} onChange={(e) => setTitleValue(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === "Enter" && handleTitleSave()} autoFocus className="bg-white/20 border border-white/40 rounded px-2 py-0.5 text-sm w-40 text-white placeholder-white/60 outline-none" />
                        {savingField === "title" && <Loader2 className="h-3 w-3 animate-spin" />}
                      </span>
                    ) : (
                      <button onClick={() => setEditingTitle(true)} className="hover:bg-white/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        {selectedProgram.title} <Pencil className="h-3 w-3 opacity-60" />
                      </button>
                    )}
                    {" - "}
                    {editingDate ? (
                      <span className="inline-flex items-center gap-1">
                        <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} onBlur={handleDateSave} autoFocus className="bg-white/20 border border-white/40 rounded px-2 py-0.5 text-sm text-white outline-none" />
                        {savingField === "date" && <Loader2 className="h-3 w-3 animate-spin" />}
                      </span>
                    ) : (
                      <button onClick={() => setEditingDate(true)} className="hover:bg-white/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        {formatDate(selectedProgram.program_date)} <Pencil className="h-3 w-3 opacity-60" />
                      </button>
                    )}
                    {" - "}
                    {editingLeader ? (
                      <span className="inline-flex items-center gap-1">
                        <input value={leaderValue} onChange={(e) => setLeaderValue(e.target.value)} onBlur={handleLeaderSave} onKeyDown={(e) => e.key === "Enter" && handleLeaderSave()} autoFocus className="bg-white/20 border border-white/40 rounded px-2 py-0.5 text-sm w-40 text-white placeholder-white/60 outline-none" placeholder="Dirigente" />
                        {savingField === "leader" && <Loader2 className="h-3 w-3 animate-spin" />}
                      </span>
                    ) : (
                      <button onClick={() => setEditingLeader(true)} className="hover:bg-white/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        {selectedProgram.leader || "Dirigente"} <Pencil className="h-3 w-3 opacity-60" />
                      </button>
                    )}
                  </th>
                </tr>
                <tr>
                  <th className="w-[40px]" style={{ backgroundColor: specialColorLight }}></th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Horário</th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Tempo</th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Atividade</th>
                  <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[140px] md:w-[200px]" style={{ backgroundColor: specialColorLight, color: "#ffffff" }}>Responsável</th>
                  <th className="w-[50px]" style={{ backgroundColor: specialColorLight }}></th>
                  <th className="w-[40px]" style={{ backgroundColor: specialColorLight }}></th>
                </tr>
              </thead>
              <tbody>
                {(selectedProgram.program_items || []).map((item, index) => (
                  <tr key={item.id || `esp-${index}`} className="border-b border-[#c4b8d4] group" style={{ backgroundColor: index % 2 === 0 ? "#e8dff0" : "#f0eaf6" }}>
                    <td className="px-1 py-1 text-center">
                      <button type="button" onClick={() => handleAddRowBelow(index)} className="p-1 rounded hover:bg-white/50 text-[#6b4f8a] transition-colors" title="Adicionar linha abaixo">
                        <Plus className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <EditableCell value={item.time} saving={savingField === `${index}-time`} onSave={(v) => handleCellSave(index, "time", v)} placeholder="Horário" type="time" />
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <EditableCell value={item.duration} saving={savingField === `${index}-duration`} onSave={(v) => handleCellSave(index, "duration", v)} placeholder="Tempo" type="duration" />
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <EditableCell value={item.activity} saving={savingField === `${index}-activity`} onSave={(v) => handleCellSave(index, "activity", v)} placeholder="Atividade" />
                    </td>
                    <td className="px-1 md:px-2 py-1">
                      <EditableCell value={item.responsible} saving={savingField === `${index}-responsible`} onSave={(v) => handleCellSave(index, "responsible", v)} placeholder="Responsável" />
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <button type="button" onClick={() => handleMoveRow(index, "up")} disabled={index === 0} className="p-0.5 rounded hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                        </button>
                        <button type="button" onClick={() => handleMoveRow(index, "down")} disabled={index === (selectedProgram.program_items || []).length - 1} className="p-0.5 rounded hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button type="button" onClick={() => handleDeleteRow(index)} className="text-destructive hover:text-destructive/80 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={handleAddRow} className="w-full py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 border-t border-border flex items-center justify-center gap-1 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Adicionar linha
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════
   Shared Components
   ══════════════════════════════════ */

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function LoadingState() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-40" />
      <p>Carregando programa...</p>
    </div>
  )
}

function ClearButton({ clearing, onClick }: { clearing: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={clearing} size="sm" variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive bg-transparent">
      {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
      Limpar
    </Button>
  )
}

function ExportButton({ exporting, onClick }: { exporting: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={exporting} size="sm" className="gap-1.5">
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exportar PNG
    </Button>
  )
}

function ProgramSelector({ programs, selectedId, onSelect }: { programs: ProgramListItem[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {programs.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
            selectedId === p.id
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted text-foreground"
          }`}
        >
          {formatDate(p.program_date)}
        </button>
      ))}
    </div>
  )
}

function ColumnHeaders({ color }: { color: string }) {
  return (
    <tr>
      <th className="w-[40px]" style={{ backgroundColor: color }}></th>
      <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: color, color: "#ffffff" }}>Horário</th>
      <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[80px] md:w-[100px]" style={{ backgroundColor: color, color: "#ffffff" }}>Tempo</th>
      <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: color, color: "#ffffff" }}>Atividade</th>
      <th className="px-2 md:px-3 py-2 text-left text-[11px] md:text-xs font-bold uppercase tracking-wider w-[140px] md:w-[300px]" style={{ backgroundColor: color, color: "#ffffff" }}>Responsável</th>
      <th className="w-[40px]" style={{ backgroundColor: color }}></th>
    </tr>
  )
}

function HeaderEditable({
  title, date, leader, editingDate, editingLeader, dateValue, leaderValue, savingField,
  setEditingDate, setEditingLeader, setDateValue, setLeaderValue, handleDateSave, handleLeaderSave,
}: {
  title: string; date: string; leader: string
  editingDate: boolean; editingLeader: boolean; dateValue: string; leaderValue: string; savingField: string
  setEditingDate: (v: boolean) => void; setEditingLeader: (v: boolean) => void
  setDateValue: (v: string) => void; setLeaderValue: (v: string) => void
  handleDateSave: () => void; handleLeaderSave: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      <span>{title} -</span>
      {editingDate ? (
        <span className="flex items-center gap-1">
          <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="h-7 text-sm px-2 rounded border border-white/40 bg-white/15 text-white outline-none" onKeyDown={(e) => { if (e.key === "Enter") handleDateSave(); if (e.key === "Escape") setEditingDate(false) }} autoFocus />
          <button type="button" onClick={handleDateSave} className="p-1 rounded hover:bg-white/20" disabled={savingField === "date"}>
            {savingField === "date" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setEditingDate(true)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/15 transition-colors border border-dashed border-white/40">
          <span>{formatDate(date)}</span>
          <Pencil className="h-3 w-3 opacity-70" />
        </button>
      )}
      <span>-</span>
      {editingLeader ? (
        <span className="flex items-center gap-1">
          <input type="text" value={leaderValue} onChange={(e) => setLeaderValue(e.target.value)} className="h-7 w-44 md:w-52 text-sm px-2 rounded border border-white/40 bg-white/15 text-white placeholder:text-white/50 outline-none" placeholder="Dirigentes" onKeyDown={(e) => { if (e.key === "Enter") handleLeaderSave(); if (e.key === "Escape") setEditingLeader(false) }} autoFocus />
          <button type="button" onClick={handleLeaderSave} className="p-1 rounded hover:bg-white/20" disabled={savingField === "leader"}>
            {savingField === "leader" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setEditingLeader(true)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/15 transition-colors border border-dashed border-white/40">
          <span>{leader || "Definir dirigentes"}</span>
          <Pencil className="h-3 w-3 opacity-70" />
        </button>
      )}
    </div>
  )
}

/* Editable cell for Domingo/Quarta where all fields are editable */
function EditableCell({
  value, saving, onSave, placeholder, type,
}: {
  value: string; saving: boolean; onSave: (v: string) => void; placeholder: string; type?: "time" | "duration"
}) {
  const [localValue, setLocalValue] = useState(value)
  const [editing, setEditing] = useState(false)

  useEffect(() => { setLocalValue(value) }, [value])

  function handleSave() {
    let finalValue = localValue
    if (type === "time") finalValue = formatTimeInput(localValue)
    if (type === "duration") finalValue = formatDurationInput(localValue)
    
    if (finalValue !== value) onSave(finalValue)
    setEditing(false)
  }

  if (!editing) {
    const displayValue = type === "time" ? formatTimeInput(value) : type === "duration" ? formatDurationInput(value) : value
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left text-xs md:text-sm py-1.5 px-2 rounded border border-dashed border-gray-300 hover:bg-white/60 transition-all min-h-[34px] flex items-center justify-start gap-1 bg-white/40"
        style={{ color: "#2d3748" }}
      >
        {displayValue ? (
          <span className="flex items-center gap-1">{displayValue}<Pencil className="h-3 w-3 opacity-40 shrink-0" /></span>
        ) : (
          <span className="text-gray-400 italic flex items-center gap-1"><Pencil className="h-3 w-3" />{placeholder}</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={localValue}
        onChange={(e) => {
          let val = e.target.value
          if (type === "time") val = formatTimeInput(val)
          setLocalValue(val)
        }}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setLocalValue(value); setEditing(false) } }}
        className="w-full text-xs md:text-sm py-1.5 px-2 rounded border border-gray-400 bg-white outline-none focus:ring-1 focus:ring-blue-400 text-left"
        autoFocus
        disabled={saving}
      />
      {saving && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />}
    </div>
  )
}

/* ResponsibleCell for Sabado (only responsible editable) */
function ResponsibleCell({
  item, saving, onSave, colorScheme,
}: {
  item: ProgramItem; saving: boolean; onSave: (id: string, value: string) => void; colorScheme: "blue" | "green"
}) {
  const [value, setValue] = useState(item.responsible)
  const [editing, setEditing] = useState(false)

  useEffect(() => { setValue(item.responsible) }, [item.responsible])

  function handleSave() {
    if (value !== item.responsible && item.id) onSave(item.id, value)
    setEditing(false)
  }

  const borderColor = colorScheme === "blue" ? "border-[#3b5998]/40" : "border-[#5a7a3a]/40"
  const hoverBg = colorScheme === "blue" ? "hover:bg-[#3b5998]/10" : "hover:bg-[#5a7a3a]/10"
  const focusBorder = colorScheme === "blue" ? "focus:border-[#3b5998]" : "focus:border-[#5a7a3a]"
  const focusRing = colorScheme === "blue" ? "focus:ring-[#3b5998]/30" : "focus:ring-[#5a7a3a]/30"

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={`w-full text-center text-xs md:text-sm py-1.5 px-2 rounded border border-dashed ${borderColor} ${hoverBg} transition-all min-h-[34px] flex items-center justify-center gap-1 bg-white/50`} style={{ color: "#2d3748" }}>
        {item.responsible ? (
          <span className="flex items-center gap-1">{item.responsible}<Pencil className="h-3 w-3 opacity-40 shrink-0" /></span>
        ) : (
          <span className="text-gray-400 italic flex items-center gap-1"><Pencil className="h-3 w-3" />Preencher</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(item.responsible); setEditing(false) } }}
        className={`w-full text-xs md:text-sm py-1.5 px-2 rounded border ${focusBorder} ${focusRing} bg-white outline-none focus:ring-1 text-center`}
        autoFocus
        disabled={saving}
      />
      {saving && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />}
    </div>
  )
}
