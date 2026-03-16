import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('debtors')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { name, phone, email, address } = await req.json();

  const { data, error } = await supabase
    .from('debtors')
    .insert([{ name, phone, email, address, user_id: userId }])
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}
