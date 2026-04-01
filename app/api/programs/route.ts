import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const { data, error } = await supabase
        .from("programs")
        .select("*, program_items(*)")
        .eq("id", id)
        .order("sort_order", { referencedTable: "program_items" })
        .single()

      if (error) {
        console.log("[v0] GET program by id error:", error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data)
    }

    const programType = searchParams.get("program_type")

    let query = supabase.from("programs").select("*")
    if (programType) query = query.eq("program_type", programType)

    const { data, error } = await query.order("program_date", { ascending: false })

    if (error) {
      console.log("[v0] GET programs error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] GET programs exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data: program, error: programError } = await supabase
      .from("programs")
      .insert({
        title: body.title,
        program_date: body.program_date,
        leader: body.leader,
        program_type: body.program_type || "sabado",
      })
      .select()
      .single()

    if (programError) {
      console.log("[v0] POST programs error:", programError.message)
      return NextResponse.json({ error: programError.message }, { status: 500 })
    }

    if (body.items && body.items.length > 0) {
      const items = body.items.map((item: Record<string, unknown>, index: number) => ({
        program_id: program.id,
        section: item.section || "Culto Divino",
        time: item.time || "",
        duration: item.duration || "",
        activity: item.activity || "",
        responsible: item.responsible || "",
        sort_order: index,
      }))

      const { error: itemsError } = await supabase.from("program_items").insert(items)
      if (itemsError) {
        console.log("[v0] POST program_items error:", itemsError.message)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    const { data } = await supabase
      .from("programs")
      .select("*, program_items(*)")
      .eq("id", program.id)
      .order("sort_order", { referencedTable: "program_items" })
      .single()

    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] POST programs exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    console.log("[v0] PUT programs body:", JSON.stringify({ id: body.id, title: body.title, leader: body.leader, itemsCount: body.items?.length }))

    const { error: programError } = await supabase
      .from("programs")
      .update({
        title: body.title,
        program_date: body.program_date,
        leader: body.leader,
      })
      .eq("id", body.id)

    if (programError) {
      console.log("[v0] PUT programs error:", programError.message)
      return NextResponse.json({ error: programError.message }, { status: 500 })
    }

    // Delete existing items and re-insert
    const { error: deleteError } = await supabase.from("program_items").delete().eq("program_id", body.id)
    if (deleteError) {
      console.log("[v0] DELETE program_items error:", deleteError.message)
    }

    if (body.items && body.items.length > 0) {
      const items = body.items.map((item: Record<string, unknown>, index: number) => ({
        program_id: body.id,
        section: item.section || "Culto Divino",
        time: item.time || "",
        duration: item.duration || "",
        activity: item.activity || "",
        responsible: item.responsible || "",
        sort_order: index,
      }))

      const { error: itemsError } = await supabase.from("program_items").insert(items)
      if (itemsError) {
        console.log("[v0] PUT program_items insert error:", itemsError.message, itemsError.details)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    const { data } = await supabase
      .from("programs")
      .select("*, program_items(*)")
      .eq("id", body.id)
      .order("sort_order", { referencedTable: "program_items" })
      .single()

    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] PUT programs exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    await supabase.from("program_items").delete().eq("program_id", id)
    const { error } = await supabase.from("programs").delete().eq("id", id)

    if (error) {
      console.log("[v0] DELETE programs error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.log("[v0] DELETE programs exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
