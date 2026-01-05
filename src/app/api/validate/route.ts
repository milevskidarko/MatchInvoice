import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { orderId, invoiceId } = await request.json();

    if (!orderId || !invoiceId) {
      return NextResponse.json(
        { success: false, error: "Order ID and Invoice ID are required" },
        { status: 400 }
      );
    }

    // Fetch order and invoice with items
    const order = await prisma.document.findUnique({
      where: { id: orderId },
      include: { items: true, files: true },
    });

    const invoice = await prisma.document.findUnique({
      where: { id: invoiceId },
      include: { items: true, files: true },
    });

    if (!order || order.type !== "ORDER") {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (!invoice || invoice.type !== "INVOICE") {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Create or get pair
    let pair = await prisma.documentPair.findFirst({
      where: {
        orderId: orderId,
        invoiceId: invoiceId,
      },
    });

    if (!pair) {
      pair = await prisma.documentPair.create({
        data: {
          orderId: orderId,
          invoiceId: invoiceId,
        },
      });
    }

    // Run validation
    const validationResults = [];
    const summary = {
      itemsStatus: "valid",
      vatStatus: "valid",
      datesStatus: "valid",
      totalsStatus: "valid",
      finalStatus: "valid",
    };

    // 1. Items Validation
    const orderItemsMap = new Map(
      order.items.map((item) => [item.name.toLowerCase().trim(), item])
    );
    const invoiceItemsMap = new Map(
      invoice.items.map((item) => [item.name.toLowerCase().trim(), item])
    );

    // Check for missing items in invoice
    for (const [name, orderItem] of orderItemsMap) {
      if (!invoiceItemsMap.has(name)) {
        validationResults.push({
          category: "items",
          message: `Item "${orderItem.name}" from order is missing in invoice`,
          severity: "error",
        });
        summary.itemsStatus = "error";
      } else {
        const invoiceItem = invoiceItemsMap.get(name)!;
        // Check quantity
        if (Math.abs(orderItem.qty - invoiceItem.qty) > 0.01) {
          validationResults.push({
            category: "items",
            message: `Quantity mismatch for "${orderItem.name}": Order ${orderItem.qty} vs Invoice ${invoiceItem.qty}`,
            severity: "warning",
          });
          if (summary.itemsStatus === "valid") summary.itemsStatus = "warning";
        }
        // Check unit price
        if (Math.abs(orderItem.unitPrice - invoiceItem.unitPrice) > 0.01) {
          validationResults.push({
            category: "items",
            message: `Unit price mismatch for "${orderItem.name}": Order ${orderItem.unitPrice} vs Invoice ${invoiceItem.unitPrice}`,
            severity: "warning",
          });
          if (summary.itemsStatus === "valid") summary.itemsStatus = "warning";
        }
      }
    }

    // Check for extra items in invoice
    for (const [name, invoiceItem] of invoiceItemsMap) {
      if (!orderItemsMap.has(name)) {
        validationResults.push({
          category: "items",
          message: `Extra item "${invoiceItem.name}" in invoice not found in order`,
          severity: "warning",
        });
        if (summary.itemsStatus === "valid") summary.itemsStatus = "warning";
      }
    }

    // 2. VAT Validation
    for (const [name, orderItem] of orderItemsMap) {
      if (invoiceItemsMap.has(name)) {
        const invoiceItem = invoiceItemsMap.get(name)!;
        if (Math.abs(orderItem.vatPercent - invoiceItem.vatPercent) > 0.01) {
          validationResults.push({
            category: "vat",
            message: `VAT mismatch for "${orderItem.name}": Order ${orderItem.vatPercent}% vs Invoice ${invoiceItem.vatPercent}%`,
            severity: "error",
          });
          summary.vatStatus = "error";
        }
      }
    }

    // Calculate totals
    const calculateTotals = (items: typeof order.items) => {
      let subtotal = 0;
      let vatTotal = 0;
      let grandTotal = 0;

      for (const item of items) {
        const itemSubtotal = item.qty * item.unitPrice;
        const itemVat = (itemSubtotal * item.vatPercent) / 100;
        subtotal += itemSubtotal;
        vatTotal += itemVat;
        grandTotal += itemSubtotal + itemVat;
      }

      return { subtotal, vatTotal, grandTotal };
    };

    const orderTotals = calculateTotals(order.items);
    const invoiceTotals = calculateTotals(invoice.items);

    // 3. Totals Validation
    if (Math.abs(orderTotals.subtotal - invoiceTotals.subtotal) > 0.01) {
      validationResults.push({
        category: "totals",
        message: `Subtotal mismatch: Order ${orderTotals.subtotal.toFixed(2)} vs Invoice ${invoiceTotals.subtotal.toFixed(2)}`,
        severity: "error",
      });
      summary.totalsStatus = "error";
    }

    if (Math.abs(orderTotals.vatTotal - invoiceTotals.vatTotal) > 0.01) {
      validationResults.push({
        category: "totals",
        message: `VAT total mismatch: Order ${orderTotals.vatTotal.toFixed(2)} vs Invoice ${invoiceTotals.vatTotal.toFixed(2)}`,
        severity: "error",
      });
      summary.totalsStatus = "error";
    }

    if (Math.abs(orderTotals.grandTotal - invoiceTotals.grandTotal) > 0.01) {
      validationResults.push({
        category: "totals",
        message: `Grand total mismatch: Order ${orderTotals.grandTotal.toFixed(2)} vs Invoice ${invoiceTotals.grandTotal.toFixed(2)}`,
        severity: "error",
      });
      summary.totalsStatus = "error";
    }

    // 4. Dates Validation
    const orderDate = new Date(order.createdAt);
    const invoiceDate = new Date(invoice.createdAt);
    const today = new Date();

    if (invoiceDate < orderDate) {
      validationResults.push({
        category: "dates",
        message: `Invoice date (${invoiceDate.toLocaleDateString()}) is before order date (${orderDate.toLocaleDateString()})`,
        severity: "error",
      });
      summary.datesStatus = "error";
    }

    if (invoiceDate > today) {
      validationResults.push({
        category: "dates",
        message: `Invoice date (${invoiceDate.toLocaleDateString()}) is in the future`,
        severity: "warning",
      });
      if (summary.datesStatus === "valid") summary.datesStatus = "warning";
    }

    if (orderDate > today) {
      validationResults.push({
        category: "dates",
        message: `Order date (${orderDate.toLocaleDateString()}) is in the future`,
        severity: "warning",
      });
      if (summary.datesStatus === "valid") summary.datesStatus = "warning";
    }

    // Determine final status
    if (
      summary.itemsStatus === "error" ||
      summary.vatStatus === "error" ||
      summary.datesStatus === "error" ||
      summary.totalsStatus === "error"
    ) {
      summary.finalStatus = "error";
    } else if (
      summary.itemsStatus === "warning" ||
      summary.vatStatus === "warning" ||
      summary.datesStatus === "warning" ||
      summary.totalsStatus === "warning"
    ) {
      summary.finalStatus = "warning";
    }

    // Save validation results
    await prisma.validationResult.deleteMany({
      where: { pairId: pair.id },
    });

    if (validationResults.length > 0) {
      await prisma.validationResult.createMany({
        data: validationResults.map((result) => ({
          pairId: pair.id,
          category: result.category,
          message: result.message,
          severity: result.severity,
        })),
      });
    }

    // Update or create summary
    await prisma.validationSummary.upsert({
      where: { pairId: pair.id },
      update: summary,
      create: {
        pairId: pair.id,
        ...summary,
      },
    });

    // Fetch complete results
    const completePair = await prisma.documentPair.findUnique({
      where: { id: pair.id },
      include: {
        order: { include: { items: true, files: true } },
        invoice: { include: { items: true, files: true } },
        validations: true,
        summary: true,
      },
    });

    return NextResponse.json({
      success: true,
      pair: completePair,
      totals: {
        order: orderTotals,
        invoice: invoiceTotals,
      },
    });
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
