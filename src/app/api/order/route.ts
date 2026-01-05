import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { order, items, files } = data;

    // Create the order (Document)
    const createdOrder = await prisma.document.create({
      data: {
        type: "ORDER",
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
        // Optionally store orderNumber, orderDate, supplier, currency as custom fields or in a JSON column
      },
      include: { items: true, files: true },
    });

    return NextResponse.json({ success: true, order: createdOrder });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
