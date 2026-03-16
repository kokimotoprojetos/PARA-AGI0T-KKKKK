import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('debt_types')
    .select('*')
    .eq('user_id', session.user.id)
    .order('name', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name } = await req.json();
  if (!name) return new NextResponse("Name is required", { status: 400 });

  const { data, error } = await supabase
    .from('debt_types')
    .insert([{ name, user_id: session.user.id }])
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}
