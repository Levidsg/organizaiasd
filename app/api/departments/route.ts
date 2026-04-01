import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name")

    if (error) {
      console.log("[v0] GET departments error:", error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] GET departments exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("departments")
      .insert({
        name: body.name,
        description: body.description || null,
        color: body.color || "#2563EB",
        director: body.director || null,
      })
      .select()
      .single()

    if (error) {
      console.log("[v0] POST departments error:", error.message, error.code, error.details)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] POST departments exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("departments")
      .update({
        name: body.name,
        description: body.description || null,
        color: body.color || "#2563EB",
        director: body.director || null,
      })
      .eq("id", body.id)
      .select()
      .single()

    if (error) {
      console.log("[v0] PUT departments error:", error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] PUT departments exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    const { error } = await supabase.from("departments").delete().eq("id", id)

    if (error) {
      console.log("[v0] DELETE departments error:", error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.log("[v0] DELETE departments exception:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
