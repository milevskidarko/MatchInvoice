import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { invoice, items, files } = data;

    // Create the invoice (Document)
    const createdInvoice = await prisma.document.create({
      data: {
        type: "INVOICE",
        userId: "demo-user", // Placeholder, update with real user if auth is added
        items: {
          create: items.map((item: any) => ({
            name: item.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
            vatPercent: item.vat,
          })),
        },
        files: files && Array.isArray(files)
          ? {
              create: files.map((file: any) => ({
                fileName: file.name,
                fileType: file.type,
                storagePath: file.path,
              })),
            }
          : undefined,
      },
      include: { items: true, files: true },
    });

    return NextResponse.json({ success: true, invoice: createdInvoice });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
