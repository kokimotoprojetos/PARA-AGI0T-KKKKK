import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const types = await prisma.debtType.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' }
  });

  return NextResponse.json(types);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name } = await req.json();
  if (!name) return new NextResponse("Name is required", { status: 400 });

  const type = await prisma.debtType.create({
    data: { name, userId: session.user.id }
  });

  return NextResponse.json(type);
}
