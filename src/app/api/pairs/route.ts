import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const pairs = await prisma.documentPair.findMany({
      include: {
        order: {
          include: { items: true, files: true },
        },
        invoice: {
          include: { items: true, files: true },
        },
        validations: true,
        summary: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, pairs });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
