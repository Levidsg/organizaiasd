"use client";

import React from "react";

import { useState } from "react";
import useSWR from "swr";
import { Calendar, Plus, Pencil, Trash2, AlertTriangle, List, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const MONTHS = [
  { value: "all", label: "Todos os meses" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const MONTH_NAMES: Record<number, string> = {
  1: "Janeiro",
  2: "Fevereiro",
  3: "Março",
  4: "Abril",
  5: "Maio",
  6: "Junho",
  7: "Julho",
  8: "Agosto",
  9: "Setembro",
  10: "Outubro",
  11: "Novembro",
  12: "Dezembro",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Department {
  id: string;
  name: string;
  color: string;
}

interface EventItem {
  id: string;
  month: number;
  event_date: string;
  event_time: string | null;
  activity: string;
  department_id: string | null;
  year: number;
  departments: Department | null;
  is_comissao: boolean;
}

export function AgendaView() {
  const currentYear = new Date().getFullYear();
  const currentMonth = (new Date().getMonth() + 1).toString();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState({
    event_date: "",
    event_time: "",
    activity: "",
    department_id: "",
    is_comissao: false,
  });
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [forceCreate, setForceCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");

  const { data: departments } = useSWR<Department[]>(
    "/api/departments",
    fetcher,
  );
  const { data: events, mutate } = useSWR<EventItem[]>(
    `/api/events?month=${selectedMonth}&year=${selectedYear}&department_id=${selectedDept}`,
    fetcher,
  );

  // Fetch ALL events for conflict detection (no filters)
  const { data: allEvents } = useSWR<EventItem[]>(
    "/api/events?month=all&year=&department_id=all",
    fetcher,
  );

  function checkConflict(date: string) {
    if (!date || !allEvents) {
      setConflictWarning(null);
      return;
    }
    const sameDateEvents = allEvents.filter(
      (ev) =>
        ev.event_date === date && (!editingEvent || ev.id !== editingEvent.id),
    );
    if (sameDateEvents.length > 0) {
      const deptNames = sameDateEvents
        .map((ev) => ev.departments?.name || "Sem departamento")
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(", ");
      const activities = sameDateEvents.map((ev) => ev.activity).join("; ");
      setConflictWarning(
        `Já existe(m) evento(s) nesta data: "${activities}" (${deptNames}). Deseja agendar mesmo assim?`,
      );
    } else {
      setConflictWarning(null);
    }
    setForceCreate(false);
  }

  function openCreate() {
    setEditingEvent(null);
    setForm({
      event_date: "",
      event_time: "",
      activity: "",
      department_id: "",
      is_comissao: false,
    });
    setConflictWarning(null);
    setForceCreate(false);
    setDialogOpen(true);
  }

  function openEdit(event: EventItem) {
    setEditingEvent(event);
    setForm({
      event_date: event.event_date,
      event_time: event.event_time || "",
      activity: event.activity,
      department_id: event.department_id || "",
      is_comissao: event.is_comissao || false,
    });
    setConflictWarning(null);
    setForceCreate(false);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editingEvent ? "PUT" : "POST";
    const body = editingEvent ? { ...form, id: editingEvent.id } : form;
    console.log(
      "[v0] Submitting event with is_comissao:",
      form.is_comissao,
      "body:",
      JSON.stringify(body),
    );

    const res = await fetch("/api/events", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(editingEvent ? "Evento atualizado!" : "Evento criado!");
      mutate();
      setDialogOpen(false);
    } else {
      const errData = await res.json().catch(() => ({}));
      console.log("[v0] Event save error:", errData);
      toast.error(`Erro ao salvar: ${errData.error || res.statusText}`);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Evento removido!");
      mutate();
    } else {
      toast.error("Erro ao remover evento.");
    }
  }

  // Group events by month for display
  const groupedEvents: Record<number, EventItem[]> = {};
  if (events) {
    for (const event of events) {
      if (!groupedEvents[event.month]) groupedEvents[event.month] = [];
      groupedEvents[event.month].push(event);
    }
  }

  const sortedMonths = Object.keys(groupedEvents)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="p-4 md:p-6 w-full">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Agenda da Igreja
          </h1>
          <p className="text-sm text-muted-foreground">
            Eventos e atividades organizados por mês e departamento
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg text-card-foreground">
                Eventos
              </CardTitle>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map(
                      (y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os departamentos</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("h-8 w-9 px-2", viewMode === "list" && "bg-background shadow-sm")} 
                    onClick={() => setViewMode("list")}
                    title="Visualizar em lista"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("h-8 w-9 px-2", viewMode === "calendar" && "bg-background shadow-sm")} 
                    onClick={() => setViewMode("calendar")}
                    title="Visualizar em calendário"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreate} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo Evento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingEvent ? "Editar Evento" : "Novo Evento"}
                      </DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-2">
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={form.event_date}
                          onChange={(e) => {
                            setForm({ ...form, event_date: e.target.value });
                            checkConflict(e.target.value);
                          }}
                          required
                        />
                      </div>
                      {conflictWarning && !forceCreate && (
                        <Alert className="border-amber-400 bg-amber-50">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 text-sm">
                            {conflictWarning}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="ml-2 mt-1 border-amber-400 text-amber-700 hover:bg-amber-100 hover:text-amber-800 bg-transparent"
                              onClick={() => setForceCreate(true)}
                            >
                              Sim, agendar mesmo assim
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex flex-col gap-2">
                        <Label>Horário</Label>
                        <Input
                          type="time"
                          value={form.event_time}
                          onChange={(e) =>
                            setForm({ ...form, event_time: e.target.value })
                          }
                          placeholder="Horário (opcional)"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Evento / Atividade</Label>
                        <Input
                          value={form.activity}
                          onChange={(e) =>
                            setForm({ ...form, activity: e.target.value })
                          }
                          placeholder="Descrição do evento"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Departamento</Label>
                        <Select
                          value={form.department_id || undefined}
                          onValueChange={(v) =>
                            setForm({ ...form, department_id: v })
                          }
                          disabled={form.is_comissao}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments?.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button
                        type="button"
                        className={`flex items-center text-left w-full gap-3 p-3 rounded-md border-2 transition-all ${
                          form.is_comissao
                            ? "border-red-500 bg-red-50 dark:bg-red-950"
                            : "border-input hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          const isNowComissao = !form.is_comissao;
                          setForm({
                            ...form,
                            is_comissao: isNowComissao,
                            department_id: isNowComissao
                              ? ""
                              : form.department_id,
                            activity: isNowComissao
                              ? "Comissão"
                              : form.activity === "Comissão"
                                ? ""
                                : form.activity,
                          });
                        }}
                      >
                        <div
                          className={`p-2 rounded-full ${form.is_comissao ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"}`}
                        >
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col flex-1">
                          <span
                            className={`font-semibold ${form.is_comissao ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
                          >
                            Destacar Prioridade Máxima (Comissão)
                          </span>
                          <span className="text-xs text-muted-foreground">
                            O evento ficará destacado em vermelho na lista
                            principal.
                          </span>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex flex-shrink-0 items-center justify-center ${form.is_comissao ? "border-red-500 bg-red-500" : "border-muted-foreground/30"}`}
                        >
                          {form.is_comissao && (
                            <div className="h-2.5 w-2.5 bg-white rounded-full" />
                          )}
                        </div>
                      </button>
                      <Button
                        type="submit"
                        className="w-full mt-2"
                        disabled={!!conflictWarning && !forceCreate}
                      >
                        {editingEvent ? "Atualizar Evento" : "Criar Evento"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedMonths.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum evento encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {sortedMonths.map((month) => {
                  const year = Number(selectedYear);
                  const daysInMonth = new Date(year, month, 0).getDate();
                  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
                  const blanks = Array.from({ length: firstDayOfMonth }, () => null);
                  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                  const calendarCells = [...blanks, ...days];
                  
                  return (
                    <div key={month}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-1 rounded-full bg-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                          {MONTH_NAMES[month]}
                        </h3>
                      </div>
                      
                      {viewMode === "calendar" ? (
                        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                            <div key={day} className="bg-muted p-2 sm:p-3 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {day}
                            </div>
                          ))}
                          {calendarCells.map((day, idx) => {
                            if (!day) return <div key={`blank-${idx}`} className="bg-muted/10 min-h-[100px] p-2" />;
                            
                            const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayEvents = groupedEvents[month]?.filter(e => e.event_date === dateString) || [];
                            const isToday = new Date().toISOString().split('T')[0] === dateString;
                            
                            return (
                              <div key={`day-${day}`} className={cn("bg-card min-h-[100px] p-1.5 sm:p-2 flex flex-col gap-1 transition-colors border-t border-border focus-within:ring-2 relative group", isToday && "bg-primary/5")}>
                                <div className="flex justify-between items-start">
                                  <span className={cn("text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1", isToday ? "bg-primary text-primary-foreground" : "text-foreground/80")}>
                                    {day}
                                  </span>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                    openCreate();
                                    setForm(prev => ({ ...prev, event_date: dateString }));
                                  }}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex flex-col gap-1 w-full overflow-hidden">
                                  {dayEvents.map(event => (
                                    <div 
                                      key={event.id} 
                                      onClick={() => openEdit(event)} 
                                      className={cn(
                                        "text-[10px] sm:text-xs truncate px-1.5 py-1.5 rounded cursor-pointer border shadow-sm transition-all hover:scale-[1.02]", 
                                        event.is_comissao 
                                          ? "bg-red-100 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 font-bold" 
                                          : event.departments 
                                            ? "bg-muted/50 border-border font-medium" 
                                            : "bg-background border-border"
                                      )}
                                      title={`${event.event_time || ''} - ${event.activity}${event.departments ? ` (${event.departments.name})` : ''}`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {event.departments && !event.is_comissao && (
                                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: event.departments.color }} />
                                        )}
                                        <div className="flex flex-col leading-tight truncate">
                                          <span className="truncate">{event.activity}</span>
                                          {event.event_time && <span className="opacity-70 text-[9px]">{event.event_time}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-[90px] text-foreground font-semibold">
                                  Mês
                                </TableHead>
                                <TableHead className="w-[100px] text-foreground font-semibold">
                                  Data
                                </TableHead>
                                <TableHead className="w-[80px] text-foreground font-semibold">
                                  Horário
                                </TableHead>
                                <TableHead className="text-foreground font-semibold">
                                  Evento / Atividade
                                </TableHead>
                                <TableHead className="w-[180px] text-foreground font-semibold">
                                  Departamento
                                </TableHead>
                                <TableHead className="w-[100px] text-foreground font-semibold text-right">
                                  Ações
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupedEvents[month].map((event) => (
                                <TableRow
                                  key={event.id}
                                  className={
                                    event.is_comissao
                                      ? "bg-red-500/10 hover:bg-red-500/20 border-l-4 border-l-red-500"
                                      : "hover:bg-muted/30"
                                  }
                                >
                                  <TableCell className="text-sm text-muted-foreground">
                                    {MONTH_NAMES[event.month]}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium text-foreground">
                                    {new Date(
                                      event.event_date + "T12:00:00",
                                    ).toLocaleDateString("pt-BR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                    })}
                                  </TableCell>
                                  <TableCell className="text-sm text-foreground">
                                    {event.event_time || "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-foreground">
                                    {event.activity}
                                  </TableCell>
                                  <TableCell>
                                    {event.is_comissao ? (
                                      <Badge
                                        variant="secondary"
                                        className="border bg-red-100 text-red-800 border-red-300 font-semibold"
                                      >
                                        Comissão
                                      </Badge>
                                    ) : event.departments ? (
                                      <Badge
                                        variant="outline"
                                        style={{
                                          backgroundColor: `${event.departments.color}15`,
                                          borderColor: `${event.departments.color}40`,
                                        }}
                                        className="border text-foreground font-medium"
                                      >
                                        <span 
                                          className="w-2 h-2 rounded-full mr-1.5 inline-block" 
                                          style={{ backgroundColor: event.departments.color }} 
                                        />
                                        {event.departments.name}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEdit(event)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="sr-only">Editar</span>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(event.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="sr-only">Remover</span>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
