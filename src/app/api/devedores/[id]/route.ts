import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name, phone, email } = await req.json();

  const debtor = await prisma.debtor.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: { name, phone, email }
  });

  return NextResponse.json(debtor);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  await prisma.debtor.deleteMany({
    where: { id: params.id, userId: session.user.id }
  });

  return new NextResponse(null, { status: 204 });
}
