import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const updateData: any = { updated_at: new Date().toISOString() };
  
  if (body.amount !== undefined) updateData.amount = body.amount;
  if (body.dueDate) updateData.due_date = body.dueDate;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.status) updateData.status = body.status;
  if (body.debtorId) updateData.debtor_id = body.debtorId;
  if (body.debtTypeId !== undefined) updateData.debt_type_id = body.debtTypeId;

  const { data, error } = await supabase
    .from('debts')
    .update(updateData)
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({
    ...data,
    dueDate: data.due_date,
    debtorId: data.debtor_id,
    debtTypeId: data.debt_type_id
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', session.user.id);

  if (error) return new NextResponse(error.message, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
