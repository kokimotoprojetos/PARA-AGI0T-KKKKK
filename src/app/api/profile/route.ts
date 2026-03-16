import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json(data || {});
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { notification_number } = await req.json();

  console.log("Upserting profile for user:", userId, "Number:", notification_number);

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ 
      id: userId, 
      notification_number,
      updated_at: new Date().toISOString() 
    })
    .select()
    .single();

  if (error) {
    console.error("Erro Supabase (profiles):", error);
    return new NextResponse(`Erro no banco de dados: ${error.message}`, { status: 500 });
  }

  return NextResponse.json(data);
}
