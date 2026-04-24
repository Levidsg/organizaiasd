import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get("program_id")

    if (!programId) {
      return NextResponse.json({ error: "program_id is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("program_history")
      .select("*")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })
      .limit(10) // Show last 10 changes

    if (error) {
      console.log("[v0] GET history error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] GET history exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    if (!body.program_id || !body.program_type || !body.user_name || !body.action_type || !body.description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Insert anonymously (relies on RLS policy to allow insert)
    const { data, error } = await supabase
      .from("program_history")
      .insert({
        program_id: body.program_id,
        program_type: body.program_type,
        user_name: body.user_name,
        action_type: body.action_type,
        description: body.description,
      })
      .select()
      .single()

    if (error) {
      console.log("[v0] POST history error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] POST history exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
