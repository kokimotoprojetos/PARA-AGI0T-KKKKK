import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();

  const data: any = {};
  if (body.amount !== undefined) data.amount = body.amount;
  if (body.dueDate) data.dueDate = new Date(body.dueDate);
  if (body.description !== undefined) data.description = body.description;
  if (body.status) data.status = body.status;
  if (body.debtorId) data.debtorId = body.debtorId;

  const debt = await prisma.debt.updateMany({
    where: { id: params.id, debtor: { userId: session.user.id } },
    data
  });

  return NextResponse.json(debt);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  await prisma.debt.deleteMany({
    where: { id: params.id, debtor: { userId: session.user.id } }
  });

  return new NextResponse(null, { status: 204 });
}
