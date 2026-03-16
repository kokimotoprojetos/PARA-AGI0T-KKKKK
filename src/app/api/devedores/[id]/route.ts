import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { name, phone, email, address } = await req.json();

  const { data, error } = await supabase
    .from('debtors')
    .update({ name, phone, email, address, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { error } = await supabase
    .from('debtors')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId);

  if (error) return new NextResponse(error.message, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
