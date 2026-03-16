import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name, phone, email, address } = await req.json();

  const { data, error } = await supabase
    .from('debtors')
    .update({ name, phone, email, address, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { error } = await supabase
    .from('debtors')
    .delete()
    .eq('id', params.id)
    .eq('user_id', session.user.id);

  if (error) return new NextResponse(error.message, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
