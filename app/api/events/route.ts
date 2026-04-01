import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month")
    const year = searchParams.get("year")
    const departmentId = searchParams.get("department_id")

    let query = supabase
      .from("events")
      .select("*, departments(id, name, color)")
      .order("event_date")

    if (month && month !== "all") query = query.eq("month", parseInt(month))
    if (year && year !== "" && !isNaN(parseInt(year))) query = query.eq("year", parseInt(year))
    if (departmentId && departmentId !== "all") query = query.eq("department_id", departmentId)

    const { data, error } = await query

    if (error) {
      console.log("[v0] GET events error:", error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] GET events exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const eventDate = new Date(body.event_date + "T12:00:00")
    const month = eventDate.getMonth() + 1
    const year = eventDate.getFullYear()

    const insertData: Record<string, unknown> = {
      event_date: body.event_date,
      activity: body.activity,
      event_time: body.event_time || null,
      month,
      year,
    }

    if (body.department_id && body.department_id !== "" && body.department_id !== "none") {
      insertData.department_id = body.department_id
    }

    if (body.is_comissao) {
      insertData.is_comissao = true
    }

    console.log("[v0] POST events insertData:", JSON.stringify(insertData))

    const { data, error } = await supabase
      .from("events")
      .insert(insertData)
      .select("*, departments(id, name, color)")
      .single()

    if (error) {
      console.log("[v0] POST events error:", error.message, error.code, error.details, error.hint)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] POST events exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const eventDate = new Date(body.event_date + "T12:00:00")
    const month = eventDate.getMonth() + 1
    const year = eventDate.getFullYear()

    const updateData: Record<string, unknown> = {
      event_date: body.event_date,
      activity: body.activity,
      event_time: body.event_time || null,
      month,
      year,
    }

    if (body.department_id && body.department_id !== "" && body.department_id !== "none") {
      updateData.department_id = body.department_id
    } else {
      updateData.department_id = null
    }

    updateData.is_comissao = body.is_comissao || false

    const { data, error } = await supabase
      .from("events")
      .update(updateData)
      .eq("id", body.id)
      .select("*, departments(id, name, color)")
      .single()

    if (error) {
      console.log("[v0] PUT events error:", error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] PUT events exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    const { error } = await supabase.from("events").delete().eq("id", id)

    if (error) {
      console.log("[v0] DELETE events error:", error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.log("[v0] DELETE events exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
