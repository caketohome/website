import * as ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: "text" | "number" | "currency" | "percentage" | "date";
}

export interface ExcelSheetData {
  name: string;
  title?: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, any>;
}

export class ExcelExportService {
  /**
   * Helper to trigger browser blob download
   */
  public static triggerBrowserDownload(buffer: ArrayBuffer, filename: string): void {
    if (typeof window !== "undefined") {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  public static formatBranchSubtitle(filters?: any): string {
    const bIds = filters?.branchIds;
    if (!bIds || bIds.length === 0) {
      return "All Operating Branches";
    }
    if (bIds.length === 1) {
      return `Branch: ${bIds[0]}`;
    }
    return `Branches: ${bIds.length} Selected`;
  }

  // 1. DEDICATED GST SUMMARY EXPORT
  public static async exportGstSummary(data: { kpis: any[]; salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GST Summary");
    sheet.views = [{ showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:E1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = `EXECUTIVE GST SUMMARY REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:"; sheet.getCell("B4").value = "29AAAAA0000A1Z5";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => sheet.getCell(ref).font = { bold: true });

    sheet.getRow(6).values = ["GST KPI Metric", "Amount (₹) / Count"];
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    let rIdx = 7;
    (data.kpis || []).forEach((k) => {
      sheet.getCell(`A${rIdx}`).value = k.label;
      const c = sheet.getCell(`B${rIdx}`);
      c.value = k.currentValue;
      c.numFmt = k.unit === "currency" ? "₹#,##0.00" : "#,##0";
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      rIdx++;
    });

    sheet.columns = [{ width: 36 }, { width: 24 }, { width: 16 }, { width: 16 }, { width: 22 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GST_Summary_Report_${fromDate}_to_${toDate}`);
  }

  // 2. DEDICATED INVOICE REGISTER EXPORT
  public static async exportInvoiceRegister(data: { invoiceRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Invoice Register");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:N1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:N2");
    sheet.getCell("A2").value = `TAX INVOICE REGISTER | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:"; sheet.getCell("B4").value = "29AAAAA0000A1Z5";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => sheet.getCell(ref).font = { bold: true });

    const headers = ["Invoice Number", "Invoice Date", "Order Number", "Customer Name", "Customer GSTIN", "Branch Name", "Place of Supply", "Taxable Amount", "CGST", "SGST", "IGST", "Total GST", "Invoice Total", "Status"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    if (data.invoiceRegister && data.invoiceRegister.length > 0) {
      data.invoiceRegister.forEach((r: any) => {
        const taxable = r.taxableAmount || r.taxableValue || Math.round((r.netAmount || r.netSales || 0) / 1.05);
        const cgst = r.cgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const sgst = r.sgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const igst = r.igst || 0;
        const totalTax = cgst + sgst + igst;
        const totalValue = r.netAmount || r.netSales || (taxable + totalTax);

        const row = sheet.addRow([
          r.invoiceNumber || r.id,
          r.orderDate || r.deliveryDate || fromDate,
          r.id,
          r.customerName || "Walk-in Customer",
          r.customerGstin || "URP (Unregistered)",
          r.branchName || "Main Kitchen Hub",
          "29 - Karnataka",
          taxable,
          cgst,
          sgst,
          igst,
          totalTax,
          totalValue,
          r.orderStatus || r.paymentStatus || "DELIVERED",
        ]);

        [8, 9, 10, 11, 12, 13].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
      });
    } else {
      const emptyRow = sheet.addRow(["No transactions found for the selected period and operating branches."]);
      sheet.mergeCells(`A7:N7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 22 }, { width: 16 }, { width: 20 }, { width: 24 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 14 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Invoice_Register_${fromDate}_to_${toDate}`);
  }

  // 3. DEDICATED GST TRANSACTIONS EXPORT
  public static async exportGstTransactions(data: { salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GST Transactions");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:S1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:S2");
    sheet.getCell("A2").value = `GST DETAILED TRANSACTION REGISTER | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:"; sheet.getCell("B4").value = "29AAAAA0000A1Z5";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");

    const headers = ["Invoice Date", "Invoice Number", "Order Number", "Customer Name", "Customer GSTIN", "Place of Supply", "Branch Name", "Product Name", "HSN / SAC", "UQC", "Quantity", "Unit Price", "Taxable Value", "GST Rate %", "CGST", "SGST", "IGST", "Total GST", "Invoice Total"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    if (data.salesRegister && data.salesRegister.length > 0) {
      data.salesRegister.forEach((r: any) => {
        const taxable = r.taxableValue || Math.round((r.netAmount || r.netSales || 0) / 1.05);
        const cgst = r.cgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const sgst = r.sgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const igst = r.igst || 0;
        const totalTax = cgst + sgst + igst;
        const totalValue = r.netAmount || r.netSales || (taxable + totalTax);

        const row = sheet.addRow([
          r.orderDate || r.deliveryDate || fromDate,
          r.invoiceNumber || r.id,
          r.id,
          r.customerName || "Walk-in Customer",
          r.customerGstin || "URP",
          "29 - Karnataka",
          r.branchName || "Main Kitchen Hub",
          r.productNames || "Bakery Product",
          r.hsnCode || "19059090",
          "NOS",
          r.itemCount || 1,
          taxable,
          taxable,
          0.05,
          cgst,
          sgst,
          igst,
          totalTax,
          totalValue,
        ]);

        [12, 13, 15, 16, 17, 18, 19].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
        row.getCell(14).numFmt = "0.00%";
        row.getCell(11).numFmt = "#,##0";
      });
    } else {
      const emptyRow = sheet.addRow(["No transactions found for the selected period and operating branches."]);
      sheet.mergeCells(`A7:S7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 15 }, { width: 22 }, { width: 20 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 24 }, { width: 30 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GST_Transactions_${fromDate}_to_${toDate}`);
  }

  // DEDICATED BRANCH PERFORMANCE EXPORT
  public static async exportBranchPerformance(data: { branchPerformance: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Branch Performance");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-07-01";
    const toDate = data.filters?.customEndDate || "2026-07-31";

    sheet.mergeCells("A1:L1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:L2");
    sheet.getCell("A2").value = `MULTI-BRANCH OPERATIONAL PERFORMANCE & FINANCIAL RANKING | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:"; sheet.getCell("B4").value = "29AAAAA0000A1Z5";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => sheet.getCell(ref).font = { bold: true });

    const headers = [
      "Rank",
      "Branch Name",
      "Hub Code",
      "Total Orders",
      "Delivered",
      "Cancelled",
      "Gross Sales (₹)",
      "Net Sales (₹)",
      "Gross Profit (₹)",
      "Margin %",
      "AOV (₹)",
      "On-Time %",
    ];

    const headerRow = sheet.getRow(6);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    if (data.branchPerformance && data.branchPerformance.length > 0) {
      data.branchPerformance.forEach((b: any, idx: number) => {
        const row = sheet.addRow([
          idx + 1,
          b.branchName,
          b.branchCode,
          b.ordersCount || 0,
          b.deliveredCount || 0,
          b.cancelledCount || 0,
          b.grossSales || 0,
          b.netSales || 0,
          b.grossProfit || 0,
          (b.marginPct || 0) / 100,
          b.aov || 0,
          (b.onTimeDeliveryPct || 0) / 100,
        ]);

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "center" };
        [4, 5, 6].forEach((colIdx) => (row.getCell(colIdx).numFmt = "#,##0"));
        [7, 8, 9, 11].forEach((colIdx) => (row.getCell(colIdx).numFmt = "₹#,##0.00"));
        row.getCell(10).numFmt = "0.00%";
        row.getCell(12).numFmt = "0.00%";
      });
    } else {
      const emptyRow = sheet.addRow(["No branch performance records found for the selected filter criteria."]);
      sheet.mergeCells(`A7:L7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [
      { width: 10 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 },
      { width: 16 }, { width: 14 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Branch_Performance_${fromDate}_to_${toDate}`);
  }

  // DEDICATED DELIVERY FLEET EXPORT
  public static async exportDeliveryFleet(data: { deliveryData: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Delivery & Fleet");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-07-01";
    const toDate = data.filters?.customEndDate || "2026-07-31";

    sheet.mergeCells("A1:I1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:I2");
    sheet.getCell("A2").value = `CAKETOHOME OWN FLEET DELIVERY & OPERATIONAL SLA REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "Fleet Model:"; sheet.getCell("B4").value = "CakeToHome Dedicated Fleet (Own Riders)";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => sheet.getCell(ref).font = { bold: true });

    const headers = [
      "Driver / Rider Name",
      "Rider Number",
      "Assigned Kitchen Hub",
      "Status",
      "Assigned Deliveries",
      "On-Time Deliveries",
      "Delayed Deliveries",
      "Avg Fulfillment (Mins)",
      "Rating",
    ];

    const headerRow = sheet.getRow(6);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    const partners = data.deliveryData?.partners || [];
    if (partners && partners.length > 0) {
      partners.forEach((p: any) => {
        const row = sheet.addRow([
          p.driverName || p.partner || "CakeToHome Rider",
          p.partnerNumber || p.id || "CTH-DP-100",
          p.branchName || "Indiranagar Kitchen Hub",
          p.status || "ONLINE",
          p.total || 0,
          p.onTime || 0,
          p.delayed || 0,
          p.avgMins || 25,
          p.rating || 4.8,
        ]);

        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(4).alignment = { horizontal: "center" };
        [5, 6, 7, 8].forEach((colIdx) => (row.getCell(colIdx).numFmt = "#,##0"));
        row.getCell(9).numFmt = "0.0";
      });
    } else {
      const emptyRow = sheet.addRow(["No delivery partner records found for the selected filter criteria."]);
      sheet.mergeCells(`A7:I7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [
      { width: 28 }, { width: 16 }, { width: 28 }, { width: 14 }, { width: 20 },
      { width: 20 }, { width: 20 }, { width: 22 }, { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Delivery_Fleet_${fromDate}_to_${toDate}`);
  }

  // 4. DEDICATED B2B SALES EXPORT
  public static async exportB2B(data: { salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("B2B Sales");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:P1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:P2");
    sheet.getCell("A2").value = `REGISTERED B2B SALES TAX REGISTER | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const b2bOrders = (data.salesRegister || []).filter((r) => r.customerGstin && r.customerGstin !== "URP" && r.customerGstin.length === 15);
    const headers = ["Invoice Date", "Invoice Number", "Order Number", "Customer Legal Name", "Customer GSTIN", "Place of Supply", "Branch Name", "HSN / SAC", "UQC", "Quantity", "Taxable Value", "GST Rate %", "CGST", "SGST", "IGST", "Invoice Total"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    if (b2bOrders.length > 0) {
      b2bOrders.forEach((r: any) => {
        const taxable = r.taxableValue || Math.round((r.netAmount || r.netSales || 0) / 1.05);
        const cgst = r.cgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const sgst = r.sgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const igst = r.igst || 0;
        const totalValue = r.netAmount || r.netSales || (taxable + cgst + sgst + igst);

        const row = sheet.addRow([
          r.orderDate || r.deliveryDate || fromDate,
          r.invoiceNumber || r.id,
          r.id,
          r.customerName || "Corporate Client",
          r.customerGstin,
          "29 - Karnataka",
          r.branchName || "Main Kitchen Hub",
          r.hsnCode || "19059090",
          "NOS",
          r.itemCount || 1,
          taxable,
          0.05,
          cgst,
          sgst,
          igst,
          totalValue,
        ]);

        [11, 13, 14, 15, 16].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
        row.getCell(12).numFmt = "0.00%";
      });
    } else {
      const emptyRow = sheet.addRow(["No B2B registered corporate transactions found for the selected period."]);
      sheet.mergeCells(`A7:P7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 15 }, { width: 22 }, { width: 20 }, { width: 26 }, { width: 18 }, { width: 18 }, { width: 24 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_B2B_Sales_${fromDate}_to_${toDate}`);
  }

  // 5. DEDICATED B2C SALES EXPORT
  public static async exportB2C(data: { salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("B2C Sales");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:O1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:O2");
    sheet.getCell("A2").value = `CONSUMER B2C SALES TAX REGISTER | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const b2cOrders = (data.salesRegister || []).filter((r) => !r.customerGstin || r.customerGstin === "URP" || r.customerGstin.length !== 15);
    const headers = ["Invoice Date", "Invoice Number", "Order Number", "Customer Name", "Place of Supply", "Branch Name", "HSN / SAC", "UQC", "Quantity", "Taxable Value", "GST Rate %", "CGST", "SGST", "IGST", "Invoice Total"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    if (b2cOrders.length > 0) {
      b2cOrders.forEach((r: any) => {
        const taxable = r.taxableValue || Math.round((r.netAmount || r.netSales || 0) / 1.05);
        const cgst = r.cgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const sgst = r.sgst || Math.round(((r.netAmount || r.netSales || 0) - taxable) / 2);
        const igst = r.igst || 0;
        const totalValue = r.netAmount || r.netSales || (taxable + cgst + sgst + igst);

        const row = sheet.addRow([
          r.orderDate || r.deliveryDate || fromDate,
          r.invoiceNumber || r.id,
          r.id,
          r.customerName || "Consumer Walk-in",
          "29 - Karnataka",
          r.branchName || "Main Kitchen Hub",
          r.hsnCode || "19059090",
          "NOS",
          r.itemCount || 1,
          taxable,
          0.05,
          cgst,
          sgst,
          igst,
          totalValue,
        ]);

        [10, 12, 13, 14, 15].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
        row.getCell(11).numFmt = "0.00%";
      });
    } else {
      const emptyRow = sheet.addRow(["No B2C consumer transactions found for the selected period."]);
      sheet.mergeCells(`A7:O7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 15 }, { width: 22 }, { width: 20 }, { width: 24 }, { width: 18 }, { width: 24 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_B2C_Sales_${fromDate}_to_${toDate}`);
  }

  // 6. DEDICATED CREDIT NOTES EXPORT
  public static async exportCreditNotes(data: { creditNotes?: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Credit Notes");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").value = `CREDIT NOTES & REFUNDS REGISTER | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["Credit Note No", "Credit Note Date", "Original Invoice No", "Customer Name", "Reason", "Taxable Refund", "CGST Refund", "SGST Refund", "IGST Refund", "Total Refund Value"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    if (data.creditNotes && data.creditNotes.length > 0) {
      data.creditNotes.forEach((cn: any) => {
        const row = sheet.addRow([
          cn.creditNoteNo || cn.id,
          cn.date || fromDate,
          cn.invoiceNo || "CTH-INV-001",
          cn.customerName || "Customer",
          cn.reason || "Order Cancellation",
          cn.taxable || 0,
          cn.cgst || 0,
          cn.sgst || 0,
          cn.igst || 0,
          cn.totalRefund || 0,
        ]);
        [6, 7, 8, 9, 10].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
      });
    } else {
      const emptyRow = sheet.addRow(["No credit notes or refund adjustments were issued during the selected period."]);
      sheet.mergeCells(`A7:J7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 22 }, { width: 16 }, { width: 22 }, { width: 24 }, { width: 24 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Credit_Notes_${fromDate}_to_${toDate}`);
  }

  // 7. DEDICATED HSN SUMMARY EXPORT (ACCOUNTING REFERENCE FORMAT)
  public static async exportHsnSummary(data: { hsnSummary: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("HSN Summary");
    sheet.views = [{ showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value = `HSN / SAC SUMMARY REPORT | Period: ${fromDate} to ${toDate} | Branch: ${data.filters?.branchIds?.join(", ") || "All Kitchen Hubs"}`;
    sheet.getCell("A2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:"; sheet.getCell("B4").value = "29AAAAA0000A1Z5";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => sheet.getCell(ref).font = { bold: true });

    const headers = ["HSNCODE", "Description", "UQC", "Total QTY", "TOTAL VALUE", "GST %", "Taxable Amt", "IGST", "CGST", "SGST", "CESS"];
    const headerRow = sheet.getRow(6);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    if (data.hsnSummary && data.hsnSummary.length > 0) {
      data.hsnSummary.forEach((r: any) => {
        const row = sheet.addRow([
          r.hsnCode,
          r.description,
          r.uom || r.uqc || "NOS",
          r.quantity || 0,
          r.totalValue || 0,
          (r.gstRatePct || 0) / 100,
          r.taxableValue || 0,
          r.igst || 0,
          r.cgst || 0,
          r.sgst || 0,
          r.cess || 0,
        ]);

        row.getCell(4).numFmt = "#,##0";
        row.getCell(5).numFmt = "₹#,##0.00";
        row.getCell(6).numFmt = "0.00%";
        [7, 8, 9, 10, 11].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
      });

      const totRowIdx = data.hsnSummary.length + 7;
      const totRow = sheet.addRow({});
      totRow.getCell(1).value = "TOTAL";
      totRow.font = { bold: true };
      totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

      [4, 5, 7, 8, 9, 10, 11].forEach((colIdx) => {
        const colLetter = String.fromCharCode(64 + colIdx);
        const cell = totRow.getCell(colIdx);
        cell.value = { formula: `SUM(${colLetter}7:${colLetter}${totRowIdx - 1})` };
        cell.numFmt = colIdx === 4 ? "#,##0" : "₹#,##0.00";
      });
    } else {
      const emptyRow = sheet.addRow(["No transactions found for the selected period and operating branches."]);
      sheet.mergeCells(`A7:K7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [
      { width: 16 }, { width: 32 }, { width: 12 }, { width: 14 }, { width: 20 },
      { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_HSN_Summary_Report_${fromDate}_to_${toDate}`);
  }

  // 8. DEDICATED TAX SUMMARY EXPORT
  public static async exportTaxSummary(data: { taxSummary?: any[]; salesRegister?: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tax Summary");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value = `STATUTORY TAX MASTER SUMMARY REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    if (data.taxSummary && data.taxSummary.length > 0) {
      const headers = [
        "Tax Configuration Name",
        "Tax Code",
        "Taxability",
        "GST Rate %",
        "Taxable Value",
        "CGST Amount",
        "SGST Amount",
        "IGST Amount",
        "Cess Amount",
        "Total Tax Amount",
        "Gross Total Value",
        "Invoice Count",
      ];
      sheet.getRow(6).values = headers;
      sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };

      data.taxSummary.forEach((t: any) => {
        const row = sheet.addRow([
          t.taxConfigurationName,
          t.taxConfigurationCode,
          t.taxability,
          (t.gstRatePct || 0) / 100,
          t.taxableValue || 0,
          t.cgst || 0,
          t.sgst || 0,
          t.igst || 0,
          t.cess || 0,
          t.totalTax || 0,
          t.grossValue || 0,
          t.invoiceCount || 0,
        ]);

        row.getCell(4).numFmt = "0.00%";
        [5, 6, 7, 8, 9, 10, 11].forEach((colIdx) => {
          row.getCell(colIdx).numFmt = "₹#,##0.00";
        });
        row.getCell(12).numFmt = "#,##0";
      });
    } else {
      const headers = ["GST Rate %", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total GST (₹)", "Invoice Value (₹)"];
      sheet.getRow(6).values = headers;
      sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

      const rates = [0, 0.05, 0.12, 0.18, 0.28];
      rates.forEach((rate, idx) => {
        const rowNum = idx + 7;
        const matching = (data.salesRegister || []).filter((r) => Math.abs((r.gstRatePct || 18) / 100 - rate) < 0.01);
        const taxVal = matching.reduce((s, r) => s + (r.taxableValue || 0), 0);
        const cgstVal = matching.reduce((s, r) => s + (r.cgst || 0), 0);
        const sgstVal = matching.reduce((s, r) => s + (r.sgst || 0), 0);
        const igstVal = matching.reduce((s, r) => s + (r.igst || 0), 0);
        const gstVal = cgstVal + sgstVal + igstVal;
        const invVal = taxVal + gstVal;

        sheet.getCell(rowNum, 1).value = rate; sheet.getCell(rowNum, 1).numFmt = "0.00%";
        sheet.getCell(rowNum, 2).value = taxVal; sheet.getCell(rowNum, 2).numFmt = "₹#,##0.00";
        sheet.getCell(rowNum, 3).value = cgstVal; sheet.getCell(rowNum, 3).numFmt = "₹#,##0.00";
        sheet.getCell(rowNum, 4).value = sgstVal; sheet.getCell(rowNum, 4).numFmt = "₹#,##0.00";
        sheet.getCell(rowNum, 5).value = igstVal; sheet.getCell(rowNum, 5).numFmt = "₹#,##0.00";
        sheet.getCell(rowNum, 6).value = gstVal; sheet.getCell(rowNum, 6).numFmt = "₹#,##0.00";
        sheet.getCell(rowNum, 7).value = invVal; sheet.getCell(rowNum, 7).numFmt = "₹#,##0.00";
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Tax_Summary_${fromDate}_to_${toDate}`);
  }

  // 9. DEDICATED GSTR-1 EXPORT
  public static async exportGstr1(data: { salesRegister: any[]; hsnSummary: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GSTR-1");
    sheet.views = [{ showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").value = `GSTR-1 OUTWARD SUPPLIES REPORT | Period: ${fromDate} to ${toDate}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const b2bOrders = (data.salesRegister || []).filter((r) => r.customerGstin && r.customerGstin !== "URP" && r.customerGstin.length === 15);
    const b2cOrders = (data.salesRegister || []).filter((r) => !r.customerGstin || r.customerGstin === "URP" || r.customerGstin.length !== 15);

    sheet.getRow(6).values = ["GSTR-1 Section", "Invoice Count", "Taxable Amount", "CGST", "SGST", "IGST", "Total Tax Liability"];
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    sheet.addRow({ section: "B2B (4A, 4B, 6B, 6C)", count: b2bOrders.length, taxable: b2bOrders.reduce((s, r) => s + (r.taxableValue || 0), 0), cgst: b2bOrders.reduce((s, r) => s + (r.cgst || 0), 0), sgst: b2bOrders.reduce((s, r) => s + (r.sgst || 0), 0), igst: b2bOrders.reduce((s, r) => s + (r.igst || 0), 0), totalTax: b2bOrders.reduce((s, r) => s + (r.totalTax || 0), 0) });
    sheet.addRow({ section: "B2CS (Small Consumer 7)", count: b2cOrders.length, taxable: b2cOrders.reduce((s, r) => s + (r.taxableValue || 0), 0), cgst: b2cOrders.reduce((s, r) => s + (r.cgst || 0), 0), sgst: b2cOrders.reduce((s, r) => s + (r.sgst || 0), 0), igst: b2cOrders.reduce((s, r) => s + (r.igst || 0), 0), totalTax: b2cOrders.reduce((s, r) => s + (r.totalTax || 0), 0) });
    sheet.addRow({ section: "HSN Summary (12)", count: (data.hsnSummary || []).length, taxable: data.salesRegister.reduce((s, r) => s + (r.taxableValue || 0), 0), cgst: data.salesRegister.reduce((s, r) => s + (r.cgst || 0), 0), sgst: data.salesRegister.reduce((s, r) => s + (r.sgst || 0), 0), igst: data.salesRegister.reduce((s, r) => s + (r.igst || 0), 0), totalTax: data.salesRegister.reduce((s, r) => s + (r.totalTax || 0), 0) });

    sheet.columns = [{ width: 28 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GSTR1_Report_${fromDate}_to_${toDate}`);
  }

  // 10. DEDICATED GSTR-3B EXPORT
  public static async exportGstr3b(data: { salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GSTR-3B");
    sheet.views = [{ showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = `GSTR-3B LIABILITY SUMMARY | Period: ${fromDate} to ${toDate}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const totalTaxable = data.salesRegister.reduce((s, r) => s + (r.taxableValue || 0), 0);
    const totalCgst = data.salesRegister.reduce((s, r) => s + (r.cgst || 0), 0);
    const totalSgst = data.salesRegister.reduce((s, r) => s + (r.sgst || 0), 0);
    const totalIgst = data.salesRegister.reduce((s, r) => s + (r.igst || 0), 0);

    sheet.getRow(6).values = ["GSTR-3B Table 3.1 Category", "Taxable Value (₹)", "Integrated Tax IGST (₹)", "Central Tax CGST (₹)", "State Tax SGST (₹)", "Cess (₹)"];
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    sheet.addRow({ category: "(a) Outward Taxable Supplies (Other than Zero-Rated/Exempt)", taxable: totalTaxable, igst: totalIgst, cgst: totalCgst, sgst: totalSgst, cess: 0 });
    sheet.addRow({ category: "(b) Outward Taxable Supplies (Zero Rated Export)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
    sheet.addRow({ category: "(c) Other Outward Supplies (Nil Rated / Exempt)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
    sheet.addRow({ category: "Eligible Input Tax Credit (ITC Table 4)", taxable: "Not available — purchase/ITC data not configured", igst: "-", cgst: "-", sgst: "-", cess: "-" });

    sheet.columns = [{ width: 42 }, { width: 22 }, { width: 22 }, { width: 20 }, { width: 20 }, { width: 14 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GSTR3B_Report_${fromDate}_to_${toDate}`);
  }

  // 11. DEDICATED VALIDATION ERRORS EXPORT
  public static async exportValidationErrors(data: { productTaxDetails: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Validation Errors");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = `GST DATA QUALITY & VALIDATION AUDIT | Period: ${fromDate} to ${toDate}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["SKU", "Product Name", "Category", "HSN / SAC", "GST Rate %", "Validation Issue"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };

    data.productTaxDetails.forEach((r) => {
      const row = sheet.addRow({
        ...r,
        gstRatePct: (r.gstRatePct || 18) / 100,
        status: r.unitCost === 0 || !r.hsnCode ? "GST CONFIGURATION ERROR" : "CONFIGURED",
      });
      row.getCell("gstRatePct").numFmt = "0.00%";
      if (row.getCell("status").value === "GST CONFIGURATION ERROR") {
        row.getCell("status").font = { bold: true, color: { argb: "FFDC2626" } };
      }
    });

    sheet.columns = [{ width: 14 }, { width: 32 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 32 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GST_Validation_Audit_${fromDate}_to_${toDate}`);
  }

  /**
   * Generates the complete 11-Worksheet GST & Tax Excel Report Workbook (.xlsx) and triggers browser download
   */
  public static async downloadGstWorkbookXlsx(data: {
    filters: any;
    kpis: any[];
    salesRegister: any[];
    hsnSummary: any[];
    invoiceRegister: any[];
    productTaxDetails: any[];
    branchGstSummary: any[];
    dataQualityWarnings: any[];
    reconciliationStatus: any;
    creditNotes?: any[];
    gstr1?: any;
    gstr3b?: any;
  }, filename?: string): Promise<void> {
    const buffer = await this.generateGstWorkbookXlsx(data, filename);
    this.triggerBrowserDownload(buffer, filename || "CakeToHome_Full_GST_Audit_Workbook");
  }

  /**
   * Generates the complete 11-Worksheet GST & Tax Excel Report Workbook (.xlsx)
   */
  public static async generateGstWorkbookXlsx(data: {
    filters: any;
    kpis: any[];
    salesRegister: any[];
    hsnSummary: any[];
    invoiceRegister: any[];
    productTaxDetails: any[];
    branchGstSummary: any[];
    dataQualityWarnings: any[];
    reconciliationStatus: any;
    creditNotes?: any[];
    gstr1?: any;
    gstr3b?: any;
  }, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CakeToHome ERP Engine";
    workbook.lastModifiedBy = "CakeToHome Super Admin";
    workbook.created = new Date();

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    const b2bOrders = data.salesRegister.filter((r) => r.customerGstin && r.customerGstin !== "URP" && r.customerGstin.length === 15);
    const b2cOrders = data.salesRegister.filter((r) => !r.customerGstin || r.customerGstin === "URP" || r.customerGstin.length !== 15);

    // ── SHEET 1: 01 EXECUTIVE SUMMARY ──────────────────────────────────────────
    const s1 = workbook.addWorksheet("01 Executive Summary");
    s1.views = [{ showGridLines: true }];

    s1.mergeCells("A1:G1");
    const titleCell = s1.getCell("A1");
    titleCell.value = "CAKETOHOME GST & TAX SUMMARY REPORT";
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF991B1B" } };

    s1.mergeCells("A2:G2");
    const subCell = s1.getCell("A2");
    subCell.value = `Reporting Period: ${fromDate} to ${toDate} | Generated: ${new Date().toLocaleString("en-IN")}`;
    subCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };

    s1.getCell("A4").value = "GSTIN:"; s1.getCell("B4").value = "29AAAAA0000A1Z5";
    s1.getCell("A5").value = "State:"; s1.getCell("B5").value = "Karnataka (29)";
    s1.getCell("A6").value = "Registration Type:"; s1.getCell("B6").value = "Regular GST Taxpayer";
    s1.getCell("D4").value = "Organization:"; s1.getCell("E4").value = "CakeToHome India Pvt Ltd";
    s1.getCell("D5").value = "Kitchen Hubs Filtered:"; s1.getCell("E5").value = data.filters?.branchIds?.join(", ") || "All Hubs";

    ["A4", "A5", "A6", "D4", "D5"].forEach((ref) => {
      s1.getCell(ref).font = { bold: true, color: { argb: "FF334155" } };
    });

    s1.getCell("A8").value = "GST KPI Metric"; s1.getCell("B8").value = "Amount (₹) / Count";
    s1.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s1.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const totalTaxable = data.salesRegister.reduce((acc, r) => acc + (r.taxableValue || 0), 0);
    const totalCgst = data.salesRegister.reduce((acc, r) => acc + (r.cgst || 0), 0);
    const totalSgst = data.salesRegister.reduce((acc, r) => acc + (r.sgst || 0), 0);
    const totalIgst = data.salesRegister.reduce((acc, r) => acc + (r.igst || 0), 0);
    const totalGst = totalCgst + totalSgst + totalIgst;
    const totalInvVal = totalTaxable + totalGst;

    const kpiRows = [
      ["Total Taxable Sales", totalTaxable, "currency"],
      ["Total CGST Collected", totalCgst, "currency"],
      ["Total SGST Collected", totalSgst, "currency"],
      ["Total IGST Collected", totalIgst, "currency"],
      ["Total GST Tax Liability", totalGst, "currency"],
      ["Total Gross Invoice Value", totalInvVal, "currency"],
      ["B2B Registered Taxable Sales", b2bOrders.reduce((s, r) => s + (r.taxableValue || 0), 0), "currency"],
      ["B2C Consumer Taxable Sales", b2cOrders.reduce((s, r) => s + (r.taxableValue || 0), 0), "currency"],
      ["Total Tax Invoices Issued", data.invoiceRegister.length, "number"],
      ["Cancelled / Void Invoices", 0, "number"],
    ];

    let rowIdx = 9;
    kpiRows.forEach(([label, val, type]) => {
      s1.getCell(`A${rowIdx}`).value = label;
      const c = s1.getCell(`B${rowIdx}`);
      c.value = val as number;
      c.numFmt = type === "currency" ? "₹#,##0.00" : "#,##0";
      s1.getCell(`A${rowIdx}`).font = { bold: true };
      rowIdx++;
    });

    s1.columns = [{ width: 32 }, { width: 25 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 22 }];

    // ── SHEET 2: 02 INVOICE REGISTER ───────────────────────────────────────────
    const s2 = workbook.addWorksheet("02 Invoice Register");
    s2.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];

    const s2Cols = [
      { header: "Document Type", key: "docType", width: 18 },
      { header: "Invoice Number", key: "invoiceNumber", width: 22 },
      { header: "Invoice Date", key: "invoiceDate", width: 16 },
      { header: "Order Number", key: "orderNumber", width: 20 },
      { header: "Customer Name", key: "customerName", width: 24 },
      { header: "Customer GSTIN", key: "customerGstin", width: 18 },
      { header: "Branch Name", key: "branchName", width: 24 },
      { header: "Branch GSTIN", key: "branchGstin", width: 18 },
      { header: "Place of Supply", key: "placeOfSupply", width: 18 },
      { header: "Taxable Amount", key: "taxableAmount", width: 18 },
      { header: "CGST", key: "cgst", width: 14 },
      { header: "SGST", key: "sgst", width: 14 },
      { header: "IGST", key: "igst", width: 14 },
      { header: "Total GST", key: "totalTax", width: 16 },
      { header: "Round Off", key: "roundOff", width: 12 },
      { header: "Invoice Total", key: "totalValue", width: 20 },
      { header: "Payment Method", key: "paymentMethod", width: 16 },
      { header: "Status", key: "invoiceStatus", width: 16 },
    ];
    s2.columns = s2Cols;
    s2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    data.invoiceRegister.forEach((r) => {
      const row = s2.addRow({ docType: "TAX INVOICE", ...r });
      ["taxableAmount", "cgst", "sgst", "igst", "totalTax", "roundOff", "totalValue"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "₹#,##0.00";
      });
    });

    const s2TotalRowIdx = data.invoiceRegister.length + 2;
    const s2TotalRow = s2.addRow({});
    s2TotalRow.getCell("invoiceNumber").value = "TOTAL";
    s2TotalRow.font = { bold: true };
    s2TotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    ["taxableAmount", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
      const colIdx = s2Cols.findIndex((c) => c.key === k) + 1;
      const colLetter = String.fromCharCode(64 + colIdx);
      const cell = s2TotalRow.getCell(k);
      cell.value = { formula: `SUM(${colLetter}2:${colLetter}${s2TotalRowIdx - 1})` };
      cell.numFmt = "₹#,##0.00";
    });
    s2.autoFilter = { from: { row: 1, column: 1 }, to: { row: s2TotalRowIdx - 1, column: s2Cols.length } };

    // ── SHEET 3: 03 GST TRANSACTIONS ──────────────────────────────────────────
    const s3 = workbook.addWorksheet("03 GST Transactions");
    s3.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];
    const s3Cols = [
      { header: "Invoice Date", key: "invoiceDate", width: 15 },
      { header: "Invoice Number", key: "invoiceNumber", width: 22 },
      { header: "Order Number", key: "orderNumber", width: 20 },
      { header: "Customer Name", key: "customerName", width: 24 },
      { header: "Customer Phone", key: "customerPhone", width: 16 },
      { header: "Customer GSTIN", key: "customerGstin", width: 18 },
      { header: "Place of Supply", key: "placeOfSupply", width: 18 },
      { header: "State Code", key: "stateCode", width: 12 },
      { header: "Supply Type", key: "supplyType", width: 14 },
      { header: "Branch Name", key: "branchName", width: 24 },
      { header: "Branch GSTIN", key: "branchGstin", width: 18 },
      { header: "Product Name", key: "productName", width: 32 },
      { header: "HSN / SAC", key: "hsnCode", width: 14 },
      { header: "UQC", key: "uom", width: 10 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Unit Price", key: "unitPrice", width: 14 },
      { header: "Gross Amount", key: "grossAmount", width: 16 },
      { header: "Discount", key: "discount", width: 14 },
      { header: "Taxable Value", key: "taxableValue", width: 16 },
      { header: "GST Rate %", key: "gstRatePct", width: 14 },
      { header: "CGST %", key: "cgstRatePct", width: 12 },
      { header: "CGST Amount", key: "cgst", width: 14 },
      { header: "SGST %", key: "sgstRatePct", width: 12 },
      { header: "SGST Amount", key: "sgst", width: 14 },
      { header: "IGST %", key: "igstRatePct", width: 12 },
      { header: "IGST Amount", key: "igst", width: 14 },
      { header: "Total GST", key: "totalTax", width: 16 },
      { header: "Invoice Total", key: "totalValue", width: 18 },
      { header: "Payment Method", key: "paymentMethod", width: 16 },
      { header: "Order Status", key: "orderStatus", width: 16 },
    ];
    s3.columns = s3Cols;
    s3.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s3.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    data.salesRegister.forEach((r) => {
      const row = s3.addRow({
        stateCode: "29",
        supplyType: r.igst > 0 ? "INTER-STATE" : "INTRA-STATE",
        ...r,
        gstRatePct: (r.gstRatePct || 18) / 100,
        cgstRatePct: (r.cgstRatePct || 9) / 100,
        sgstRatePct: (r.sgstRatePct || 9) / 100,
        igstRatePct: (r.igstRatePct || 0) / 100,
      });

      ["unitPrice", "grossAmount", "discount", "taxableValue", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "₹#,##0.00";
      });

      ["gstRatePct", "cgstRatePct", "sgstRatePct", "igstRatePct"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "0.00%";
      });
      row.getCell("quantity").numFmt = "#,##0";
    });

    const s3TotalRowIdx = data.salesRegister.length + 2;
    const s3TotalRow = s3.addRow({});
    s3TotalRow.getCell("invoiceDate").value = "TOTAL";
    s3TotalRow.font = { bold: true };
    s3TotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    ["quantity", "grossAmount", "discount", "taxableValue", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
      const colIdx = s3Cols.findIndex((c) => c.key === k) + 1;
      const colLetter = String.fromCharCode(64 + colIdx);
      const cell = s3TotalRow.getCell(k);
      cell.value = { formula: `SUM(${colLetter}2:${colLetter}${s3TotalRowIdx - 1})` };
      cell.numFmt = k === "quantity" ? "#,##0" : "₹#,##0.00";
    });
    s3.autoFilter = { from: { row: 1, column: 1 }, to: { row: s3TotalRowIdx - 1, column: s3Cols.length } };

    // ── SHEET 4: 04 B2B SALES ──────────────────────────────────────────────────
    const s4 = workbook.addWorksheet("04 B2B Sales");
    s4.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];
    s4.columns = s3Cols;
    s4.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s4.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    b2bOrders.forEach((r) => {
      const row = s4.addRow({
        stateCode: "29",
        supplyType: r.igst > 0 ? "INTER-STATE" : "INTRA-STATE",
        ...r,
        gstRatePct: (r.gstRatePct || 18) / 100,
        cgstRatePct: (r.cgstRatePct || 9) / 100,
        sgstRatePct: (r.sgstRatePct || 9) / 100,
        igstRatePct: (r.igstRatePct || 0) / 100,
      });
      ["unitPrice", "grossAmount", "discount", "taxableValue", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "₹#,##0.00";
      });
    });

    // ── SHEET 5: 05 B2C SALES ──────────────────────────────────────────────────
    const s5 = workbook.addWorksheet("05 B2C Sales");
    s5.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];
    s5.columns = s3Cols;
    s5.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s5.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    b2cOrders.forEach((r) => {
      const row = s5.addRow({
        stateCode: "29",
        supplyType: r.igst > 0 ? "INTER-STATE" : "INTRA-STATE",
        ...r,
        gstRatePct: (r.gstRatePct || 18) / 100,
        cgstRatePct: (r.cgstRatePct || 9) / 100,
        sgstRatePct: (r.sgstRatePct || 9) / 100,
        igstRatePct: (r.igstRatePct || 0) / 100,
      });
      ["unitPrice", "grossAmount", "discount", "taxableValue", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "₹#,##0.00";
      });
    });

    // ── SHEET 6: 06 CREDIT NOTES ──────────────────────────────────────────────
    const s6 = workbook.addWorksheet("06 Credit Notes");
    s6.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];
    s6.columns = [
      { header: "Credit Note No", key: "cnNumber", width: 22 },
      { header: "Credit Note Date", key: "cnDate", width: 16 },
      { header: "Original Invoice No", key: "origInvoice", width: 22 },
      { header: "Customer Name", key: "customerName", width: 24 },
      { header: "Reason", key: "reason", width: 24 },
      { header: "Taxable Refund", key: "taxable", width: 18 },
      { header: "CGST Refund", key: "cgst", width: 14 },
      { header: "SGST Refund", key: "sgst", width: 14 },
      { header: "IGST Refund", key: "igst", width: 14 },
      { header: "Total Refund Value", key: "totalRefund", width: 20 },
    ];
    s6.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s6.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    (data.creditNotes || []).forEach((cn) => {
      const row = s6.addRow(cn);
      ["taxable", "cgst", "sgst", "igst", "totalRefund"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "₹#,##0.00";
      });
    });

    // ── SHEET 7: 07 HSN SUMMARY ───────────────────────────────────────────────
    const s7 = workbook.addWorksheet("07 HSN Summary");
    s7.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];

    const s7Cols = [
      { header: "HSN / SAC", key: "hsnCode", width: 16 },
      { header: "Description", key: "description", width: 32 },
      { header: "UQC", key: "uom", width: 12 },
      { header: "B2B Quantity", key: "b2bQty", width: 14 },
      { header: "B2C Quantity", key: "b2cQty", width: 14 },
      { header: "Total Quantity", key: "quantity", width: 14 },
      { header: "Taxable Value", key: "taxableValue", width: 18 },
      { header: "GST Rate %", key: "gstRatePct", width: 14 },
      { header: "CGST Amount", key: "cgst", width: 16 },
      { header: "SGST Amount", key: "sgst", width: 16 },
      { header: "IGST Amount", key: "igst", width: 16 },
      { header: "Total GST", key: "totalTax", width: 18 },
      { header: "Total Invoice Value", key: "totalValue", width: 20 },
    ];
    s7.columns = s7Cols;
    s7.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s7.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    data.hsnSummary.forEach((r) => {
      const row = s7.addRow({ b2bQty: 0, b2cQty: r.quantity, ...r, gstRatePct: (r.gstRatePct || 18) / 100 });
      ["taxableValue", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
        const cell = row.getCell(k);
        if (typeof cell.value === "number") cell.numFmt = "₹#,##0.00";
      });
      row.getCell("gstRatePct").numFmt = "0.00%";
      ["b2bQty", "b2cQty", "quantity"].forEach((k) => {
        row.getCell(k).numFmt = "#,##0";
      });
    });

    const s7TotalRowIdx = data.hsnSummary.length + 2;
    const s7TotalRow = s7.addRow({});
    s7TotalRow.getCell("hsnCode").value = "TOTAL";
    s7TotalRow.font = { bold: true };
    s7TotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    ["b2bQty", "b2cQty", "quantity", "taxableValue", "cgst", "sgst", "igst", "totalTax", "totalValue"].forEach((k) => {
      const colIdx = s7Cols.findIndex((c) => c.key === k) + 1;
      const colLetter = String.fromCharCode(64 + colIdx);
      const cell = s7TotalRow.getCell(k);
      cell.value = { formula: `SUM(${colLetter}2:${colLetter}${s7TotalRowIdx - 1})` };
      cell.numFmt = k.includes("Qty") || k === "quantity" ? "#,##0" : "₹#,##0.00";
    });
    s7.autoFilter = { from: { row: 1, column: 1 }, to: { row: s7TotalRowIdx - 1, column: s7Cols.length } };

    // ── SHEET 8: 08 TAX SUMMARY ───────────────────────────────────────────────
    const s8 = workbook.addWorksheet("08 Tax Summary");
    s8.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];

    const rateHeaders = ["GST Rate %", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total GST (₹)", "Invoice Value (₹)"];
    s8.getRow(1).values = rateHeaders;
    s8.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s8.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    const rates = [0, 0.05, 0.12, 0.18, 0.28];
    rates.forEach((rate, idx) => {
      const rowNum = idx + 2;
      const matching = data.salesRegister.filter((r) => Math.abs((r.gstRatePct || 18) / 100 - rate) < 0.01);
      const taxVal = matching.reduce((s, r) => s + (r.taxableValue || 0), 0);
      const cgstVal = matching.reduce((s, r) => s + (r.cgst || 0), 0);
      const sgstVal = matching.reduce((s, r) => s + (r.sgst || 0), 0);
      const igstVal = matching.reduce((s, r) => s + (r.igst || 0), 0);
      const gstVal = cgstVal + sgstVal + igstVal;
      const invVal = taxVal + gstVal;

      s8.getCell(rowNum, 1).value = rate; s8.getCell(rowNum, 1).numFmt = "0.00%";
      s8.getCell(rowNum, 2).value = taxVal; s8.getCell(rowNum, 2).numFmt = "₹#,##0.00";
      s8.getCell(rowNum, 3).value = cgstVal; s8.getCell(rowNum, 3).numFmt = "₹#,##0.00";
      s8.getCell(rowNum, 4).value = sgstVal; s8.getCell(rowNum, 4).numFmt = "₹#,##0.00";
      s8.getCell(rowNum, 5).value = igstVal; s8.getCell(rowNum, 5).numFmt = "₹#,##0.00";
      s8.getCell(rowNum, 6).value = gstVal; s8.getCell(rowNum, 6).numFmt = "₹#,##0.00";
      s8.getCell(rowNum, 7).value = invVal; s8.getCell(rowNum, 7).numFmt = "₹#,##0.00";
    });

    const s8TotalRow = s8.addRow({});
    s8TotalRow.getCell(1).value = "TOTAL";
    s8TotalRow.font = { bold: true };
    s8TotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    for (let c = 2; c <= 7; c++) {
      const colLetter = String.fromCharCode(64 + c);
      const cell = s8TotalRow.getCell(c);
      cell.value = { formula: `SUM(${colLetter}2:${colLetter}6)` };
      cell.numFmt = "₹#,##0.00";
    }
    s8.columns = [{ width: 18 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 22 }];

    // ── SHEET 9: 09 GSTR-1 ────────────────────────────────────────────────────
    const s9 = workbook.addWorksheet("09 GSTR-1");
    s9.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];
    s9.columns = [
      { header: "GSTR-1 Section", key: "section", width: 22 },
      { header: "Invoice Count", key: "count", width: 14 },
      { header: "Taxable Amount", key: "taxable", width: 18 },
      { header: "CGST", key: "cgst", width: 14 },
      { header: "SGST", key: "sgst", width: 14 },
      { header: "IGST", key: "igst", width: 14 },
      { header: "Total Tax Liability", key: "totalTax", width: 20 },
    ];
    s9.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s9.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    s9.addRow({ section: "B2B (4A, 4B, 6B, 6C)", count: b2bOrders.length, taxable: b2bOrders.reduce((s, r) => s + (r.taxableValue || 0), 0), cgst: b2bOrders.reduce((s, r) => s + (r.cgst || 0), 0), sgst: b2bOrders.reduce((s, r) => s + (r.sgst || 0), 0), igst: b2bOrders.reduce((s, r) => s + (r.igst || 0), 0), totalTax: b2bOrders.reduce((s, r) => s + (r.totalTax || 0), 0) });
    s9.addRow({ section: "B2CS (Small Consumer 7)", count: b2cOrders.length, taxable: b2cOrders.reduce((s, r) => s + (r.taxableValue || 0), 0), cgst: b2cOrders.reduce((s, r) => s + (r.cgst || 0), 0), sgst: b2cOrders.reduce((s, r) => s + (r.sgst || 0), 0), igst: b2cOrders.reduce((s, r) => s + (r.igst || 0), 0), totalTax: b2cOrders.reduce((s, r) => s + (r.totalTax || 0), 0) });
    s9.addRow({ section: "HSN Summary (12)", count: data.hsnSummary.length, taxable: totalTaxable, cgst: totalCgst, sgst: totalSgst, igst: totalIgst, totalTax: totalGst });

    // ── SHEET 10: 10 GSTR-3B ──────────────────────────────────────────────────
    const s10 = workbook.addWorksheet("10 GSTR-3B");
    s10.views = [{ showGridLines: true }];
    s10.columns = [
      { header: "GSTR-3B Table 3.1 Category", key: "category", width: 36 },
      { header: "Taxable Value (₹)", key: "taxable", width: 20 },
      { header: "Integrated Tax IGST (₹)", key: "igst", width: 22 },
      { header: "Central Tax CGST (₹)", key: "cgst", width: 20 },
      { header: "State Tax SGST (₹)", key: "sgst", width: 20 },
      { header: "Cess (₹)", key: "cess", width: 14 },
    ];
    s10.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s10.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    s10.addRow({ category: "(a) Outward Taxable Supplies (Other than Zero-Rated/Exempt)", taxable: totalTaxable, igst: totalIgst, cgst: totalCgst, sgst: totalSgst, cess: 0 });
    s10.addRow({ category: "(b) Outward Taxable Supplies (Zero Rated Export)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
    s10.addRow({ category: "(c) Other Outward Supplies (Nil Rated / Exempt)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
    s10.addRow({ category: "Eligible Input Tax Credit (ITC Table 4)", taxable: "Not available — purchase/ITC data not configured", igst: "-", cgst: "-", sgst: "-", cess: "-" });

    // ── SHEET 11: 11 VALIDATION ERRORS ───────────────────────────────────────
    const s11 = workbook.addWorksheet("11 Validation Errors");
    s11.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];

    const s11Cols = [
      { header: "SKU", key: "sku", width: 14 },
      { header: "Product Name", key: "name", width: 32 },
      { header: "Category", key: "category", width: 16 },
      { header: "HSN / SAC", key: "hsnCode", width: 14 },
      { header: "GST Rate %", key: "gstRatePct", width: 14 },
      { header: "Validation Issue", key: "status", width: 32 },
    ];
    s11.columns = s11Cols;
    s11.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s11.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };

    data.productTaxDetails.forEach((r) => {
      const row = s11.addRow({
        ...r,
        gstRatePct: (r.gstRatePct || 18) / 100,
        status: r.unitCost === 0 || !r.hsnCode ? "GST CONFIGURATION ERROR" : "CONFIGURED",
      });
      row.getCell("gstRatePct").numFmt = "0.00%";
      if (row.getCell("status").value === "GST CONFIGURATION ERROR") {
        row.getCell("status").font = { bold: true, color: { argb: "FFDC2626" } };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  /**
   * Helper to construct ExcelJS workbook from generic sheet configs
   */
  private static async createWorkbook(sheets: ExcelSheetData[]): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CakeToHome Analytics Engine";
    workbook.created = new Date();

    for (const sheetConfig of sheets) {
      const cleanName = sheetConfig.name.replace(/[/\\?*:[\]]/g, "_").substring(0, 31);
      const sheet = workbook.addWorksheet(cleanName);
      sheet.views = [{ state: "frozen", xSplit: 0, ySplit: sheetConfig.title ? 3 : 1, showGridLines: true }];

      let startRow = 1;
      if (sheetConfig.title) {
        const titleRow = sheet.getRow(startRow);
        titleRow.getCell(1).value = sheetConfig.title;
        titleRow.getCell(1).font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF991B1B" } };
        startRow++;
      }
      if (sheetConfig.subtitle) {
        const subRow = sheet.getRow(startRow);
        subRow.getCell(1).value = sheetConfig.subtitle;
        subRow.getCell(1).font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };
        startRow++;
      }

      const headerRow = sheet.getRow(startRow);
      sheetConfig.columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        sheet.getColumn(idx + 1).width = col.width ? col.width / 8 : 18;
      });

      startRow++;

      sheetConfig.rows.forEach((r) => {
        const row = sheet.getRow(startRow);
        sheetConfig.columns.forEach((col, cIdx) => {
          const val = r[col.key];
          const cell = row.getCell(cIdx + 1);
          if (val !== null && val !== undefined) {
            cell.value = val;
            if (col.type === "currency") cell.numFmt = "₹#,##0.00";
            if (col.type === "percentage") {
              cell.value = typeof val === "number" ? val / 100 : val;
              cell.numFmt = "0.00%";
            }
            if (col.type === "number") cell.numFmt = "#,##0";
          }
        });
        startRow++;
      });
    }

    return workbook;
  }

  // 10. DEDICATED GST VALIDATION AUDIT EXPORT
  public static async exportValidationAudit(data: { exceptions?: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Validation Audit");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:E1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = `GST DATA QUALITY VALIDATION AUDIT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["Issue ID", "Audit Category", "Severity", "Description", "Action Required"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };

    if (data.exceptions && data.exceptions.length > 0) {
      data.exceptions.forEach((e: any) => {
        sheet.addRow([e.id, e.title, e.severity || "MEDIUM", e.description, e.actionLabel || "Review"]);
      });
    } else {
      const emptyRow = sheet.addRow(["No GST compliance validation issues or exceptions detected for the selected period."]);
      sheet.mergeCells(`A7:E7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF059669" } };
    }

    sheet.columns = [{ width: 18 }, { width: 28 }, { width: 14 }, { width: 45 }, { width: 20 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GST_Validation_Audit_${fromDate}_to_${toDate}`);
  }

  // 11. DEDICATED EXECUTIVE SUMMARY EXPORT
  public static async exportExecutiveSummary(data: { kpis: any[]; salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    await this.exportGstSummary(data, filename || `CakeToHome_Executive_Summary_${data.filters?.customStartDate || "2026-08-01"}_to_${data.filters?.customEndDate || "2026-08-10"}`);
  }

  // 12. DEDICATED SALES & REVENUE EXPORT
  public static async exportSalesRevenue(data: { salesRegister: any[]; filters?: any }, filename?: string): Promise<void> {
    await this.exportB2C(data, filename || `CakeToHome_Sales_Revenue_${data.filters?.customStartDate || "2026-08-01"}_to_${data.filters?.customEndDate || "2026-08-10"}`);
  }

  // 13. DEDICATED PRODUCTS & PROFITABILITY EXPORT
  public static async exportProductsProfitability(data: { products?: any[]; salesRegister?: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Product Profitability");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value = `PRODUCT PROFITABILITY & COGS AUDIT REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["SKU Code", "Product Name", "Category", "HSN Code", "Qty Sold", "Gross Sales", "Net Sales", "Unit COGS", "Total COGS", "Gross Profit", "Margin %"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };

    const list = data.products || data.salesRegister || [];
    if (list.length > 0) {
      list.forEach((p: any) => {
        const row = sheet.addRow([
          p.sku || p.id,
          p.name || p.productNames || "Product",
          p.category || "Cakes",
          p.hsnCode || "19059090",
          p.quantitySold || p.itemCount || 1,
          p.grossSales || p.netAmount || 0,
          p.netSales || p.netAmount || 0,
          p.unitCost || 120,
          p.totalCogs || Math.round((p.netAmount || 0) * 0.35),
          p.grossProfit || Math.round((p.netAmount || 0) * 0.65),
          (p.grossMarginPct || 65) / 100,
        ]);

        [6, 7, 8, 9, 10].forEach((cIdx) => {
          row.getCell(cIdx).numFmt = "₹#,##0.00";
        });
        row.getCell(5).numFmt = "#,##0";
        row.getCell(11).numFmt = "0.00%";
      });
    } else {
      const emptyRow = sheet.addRow(["No product sales transactions found for the selected period."]);
      sheet.mergeCells(`A7:K7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 16 }, { width: 28 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Product_Profitability_${fromDate}_to_${toDate}`);
  }

  // 14. DEDICATED ORDERS & LIFECYCLE EXPORT
  public static async exportOrdersLifecycle(data: { orders?: any[]; salesRegister?: any[]; filters?: any }, filename?: string): Promise<void> {
    await this.exportInvoiceRegister({ invoiceRegister: data.orders || data.salesRegister || [], filters: data.filters }, filename || `CakeToHome_Order_Lifecycle_${data.filters?.customStartDate || "2026-08-01"}_to_${data.filters?.customEndDate || "2026-08-10"}`);
  }





  // 17. DEDICATED CUSTOMER ANALYTICS EXPORT
  public static async exportCustomerAnalytics(data: { customerData?: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customer Analytics");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-07-01";
    const toDate = data.filters?.customEndDate || "2026-07-31";

    sheet.mergeCells("A1:H1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:H2");
    sheet.getCell("A2").value = `CAKETOHOME CUSTOMER INTELLIGENCE & REPEAT RETENTION REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:"; sheet.getCell("B4").value = "29AAAAA0000A1Z5";
    sheet.getCell("D4").value = "Generated:"; sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => sheet.getCell(ref).font = { bold: true });

    const headers = [
      "Customer ID",
      "Customer Name",
      "Email Address",
      "Phone Number",
      "Total Orders",
      "Lifetime Spend (₹)",
      "AOV (₹)",
      "Customer Segment",
    ];

    const headerRow = sheet.getRow(6);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    const topCust = data.customerData?.topCustomers || [];
    if (topCust.length > 0) {
      topCust.forEach((c: any) => {
        const row = sheet.addRow([
          c.id,
          c.name,
          c.email || "customer@cakes2home.com",
          c.phone || "",
          c.totalOrders || 0,
          c.totalSpend || 0,
          c.aov || 0,
          c.segment || "Standard Buyer",
        ]);
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(5).numFmt = "#,##0";
        [6, 7].forEach((cIdx) => (row.getCell(cIdx).numFmt = "₹#,##0.00"));
      });
    } else {
      const emptyRow = sheet.addRow(["No customer activity recorded for the selected period."]);
      sheet.mergeCells(`A7:H7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [
      { width: 18 }, { width: 26 }, { width: 28 }, { width: 18 },
      { width: 14 }, { width: 20 }, { width: 16 }, { width: 22 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Customer_Analytics_${fromDate}_to_${toDate}`);
  }

  // 18. DEDICATED PAYMENTS & REFUNDS EXPORT
  public static async exportPaymentsRefunds(data: { paymentData?: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Payments & Refunds");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = `PAYMENT GATEWAY & REFUND RECONCILIATION REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["Payment Method", "Transaction Count", "Gross Collections", "Success Rate %"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };

    const breakdown = data.paymentData?.breakdown || [];
    if (breakdown.length > 0) {
      breakdown.forEach((p: any) => {
        const row = sheet.addRow([p.method, p.count, p.gross, (p.successPct || 98) / 100]);
        row.getCell(2).numFmt = "#,##0";
        row.getCell(3).numFmt = "₹#,##0.00";
        row.getCell(4).numFmt = "0.00%";
      });
    } else {
      const emptyRow = sheet.addRow(["No payment gateway transactions recorded for the selected period."]);
      sheet.mergeCells(`A7:D7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 28 }, { width: 18 }, { width: 20 }, { width: 16 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Payments_Refunds_${fromDate}_to_${toDate}`);
  }

  // 19. DEDICATED GEOGRAPHIC SALES EXPORT
  public static async exportGeographicSales(data: { geoData?: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Geographic Sales");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:E1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = `GEOGRAPHIC SALES & PINCODE REVENUE REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["City", "Delivery Area", "Pincode", "Orders Count", "Net Revenue"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };

    const locations = data.geoData || [];
    if (locations.length > 0) {
      locations.forEach((g: any) => {
        const row = sheet.addRow([g.city, g.area, g.pincode, g.orders, g.revenue]);
        row.getCell(4).numFmt = "#,##0";
        row.getCell(5).numFmt = "₹#,##0.00";
      });
    } else {
      const emptyRow = sheet.addRow(["No geographic address data logged for the selected period."]);
      sheet.mergeCells(`A7:E7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 18 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 20 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Geographic_Sales_${fromDate}_to_${toDate}`);
  }

  // 20. DEDICATED CROSS-SELL & UPSELL EXPORT
  public static async exportCrossSellUpsell(data: { crossSellData?: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cross-Sell & Upsell");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";

    sheet.mergeCells("A1:E1");
    sheet.getCell("A1").value = "CAKETOHOME / THE CROWN BAKERY";
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = `CROSS-SELL & CO-PURCHASE BASKET AFFINITY REPORT | Period: ${fromDate} to ${toDate} | ${this.formatBranchSubtitle(data.filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    const headers = ["Primary Product", "Co-Purchased Item", "Basket Co-Purchases", "Attach Rate %", "Added Revenue"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };

    const pairs = data.crossSellData || [];
    if (pairs.length > 0) {
      pairs.forEach((p: any) => {
        const row = sheet.addRow([p.primaryItem, p.coPurchasedItem, p.coPurchaseCount, (p.attachRatePct || 20) / 100, p.addedRevenue]);
        row.getCell(3).numFmt = "#,##0";
        row.getCell(4).numFmt = "0.00%";
        row.getCell(5).numFmt = "₹#,##0.00";
      });
    } else {
      const emptyRow = sheet.addRow(["No co-purchase item combinations detected for the selected period."]);
      sheet.mergeCells(`A7:E7`);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
    }

    sheet.columns = [{ width: 32 }, { width: 32 }, { width: 20 }, { width: 16 }, { width: 18 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Cross_Sell_Upsell_${fromDate}_to_${toDate}`);
  }

  // 21. DEDICATED EXCEPTION REPORT EXPORT
  public static async exportExceptionReport(data: { exceptions?: any[]; filters?: any }, filename?: string): Promise<void> {
    await this.exportValidationAudit(data, filename || `CakeToHome_Exception_Report_${data.filters?.customStartDate || "2026-08-01"}_to_${data.filters?.customEndDate || "2026-08-10"}`);
  }
}
