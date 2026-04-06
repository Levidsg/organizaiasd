"use client"

import React from "react"

import { useState } from "react"
import useSWR from "swr"
import { Users, Plus, Pencil, Trash2, Search, LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PRESET_COLORS = [
  "#2563EB", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#0891B2", "#BE185D", "#4F46E5",
]

interface Department {
  id: string
  name: string
  description: string | null
  color: string
  director: string | null
}

export function DepartmentsView() {
  const { data: departments, mutate } = useSWR<Department[]>("/api/departments", fetcher)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ name: "", description: "", color: "#2563EB", director: "" })
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  function openCreate() {
    setEditing(null)
    setForm({ name: "", description: "", color: "#2563EB", director: "" })
    setDialogOpen(true)
  }

  function openEdit(dept: Department) {
    setEditing(dept)
    setForm({ name: dept.name, description: dept.description || "", color: dept.color, director: dept.director || "" })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const method = editing ? "PUT" : "POST"
    const body = editing ? { ...form, id: editing.id } : form

    const res = await fetch("/api/departments", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      toast.success(editing ? "Departamento atualizado!" : "Departamento criado!")
      mutate()
      setDialogOpen(false)
    } else {
      const errData = await res.json().catch(() => ({}))
      console.log("[v0] Department save error:", errData)
      toast.error(`Erro ao salvar: ${errData.error || res.statusText}`)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/departments?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Departamento removido!")
      mutate()
    } else {
      toast.error("Erro ao remover departamento.")
    }
  }

  const filteredDepartments = departments?.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.director && d.director.toLowerCase().includes(search.toLowerCase())) ||
    (d.description && d.description.toLowerCase().includes(search.toLowerCase()))
  ) || []

  return (
    <div className="p-4 md:p-6 w-full">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Departamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os departamentos e ministérios da igreja
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-2">
          <div className="flex w-full sm:max-w-md items-center relative">
            <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar departamentos, titulares ou descrições..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-9" 
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-8 w-9 px-2", viewMode === "grid" && "bg-background shadow-sm")} 
                onClick={() => setViewMode("grid")}
                title="Visualizar em grade"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-8 w-9 px-2", viewMode === "list" && "bg-background shadow-sm")} 
                onClick={() => setViewMode("list")}
                title="Visualizar em lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} size="sm" className="h-9">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Departamento
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome do departamento"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Diretor / Titular</Label>
                  <Input
                    value={form.director}
                    onChange={(e) => setForm({ ...form, director: e.target.value })}
                    placeholder="Nome do diretor (opcional)"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    rows={3}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cor</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm({ ...form, color })}
                        className="w-8 h-8 rounded-lg border-2 transition-all"
                        style={{
                          backgroundColor: color,
                          borderColor: form.color === color ? "hsl(var(--foreground))" : "transparent",
                          transform: form.color === color ? "scale(1.15)" : "scale(1)",
                        }}
                        aria-label={`Selecionar cor ${color}`}
                      />
                    ))}
                    <Input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-8 h-8 p-0 border-0 cursor-pointer"
                    />
                  </div>
                </div>
                <Button type="submit">{editing ? "Atualizar" : "Criar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {!departments || departments.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum departamento cadastrado.</p>
              <p className="text-xs mt-1">Clique em &quot;Novo Departamento&quot; para começar.</p>
            </CardContent>
          </Card>
        ) : filteredDepartments.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum departamento encontrado.</p>
              <p className="text-xs mt-1">Tente buscar por outro termo.</p>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {filteredDepartments.map((dept) => (
              <Card key={dept.id} className="relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: dept.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                      <CardTitle className="text-base text-card-foreground">{dept.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(dept)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(dept.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remover</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  {dept.director && (
                    <p className="text-sm font-medium text-foreground">
                      Titular: {dept.director}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {dept.description || "Sem descrição"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-4">
            {filteredDepartments.map((dept) => (
              <Card key={dept.id} className="relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: dept.color }} />
                <CardContent className="p-4 sm:p-5 flex items-center justify-between pl-5">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                      <span className="font-medium text-base text-card-foreground">{dept.name}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 ml-[1.35rem]">
                      {dept.director && (
                        <p className="text-sm font-medium text-foreground whitespace-nowrap">
                          Titular: <span className="text-muted-foreground ml-1">{dept.director}</span>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">
                        {dept.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dept)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(dept.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remover</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
