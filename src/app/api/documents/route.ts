import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type || (type !== "ORDER" && type !== "INVOICE")) {
      return NextResponse.json(
        { success: false, error: "Type must be ORDER or INVOICE" },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { type: type as "ORDER" | "INVOICE" },
      include: {
        items: true,
        files: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
