import { toast } from "sonner"
import { mutate } from "swr"

export async function logHistory(
  programId: string,
  programType: string,
  userName: string,
  actionType: "updated" | "cleared" | "added" | "deleted",
  description: string
) {
  if (!userName || !programId || !programType) return false;

  try {
    const res = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program_id: programId,
        program_type: programType,
        user_name: userName,
        action_type: actionType,
        description,
      }),
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Unknown error" }))
      
      const errorMessage = data.error || data.message || res.statusText
      
      if (errorMessage && errorMessage.includes("program_history")) {
        toast.error("O Histórico não está ativado! Rode o script SQL no Supabase.")
      } else {
        toast.error(`Falha ao registrar histórico: ${errorMessage}`)
      }
      return false
    }

    // Force all components to refetch the history to show the change immediately!
    mutate((key) => typeof key === "string" && key.startsWith("/api/history"), undefined, { revalidate: true })
    
    return true;
  } catch (err) {
    console.error("Failed to log history exception:", err);
    toast.error("Erro interno ao tentar salvar o histórico.")
    return false;
  }
}
