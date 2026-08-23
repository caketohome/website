import * as ExcelJS from "exceljs";

let dynamicBrandLine = "CAKETOHOME (CakeToHome India Private Limited)";
let dynamicPrimaryGstin = "29AAAAA0000A1Z5";

/**
 * Configure export identity dynamically from the active business profile.
 */
export function setExportBusinessIdentity(brandLine: string, gstin?: string): void {
  if (brandLine) dynamicBrandLine = brandLine;
  if (gstin) dynamicPrimaryGstin = gstin;
}

function resolveExportBrandLine(): string {
  return dynamicBrandLine;
}

function resolvePrimaryGstin(): string {
  return dynamicPrimaryGstin;
}

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

  public static async generateGstWorkbookXlsx(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;

    // 01 Executive Summary
    ExcelExportService.buildSheetExecutiveSummary(workbook, data, periodStr, "01 Executive Summary");

    // 02 Invoice Register
    ExcelExportService.buildSheetInvoiceRegister(workbook, data, periodStr, "02 Invoice Register");

    // 03 GST Transactions
    ExcelExportService.buildSheetGstTransactions(workbook, data, periodStr, "03 GST Transactions");

    // 04 B2B Sales
    ExcelExportService.buildSheetB2BSales(workbook, data, periodStr, "04 B2B Sales");

    // 05 B2C Sales
    ExcelExportService.buildSheetB2CSales(workbook, data, periodStr, "05 B2C Sales");

    // 06 Credit Notes
    ExcelExportService.buildSheetCreditNotes(workbook, data, periodStr, "06 Credit Notes");

    // 07 HSN Summary
    ExcelExportService.buildSheetHsnSummary(workbook, data, periodStr, "07 HSN Summary");

    // 08 Tax Summary
    ExcelExportService.buildSheetTaxSummary(workbook, data, periodStr, "08 Tax Summary");

    // 09 GSTR-1
    ExcelExportService.buildSheetGstr1(workbook, data, periodStr, "09 GSTR-1");

    // 10 GSTR-3B
    ExcelExportService.buildSheetGstr3b(workbook, data, periodStr, "10 GSTR-3B");

    // 11 Validation Errors
    ExcelExportService.buildSheetValidationErrors(workbook, data, periodStr, "11 Validation Errors");

    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_GST_Complete_Master_Workbook");
    return buffer as ArrayBuffer;
  }

  // ── Standalone 11 GST Export Methods ──
  public static async exportGstSummary(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetExecutiveSummary(workbook, data, periodStr, "GST Summary");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_GST_Summary_Report");
    return buffer as ArrayBuffer;
  }

  public static async exportInvoiceRegister(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetInvoiceRegister(workbook, data, periodStr, "Invoice Register");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_Invoice_Register");
    return buffer as ArrayBuffer;
  }

  public static async exportGstTransactions(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetGstTransactions(workbook, data, periodStr, "GST Transactions");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_GST_Transactions");
    return buffer as ArrayBuffer;
  }

  public static async exportB2B(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetB2BSales(workbook, data, periodStr, "B2B Sales");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_B2B_Sales");
    return buffer as ArrayBuffer;
  }

  public static async exportB2C(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetB2CSales(workbook, data, periodStr, "B2C Sales");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_B2C_Sales");
    return buffer as ArrayBuffer;
  }

  public static async exportCreditNotes(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetCreditNotes(workbook, data, periodStr, "Credit Notes");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_Credit_Notes");
    return buffer as ArrayBuffer;
  }

  public static async exportHsnSummary(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetHsnSummary(workbook, data, periodStr, "HSN Summary");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_HSN_Summary_Report");
    return buffer as ArrayBuffer;
  }

  public static async exportTaxSummary(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetTaxSummary(workbook, data, periodStr, "Tax Summary");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_Tax_Summary");
    return buffer as ArrayBuffer;
  }

  public static async exportGstr1(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetGstr1(workbook, data, periodStr, "GSTR-1");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_GSTR1_Report");
    return buffer as ArrayBuffer;
  }

  public static async exportGstr3b(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetGstr3b(workbook, data, periodStr, "GSTR-3B");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_GSTR3B_Report");
    return buffer as ArrayBuffer;
  }

  public static async exportValidationErrors(data: any, filename?: string): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const periodStr = `${data.filters?.customStartDate || "01/08/2026"} TO ${data.filters?.customEndDate || "10/08/2026"}`;
    ExcelExportService.buildSheetValidationErrors(workbook, data, periodStr, "Validation Errors");
    const buffer = await workbook.xlsx.writeBuffer();
    ExcelExportService.triggerBrowserDownload(buffer as ArrayBuffer, filename || "CakeToHome_Validation_Errors");
    return buffer as ArrayBuffer;
  }

  // ── Standalone Analytics Reports Export Aliases ──
  public static async exportSalesRevenue(data: any, filename?: string): Promise<any> {
    return ExcelExportService.exportInvoiceRegister(data, filename);
  }

  public static async exportProductsProfitability(data: any, filename?: string): Promise<void> {
    return ExcelExportService.exportProductPerformance(data, filename);
  }

  public static async exportOrdersLifecycle(data: any, filename?: string): Promise<void> {
    return ExcelExportService.exportOrderRegister(data, filename);
  }

  public static async exportGeographicSales(data: any, filename?: string): Promise<void> {
    return ExcelExportService.exportCityPerformance(data, filename);
  }

  public static async exportExceptionReport(data: any, filename?: string): Promise<void> {
    return ExcelExportService.exportExceptionCenter(data, filename);
  }

  // ── Sheet Builders for 11-Worksheet GST Engine ──
  private static buildSheetExecutiveSummary(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s1 = workbook.addWorksheet(sheetName);
    s1.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    s1.mergeCells("A1:K1");
    s1.getCell("A1").value = "CAKETOHOME GST & TAX SUMMARY REPORT";
    s1.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };
    s1.mergeCells("A2:K2");
    s1.getCell("A2").value = `Executive Summary | Period: ${periodStr} | ${this.formatBranchSubtitle(data.filters)}`;
    s1.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };
    s1.getCell("A4").value = "GSTIN:";
    s1.getCell("B4").value = resolvePrimaryGstin();
    s1.getCell("D4").value = "Generated At:";
    s1.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => { s1.getCell(ref).font = { bold: true }; });

    s1.getRow(6).values = ["Metric", "Current Value", "Previous Value", "Growth %"];
    s1.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s1.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r1 = 7;
    (data.kpis || []).forEach((kpi: any) => {
      s1.getRow(r1).values = [kpi.label, kpi.currentValue, kpi.previousValue || 0, (kpi.growthPct || 0) / 100];
      s1.getCell(`B${r1}`).numFmt = "₹#,##0.00";
      s1.getCell(`C${r1}`).numFmt = "₹#,##0.00";
      s1.getCell(`D${r1}`).numFmt = "0.00%";
      r1++;
    });
    s1.columns = [{ width: 30 }, { width: 20 }, { width: 20 }, { width: 16 }];
  }

  private static buildSheetInvoiceRegister(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s2 = workbook.addWorksheet(sheetName);
    s2.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s2, "INVOICE AUDIT REGISTER", periodStr, data.filters, 12);
    s2.getRow(6).values = ["Invoice No", "Date", "Order No", "Customer", "GSTIN", "Branch", "POS", "Taxable Amt", "CGST", "SGST", "IGST", "Total Value"];
    s2.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s2.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r2 = 7;
    (data.invoiceRegister || []).forEach((inv: any) => {
      s2.getRow(r2).values = [inv.invoiceNumber, inv.invoiceDate, inv.orderNumber, inv.customerName, inv.customerGstin, inv.branchName, inv.placeOfSupply, inv.taxableAmount, inv.cgst, inv.sgst, inv.igst, inv.totalValue];
      s2.getCell(`H${r2}`).numFmt = "₹#,##0.00";
      s2.getCell(`I${r2}`).numFmt = "₹#,##0.00";
      s2.getCell(`J${r2}`).numFmt = "₹#,##0.00";
      s2.getCell(`K${r2}`).numFmt = "₹#,##0.00";
      s2.getCell(`L${r2}`).numFmt = "₹#,##0.00";
      r2++;
    });
    s2.columns = [{ width: 20 }, { width: 14 }, { width: 16 }, { width: 24 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];
  }

  private static buildSheetGstTransactions(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s3 = workbook.addWorksheet(sheetName);
    s3.views = [{ state: "frozen", xSplit: 0, ySplit: 1, showGridLines: true }];
    const s3Headers = [
      "Invoice Date", "Invoice No", "Order No", "Customer Name", "Customer Phone",
      "Customer GSTIN", "Customer Type", "Place of Supply", "State", "Branch Name",
      "Branch GSTIN", "Product Name", "SKU", "HSN Code", "Quantity",
      "UOM", "Unit Price", "Gross Amount", "Taxable Value", "GST Rate %",
      "CGST Rate %", "CGST", "SGST Rate %", "SGST", "IGST Rate %",
      "IGST", "Total Tax", "Total Value", "Payment Method", "Payment Status", "Order Status"
    ];
    s3.getRow(1).values = s3Headers;
    s3.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s3.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    let r3 = 2;
    const sales = data.salesRegister || [];
    sales.forEach((s: any) => {
      s3.getRow(r3).values = [
        s.invoiceDate, s.invoiceNumber, s.orderNumber, s.customerName, s.customerPhone,
        s.customerGstin || "URP", s.customerGstin && s.customerGstin !== "URP" ? "B2B" : "B2C", s.placeOfSupply, s.state || "Karnataka", s.branchName,
        s.branchGstin || "29AAAAA0000A1Z5", s.productName, s.sku || "CK-TRUF", s.hsnCode || "19059090", s.quantity || 1,
        s.uom || "PCS", s.unitPrice || 0, s.grossAmount || 0, s.taxableValue || 0, (s.gstRatePct || 18) / 100,
        (s.cgstRatePct || 9) / 100, s.cgst || 0, (s.sgstRatePct || 9) / 100, s.sgst || 0, (s.igstRatePct || 0) / 100,
        s.igst || 0, s.totalTax || 0, s.totalValue || 0, s.paymentMethod || "UPI / Razorpay", s.paymentStatus || "Paid", s.orderStatus || "Delivered"
      ];
      s3.getCell(`Q${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`R${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`S${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`T${r3}`).numFmt = "0.00%";
      s3.getCell(`U${r3}`).numFmt = "0.00%";
      s3.getCell(`V${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`W${r3}`).numFmt = "0.00%";
      s3.getCell(`X${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`Y${r3}`).numFmt = "0.00%";
      s3.getCell(`Z${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`AA${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`AB${r3}`).numFmt = "₹#,##0.00";
      r3++;
    });

    if (sales.length > 0) {
      const totRow = s3.getRow(r3);
      totRow.values = [
        "TOTAL", "", "", "", "", "", "", "", "", "", "", "", "", "",
        { formula: `SUM(O2:O${r3 - 1})` }, "", "", { formula: `SUM(R2:R${r3 - 1})` },
        { formula: `SUM(S2:S${r3 - 1})` }, "", "", { formula: `SUM(V2:V${r3 - 1})` },
        "", { formula: `SUM(X2:X${r3 - 1})` }, "", { formula: `SUM(Z2:Z${r3 - 1})` },
        { formula: `SUM(AA2:AA${r3 - 1})` }, { formula: `SUM(AB2:AB${r3 - 1})` }
      ];
      totRow.font = { bold: true };
      totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      s3.getCell(`S${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`V${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`X${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`Z${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`AA${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`AB${r3}`).numFmt = "₹#,##0.00";
    }
  }

  private static buildSheetB2BSales(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s4 = workbook.addWorksheet(sheetName);
    s4.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s4, "B2B TAXABLE SUPPLIES (GSTIN REGISTERED)", periodStr, data.filters, 11);
    s4.getRow(6).values = ["Invoice No", "Date", "Customer / Trade Name", "GSTIN", "Place of Supply", "Branch", "Taxable Amt", "CGST", "SGST", "IGST", "Total Invoice"];
    s4.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s4.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r4 = 7;
    const b2bList = (data.salesRegister || []).filter((s: any) => s.customerGstin && s.customerGstin !== "URP");
    b2bList.forEach((b: any) => {
      s4.getRow(r4).values = [b.invoiceNumber, b.invoiceDate, b.customerName, b.customerGstin, b.placeOfSupply, b.branchName, b.taxableValue, b.cgst, b.sgst, b.igst, b.totalValue];
      s4.getCell(`G${r4}`).numFmt = "₹#,##0.00";
      s4.getCell(`H${r4}`).numFmt = "₹#,##0.00";
      s4.getCell(`I${r4}`).numFmt = "₹#,##0.00";
      s4.getCell(`J${r4}`).numFmt = "₹#,##0.00";
      s4.getCell(`K${r4}`).numFmt = "₹#,##0.00";
      r4++;
    });
    s4.columns = [{ width: 20 }, { width: 14 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 24 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];
  }

  private static buildSheetB2CSales(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s5 = workbook.addWorksheet(sheetName);
    s5.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s5, "B2C CONSUMER SUPPLIES (UNREGISTERED)", periodStr, data.filters, 10);
    s5.getRow(6).values = ["Invoice No", "Date", "Customer Name", "Phone", "Place of Supply", "Branch", "Taxable Amt", "CGST", "SGST", "Total Value"];
    s5.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s5.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r5 = 7;
    const b2cList = (data.salesRegister || []).filter((s: any) => !s.customerGstin || s.customerGstin === "URP");
    b2cList.forEach((b: any) => {
      s5.getRow(r5).values = [b.invoiceNumber, b.invoiceDate, b.customerName, b.customerPhone, b.placeOfSupply, b.branchName, b.taxableValue, b.cgst, b.sgst, b.totalValue];
      s5.getCell(`G${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`H${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`I${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`J${r5}`).numFmt = "₹#,##0.00";
      r5++;
    });
    s5.columns = [{ width: 20 }, { width: 14 }, { width: 24 }, { width: 16 }, { width: 18 }, { width: 24 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }];
  }

  private static buildSheetCreditNotes(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s6 = workbook.addWorksheet(sheetName);
    s6.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s6, "CREDIT / DEBIT NOTES & REFUNDS REGISTER", periodStr, data.filters, 9);
    s6.getRow(6).values = ["Credit Note No", "Date", "Original Invoice", "Customer Name", "Reason", "Taxable Amt", "CGST", "SGST", "Total Refund"];
    s6.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s6.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r6 = 7;
    (data.creditNotes || []).forEach((cn: any) => {
      s6.getRow(r6).values = [cn.cnNumber, cn.cnDate, cn.origInvoice, cn.customerName, cn.reason, cn.taxable, cn.cgst, cn.sgst, cn.totalRefund];
      s6.getCell(`F${r6}`).numFmt = "₹#,##0.00";
      s6.getCell(`G${r6}`).numFmt = "₹#,##0.00";
      s6.getCell(`H${r6}`).numFmt = "₹#,##0.00";
      s6.getCell(`I${r6}`).numFmt = "₹#,##0.00";
      r6++;
    });
    s6.columns = [{ width: 24 }, { width: 14 }, { width: 20 }, { width: 24 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }];
  }

  private static buildSheetHsnSummary(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s7 = workbook.addWorksheet(sheetName);
    s7.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s7, "STATUTORY HSN SUMMARY REPORT", periodStr, data.filters, 11);
    s7.getRow(6).values = ["HSN Code", "Description", "UQC", "Total Qty", "GST %", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax", "Total Value"];
    s7.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s7.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r7 = 7;
    (data.hsnSummary || []).forEach((h: any) => {
      s7.getRow(r7).values = [h.hsnCode, h.description, h.uom || "NOS", h.quantity, (h.gstRatePct || 18) / 100, h.taxableValue, h.cgst, h.sgst, h.igst, h.totalTax, h.totalValue];
      s7.getCell(`D${r7}`).numFmt = "#,##0.000";
      s7.getCell(`E${r7}`).numFmt = "0.00%";
      s7.getCell(`F${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`G${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`H${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`I${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`J${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`K${r7}`).numFmt = "₹#,##0.00";
      r7++;
    });
    s7.columns = [{ width: 16 }, { width: 34 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }];
  }

  private static buildSheetTaxSummary(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s8 = workbook.addWorksheet(sheetName);
    s8.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s8, "TAX RATE DISTRIBUTION SUMMARY", periodStr, data.filters, 6);
    s8.getRow(6).values = ["GST Rate Slab", "Taxable Sales", "CGST Collected", "SGST Collected", "IGST Collected", "Total Tax Collected"];
    s8.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s8.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    const rates = [0, 5, 12, 18, 28];
    let r8 = 7;
    rates.forEach((rate) => {
      const items = (data.salesRegister || []).filter((s: any) => Number(s.gstRatePct) === rate);
      const taxable = items.reduce((acc: number, cur: any) => acc + (Number(cur.taxableValue) || 0), 0);
      const cgst = items.reduce((acc: number, cur: any) => acc + (Number(cur.cgst) || 0), 0);
      const sgst = items.reduce((acc: number, cur: any) => acc + (Number(cur.sgst) || 0), 0);
      const igst = items.reduce((acc: number, cur: any) => acc + (Number(cur.igst) || 0), 0);
      const totalTax = cgst + sgst + igst;
      s8.getRow(r8).values = [`${rate}% Slab`, taxable, cgst, sgst, igst, totalTax];
      s8.getCell(`B${r8}`).numFmt = "₹#,##0.00";
      s8.getCell(`C${r8}`).numFmt = "₹#,##0.00";
      s8.getCell(`D${r8}`).numFmt = "₹#,##0.00";
      s8.getCell(`E${r8}`).numFmt = "₹#,##0.00";
      s8.getCell(`F${r8}`).numFmt = "₹#,##0.00";
      r8++;
    });
    s8.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 }];
  }

  private static buildSheetGstr1(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s9 = workbook.addWorksheet(sheetName);
    s9.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s9, "GSTR-1 STATUTORY OUTWARD RETURN SUMMARY", periodStr, data.filters, 7);
    s9.getRow(6).values = ["GSTR-1 Table", "Description", "Invoices / Records", "Taxable Value", "CGST", "SGST", "IGST"];
    s9.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s9.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    const b2bCount = (data.salesRegister || []).filter((s: any) => s.customerGstin && s.customerGstin !== "URP").length;
    const b2cCount = (data.salesRegister || []).filter((s: any) => !s.customerGstin || s.customerGstin === "URP").length;
    const cnCount = (data.creditNotes || []).length;
    const hsnCount = (data.hsnSummary || []).length;

    const gstr1Rows = [
      ["Table 4A, 4B", "B2B Taxable Invoices", b2bCount, 0, 0, 0, 0],
      ["Table 7", "B2C (Small) Outward Supplies", b2cCount, 0, 0, 0, 0],
      ["Table 9B", "Credit / Debit Notes (Registered & Unregistered)", cnCount, 0, 0, 0, 0],
      ["Table 12", "HSN Summary of Outward Supplies", hsnCount, 0, 0, 0, 0],
    ];
    let r9 = 7;
    gstr1Rows.forEach((row) => {
      s9.getRow(r9).values = row;
      s9.getCell(`D${r9}`).numFmt = "₹#,##0.00";
      s9.getCell(`E${r9}`).numFmt = "₹#,##0.00";
      s9.getCell(`F${r9}`).numFmt = "₹#,##0.00";
      s9.getCell(`G${r9}`).numFmt = "₹#,##0.00";
      r9++;
    });
    s9.columns = [{ width: 18 }, { width: 42 }, { width: 20 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }];
  }

  private static buildSheetGstr3b(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s10 = workbook.addWorksheet(sheetName);
    s10.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s10, "GSTR-3B MONTHLY SUMMARY RETURN COMPUTATION", periodStr, data.filters, 6);
    s10.getRow(6).values = ["Table Section", "Supply Nature", "Total Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax"];
    s10.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s10.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    const totalTaxable = (data.salesRegister || []).reduce((acc: number, c: any) => acc + (Number(c.taxableValue) || 0), 0);
    const totalCgst = (data.salesRegister || []).reduce((acc: number, c: any) => acc + (Number(c.cgst) || 0), 0);
    const totalSgst = (data.salesRegister || []).reduce((acc: number, c: any) => acc + (Number(c.sgst) || 0), 0);
    const totalIgst = (data.salesRegister || []).reduce((acc: number, c: any) => acc + (Number(c.igst) || 0), 0);
    s10.getRow(7).values = ["3.1(a)", "Outward Taxable Supplies (Other than zero rated)", totalTaxable, totalIgst, totalCgst, totalSgst];
    s10.getRow(8).values = ["3.1(b)", "Outward Taxable Supplies (Zero rated)", 0, 0, 0, 0];
    s10.getRow(9).values = ["3.1(c)", "Other Outward Supplies (Nil rated, exempt)", 0, 0, 0, 0];
    s10.getRow(10).values = ["4.A", "Eligible Input Tax Credit (ITC Available)", 0, 0, 0, 0];
    for (let rowIdx = 7; rowIdx <= 10; rowIdx++) {
      s10.getCell(`C${rowIdx}`).numFmt = "₹#,##0.00";
      s10.getCell(`D${rowIdx}`).numFmt = "₹#,##0.00";
      s10.getCell(`E${rowIdx}`).numFmt = "₹#,##0.00";
      s10.getCell(`F${rowIdx}`).numFmt = "₹#,##0.00";
    }
    s10.columns = [{ width: 16 }, { width: 44 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }];
  }

  private static buildSheetValidationErrors(workbook: ExcelJS.Workbook, data: any, periodStr: string, sheetName: string): void {
    const s11 = workbook.addWorksheet(sheetName);
    s11.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s11, "GST DATA QUALITY & RECONCILIATION AUDIT", periodStr, data.filters, 5);
    s11.getRow(6).values = ["Error / Warning ID", "Description / Anomaly", "Severity", "Action Required", "Status"];
    s11.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s11.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r11 = 7;
    const warnings = data.dataQualityWarnings || [];
    if (warnings.length === 0) {
      s11.getRow(7).values = ["AUDIT_OK", "No validation errors found across active invoices and product masters.", "LOW", "None", "PASS"];
    } else {
      warnings.forEach((w: any) => {
        s11.getRow(r11).values = [w.id || `ERR_${r11}`, w.title || w.description || "Warning", "MEDIUM", "Review in Product / Invoice Master", "OPEN"];
        r11++;
      });
    }
    s11.columns = [{ width: 20 }, { width: 50 }, { width: 14 }, { width: 34 }, { width: 14 }];
  }

  public static formatBranchSubtitle(filters?: any): string {
    const bIds = filters?.branchIds;
    if (!bIds || bIds.length === 0 || bIds.includes("all")) {
      return filters?.city && filters.city !== "all" ? `City: ${filters.city} | All Operating Kitchen Hubs` : "All Operating Kitchen Hubs";
    }
    if (bIds.length === 1) {
      return `Kitchen Hub: ${bIds[0]}`;
    }
    return `Kitchen Hubs: ${bIds.length} Selected`;
  }

  private static styleWorksheetHeader(sheet: ExcelJS.Worksheet, title: string, periodStr: string, filters?: any, colCount: number = 11): void {
    const lastColLetter = String.fromCharCode(64 + Math.min(colCount, 26));

    sheet.mergeCells(`A1:${lastColLetter}1`);
    sheet.getCell("A1").value = resolveExportBrandLine();
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF991B1B" } };

    sheet.mergeCells(`A2:${lastColLetter}2`);
    sheet.getCell("A2").value = `${title} | Period: ${periodStr} | ${this.formatBranchSubtitle(filters)}`;
    sheet.getCell("A2").font = { size: 11, italic: true, color: { argb: "FF475569" } };

    sheet.getCell("A4").value = "GSTIN:";
    sheet.getCell("B4").value = resolvePrimaryGstin();
    sheet.getCell("D4").value = "Generated At:";
    sheet.getCell("E4").value = new Date().toLocaleString("en-IN");
    ["A4", "D4"].forEach((ref) => { sheet.getCell(ref).font = { bold: true }; });
  }

  // ── 1. STATUTORY B2C HSN SUMMARY EXPORT (Exact layout matching statutory reference) ──
  public static async exportGstHsnSummary(data: { gstSummary: { items: any[]; totals: any }; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GST HSN Summary");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "10/08/2026";
    const toDate = data.filters?.customEndDate || "10/08/2026";
    const periodStr = `${fromDate} TO ${toDate}`;

    this.styleWorksheetHeader(sheet, "SALES B2C HSN CODE SUMMARY", periodStr, data.filters, 11);

    const headers = [
      "HSNCODE", "Description", "UQC", "Total QTY", "TOTAL VALUE",
      "GST %", "Taxable Amt", "IGST", "CGST", "SGST", "CESS"
    ];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.gstSummary?.items || [];
    let rIdx = 7;
    for (const item of items) {
      const row = sheet.getRow(rIdx);
      row.values = [
        item.hsnCode,
        item.description,
        item.uom || "NOS - NUMBERS",
        item.quantity,
        item.totalValue,
        item.gstRatePct / 100,
        item.taxableValue,
        item.igst,
        item.cgst,
        item.sgst,
        item.cess || 0,
      ];

      // Formatting
      sheet.getCell(`D${rIdx}`).numFmt = "#,##0.000";
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "0.00%";
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`H${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`I${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`J${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`K${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Bold TOTALS Row
    const totals = data.gstSummary?.totals;
    if (totals) {
      const totRow = sheet.getRow(rIdx);
      totRow.values = [
        "TOTAL",
        "Statutory B2C Summary Total",
        "",
        totals.quantity,
        totals.totalValue,
        "",
        totals.taxableValue,
        totals.igst,
        totals.cgst,
        totals.sgst,
        totals.cess || 0,
      ];
      totRow.font = { bold: true };
      totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

      sheet.getCell(`D${rIdx}`).numFmt = "#,##0.000";
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`H${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`I${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`J${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`K${rIdx}`).numFmt = "₹#,##0.00";
    }

    sheet.columns = [
      { width: 14 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 16 },
      { width: 10 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GST_B2C_HSN_Summary_${fromDate}_to_${toDate}`);
  }

  // ── 2. DAILY SALES REPORT EXPORT ──
  public static async exportDailySalesReport(data: { daily: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Daily Sales Report");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    this.styleWorksheetHeader(sheet, "DAILY OPERATIONAL SALES REPORT", fromDate, data.filters, 8);

    // Section 1: KPI Summary
    sheet.getCell("A6").value = "Daily Operational KPIs";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.mergeCells("A6:B6");
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const stats = data.daily?.stats || {};
    const kpiRows = [
      ["Total Orders", stats.totalOrders, "#,##0"],
      ["Gross Sales (Incl. Tax)", stats.grossRevenue, "₹#,##0.00"],
      ["Total Discounts", stats.discounts, "₹#,##0.00"],
      ["Net Sales (Excl. Tax)", stats.netSalesExclTax, "₹#,##0.00"],
      ["GST Tax Collected", stats.gstCollected, "₹#,##0.00"],
      ["Delivery Revenue", stats.deliveryFleetCosts || 0, "₹#,##0.00"],
      ["Average Order Value (AOV)", stats.aov, "₹#,##0.00"],
      ["Delivered Orders", stats.deliveredOrders, "#,##0"],
      ["Cancelled Orders", stats.cancelledOrders, "#,##0"],
      ["Customer Refunds", stats.refunds, "₹#,##0.00"],
    ];

    let rIdx = 7;
    for (const [lbl, val, fmt] of kpiRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`B${rIdx}`).value = val;
      sheet.getCell(`B${rIdx}`).numFmt = fmt;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      rIdx++;
    }

    // Section 2: Payment Reconciliation Table
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:E${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "DAILY PAYMENT RECONCILIATION SUMMARY";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Payment Method", "Order Count", "Gross Amount", "Refund Amount", "Net Collected Amount"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const payments = data.daily?.paymentSummary || [];
    for (const p of payments) {
      sheet.getRow(rIdx).values = [p.method, p.count, p.gross, p.refundAmount || 0, p.netAmount || p.gross];
      sheet.getCell(`C${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`D${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Section 3: Branch Breakdown
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:H${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "DAILY KITCHEN HUB BREAKDOWN";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Kitchen Hub", "Code", "City", "Orders", "Gross Sales", "Net Sales", "AOV", "Delivered"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const branches = data.daily?.branchSummary || [];
    for (const b of branches) {
      sheet.getRow(rIdx).values = [b.branchName, b.branchCode, b.city || "Bengaluru", b.ordersCount, b.grossSales, b.netSales, b.aov, b.deliveredCount];
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Daily_Sales_Report_${fromDate}`);
  }

  // ── 3. WEEKLY SALES REPORT EXPORT ──
  public static async exportWeeklySalesReport(data: { weekly: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Weekly Sales Report");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "Week-Current";
    this.styleWorksheetHeader(sheet, "WEEKLY SALES & PRODUCT PERFORMANCE REPORT", fromDate, data.filters, 8);

    // Section 1: Weekly Top 3 Best Selling Cakes
    sheet.mergeCells("A6:F6");
    sheet.getCell("A6").value = "TOP 3 BEST SELLING CAKES";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };

    sheet.getRow(7).values = ["Rank", "Cake / Product", "SKU", "Units Sold", "Net Revenue", "Average Price"];
    sheet.getRow(7).font = { bold: true };
    sheet.getRow(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    const top3 = data.weekly?.top3Cakes || [];
    let rIdx = 8;
    for (const p of top3) {
      sheet.getRow(rIdx).values = [`#${p.rank || 1}`, p.name, p.sku, p.quantitySold, p.netSales, p.avgSellingPrice];
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Section 2: Least Selling Cakes
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:F${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "LEAST SELLING CAKES (OPPORTUNITY & ROTATION)";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Rank", "Cake / Product", "SKU", "Units Sold", "Net Revenue", "Average Price"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const least = data.weekly?.leastSellingCakes || [];
    for (const p of least) {
      sheet.getRow(rIdx).values = [`#${p.rank || 1}`, p.name, p.sku, p.quantitySold, p.netSales, p.avgSellingPrice];
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Section 3: Weekly Payment Mix
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:E${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "WEEKLY PAYMENT METHOD PERFORMANCE";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Payment Method", "Orders", "Gross Value", "Refunds", "% of Total Payment"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const payments = data.weekly?.payments || [];
    for (const p of payments) {
      sheet.getRow(rIdx).values = [p.method, p.count, p.gross, p.refundAmount || 0, (p.percentage || 0) / 100];
      sheet.getCell(`C${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`D${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`E${rIdx}`).numFmt = "0.00%";
      rIdx++;
    }

    sheet.columns = [{ width: 10 }, { width: 34 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 16 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Weekly_Sales_Report_${fromDate}`);
  }

  // ── 4. MONTHLY SALES REPORT EXPORT ──
  public static async exportMonthlySalesReport(data: { monthly: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Monthly Sales Report");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const periodStr = data.filters?.customStartDate || "Current Month";
    this.styleWorksheetHeader(sheet, "MONTHLY EXECUTIVE SALES & GROWTH REPORT", periodStr, data.filters, 8);

    // Section 1: Month-over-Month Growth
    sheet.mergeCells("A6:C6");
    sheet.getCell("A6").value = "MONTH-OVER-MONTH SALES GROWTH";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    sheet.getRow(7).values = ["Metric", "Current Month", "Previous Month", "Growth %"];
    sheet.getRow(7).font = { bold: true };
    sheet.getRow(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    const m = data.monthly || {};
    sheet.getRow(8).values = ["Net Sales (Excl. Tax)", m.currentMonthSales || 0, m.prevMonthSales || 0, m.growthPctDisplay || "0.0%"];
    sheet.getCell("B8").numFmt = "₹#,##0.00";
    sheet.getCell("C8").numFmt = "₹#,##0.00";

    // Section 2: Delivery SLA Performance
    let rIdx = 11;
    sheet.mergeCells(`A${rIdx}:D${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "MONTHLY DELIVERY SLA PERFORMANCE";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Total Dispatched", "On-Time Deliveries", "Delayed Deliveries", "SLA Compliance %"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const del = m.deliverySla || {};
    sheet.getRow(rIdx).values = [del.totalDeliveries || 0, del.onTimeDeliveries || 0, del.delayedDeliveries || 0, (del.slaCompliancePct || 100) / 100];
    sheet.getCell(`D${rIdx}`).numFmt = "0.00%";

    // Section 3: Customer Retention
    rIdx += 3;
    sheet.mergeCells(`A${rIdx}:E${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "CUSTOMER RETENTION & LIFETIME VALUE";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Total Customers", "New Customers", "Repeat Customers (>1 Order)", "Repeat Purchase Rate", "Estimated LTV"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const cust = m.customerRetention || {};
    sheet.getRow(rIdx).values = [cust.totalCustomers || 0, cust.newCustomers || 0, cust.repeatCustomers || 0, (cust.repeatPurchaseRate || 0) / 100, cust.ltv || 0];
    sheet.getCell(`D${rIdx}`).numFmt = "0.00%";
    sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";

    sheet.columns = [{ width: 28 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 18 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Monthly_Sales_Report_${periodStr}`);
  }

  // ── 5. GST DETAILED REGISTER EXPORT ──
  public static async exportGstDetailedRegister(data: { register: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GST Detailed Register");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "10/08/2026";
    this.styleWorksheetHeader(sheet, "GST DETAILED TRANSACTION REGISTER", fromDate, data.filters, 24);

    const headers = [
      "Invoice Number", "Order ID", "Order Date", "Customer Name", "Customer GSTIN",
      "City", "Kitchen Hub", "Class", "Product", "SKU", "HSN", "UQC", "Qty",
      "Unit Price", "Discount", "Taxable Value", "GST %", "CGST %", "CGST Amount",
      "SGST %", "SGST Amount", "IGST %", "IGST Amount", "Total Tax", "Invoice Total"
    ];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.register || [];
    let rIdx = 7;
    for (const r of items) {
      sheet.getRow(rIdx).values = [
        r.invoiceNumber, r.orderId, r.orderDate, r.customerName, r.customerGstin || "URP",
        r.city, r.branchName, r.classification || "B2C", r.productName, r.sku, r.hsnCode,
        r.uqc || "NOS", r.quantity, r.unitPrice, r.discount, r.taxableValue, r.gstRatePct / 100,
        r.cgstRatePct / 100, r.cgstAmount, r.sgstRatePct / 100, r.sgstAmount,
        r.igstRatePct / 100, r.igstAmount, r.totalTax, r.invoiceTotal
      ];

      sheet.getCell(`N${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`O${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`P${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`Q${rIdx}`).numFmt = "0.00%";
      sheet.getCell(`R${rIdx}`).numFmt = "0.00%";
      sheet.getCell(`S${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`T${rIdx}`).numFmt = "0.00%";
      sheet.getCell(`U${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`V${rIdx}`).numFmt = "0.00%";
      sheet.getCell(`W${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`X${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`Y${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [
      { width: 18 }, { width: 16 }, { width: 14 }, { width: 22 }, { width: 18 },
      { width: 14 }, { width: 20 }, { width: 10 }, { width: 30 }, { width: 16 },
      { width: 12 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 14 },
      { width: 16 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 10 },
      { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 16 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_GST_Detailed_Register_${fromDate}`);
  }

  // ── 6. ORDER REGISTER EXPORT ──
  public static async exportOrderRegister(data: { orders: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Order Register");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "10/08/2026";
    this.styleWorksheetHeader(sheet, "OPERATIONAL ORDER RECONCILIATION REGISTER", fromDate, data.filters, 16);

    const headers = [
      "Order ID", "Invoice Number", "Order Date", "Customer Name", "Phone",
      "City", "Area", "Pincode", "Kitchen Hub", "Payment Method",
      "Order Status", "Delivery Status", "Gross Total", "Discount", "GST Tax", "Grand Total"
    ];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.orders || [];
    let rIdx = 7;
    for (const o of items) {
      sheet.getRow(rIdx).values = [
        o.id, o.invoiceNumber, o.orderDate, o.customerName, o.customerPhone,
        o.city, o.area, o.pincode, o.branchName, o.paymentMethod,
        o.orderStatus, o.deliveryStatus, o.grossAmount, o.discount, o.taxAmount, o.netAmount
      ];
      sheet.getCell(`M${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`N${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`O${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`P${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [
      { width: 16 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 16 },
      { width: 14 }, { width: 18 }, { width: 12 }, { width: 22 }, { width: 16 },
      { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Order_Register_${fromDate}`);
  }

  // ── 7. PRODUCT PERFORMANCE EXPORT ──
  public static async exportProductPerformance(data: { products: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Product Performance");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "Current";
    this.styleWorksheetHeader(sheet, "PRODUCT SALES & PROFITABILITY REPORT", fromDate, data.filters, 12);

    const headers = [
      "Rank", "Product Name", "SKU", "Category", "HSN Code",
      "Units Sold", "Gross Sales", "Discounts", "Net Sales", "Total COGS", "Gross Profit", "Margin %"
    ];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.products || [];
    let rIdx = 7;
    items.forEach((p, idx) => {
      sheet.getRow(rIdx).values = [
        `#${idx + 1}`, p.name, p.sku, p.category, p.hsnCode,
        p.quantitySold, p.grossSales, p.discounts, p.netSales, p.totalCogs, p.grossProfit, p.grossMarginPct / 100
      ];
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`H${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`I${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`J${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`K${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`L${rIdx}`).numFmt = "0.00%";
      rIdx++;
    });

    sheet.columns = [
      { width: 10 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 14 },
      { width: 12 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Product_Performance_${fromDate}`);
  }

  // ── 8. CITY / REGIONAL SALES EXPORT ──
  public static async exportCityPerformance(data: { cities: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("City Performance");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "Current";
    this.styleWorksheetHeader(sheet, "CITY & REGIONAL SALES DISTRIBUTION", fromDate, data.filters, 8);

    const headers = ["City", "Orders", "Units Sold", "Gross Sales", "Net Sales", "AOV", "Delivered", "Cancelled"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.cities || [];
    let rIdx = 7;
    for (const c of items) {
      sheet.getRow(rIdx).values = [c.city, c.orders, c.units, c.grossSales, c.netSales, c.aov, c.delivered, c.cancelled];
      sheet.getCell(`D${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [{ width: 22 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 12 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_City_Sales_Report_${fromDate}`);
  }

  // ── 9. AREA & PINCODE SALES EXPORT ──
  public static async exportAreaPincodeSales(data: { areaPincodes: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Area Pincode Sales");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "Current";
    this.styleWorksheetHeader(sheet, "AREA & PINCODE SALES DISTRIBUTION", fromDate, data.filters, 8);

    const headers = ["Pincode", "Area / Locality", "City", "Kitchen Hub", "Orders", "Total Revenue", "AOV", "Delivered"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.areaPincodes || [];
    let rIdx = 7;
    for (const a of items) {
      sheet.getRow(rIdx).values = [a.pincode, a.area, a.city, a.branch, a.orders, a.revenue, a.aov, a.delivered];
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [{ width: 14 }, { width: 24 }, { width: 16 }, { width: 24 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 12 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Area_Pincode_Sales_${fromDate}`);
  }

  // ── 10. BRANCH PERFORMANCE EXPORT ──
  public static async exportBranchPerformance(data: { cities: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Branch Performance");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || "Current";
    this.styleWorksheetHeader(sheet, "KITCHEN HUB BRANCH PERFORMANCE", fromDate, data.filters, 8);

    const headers = ["Kitchen Hub", "Code", "City", "Orders", "Gross Sales", "Net Sales", "AOV", "Delivered"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.cities || [];
    let rIdx = 7;
    for (const b of items) {
      sheet.getRow(rIdx).values = [b.branchName, b.branchCode, b.city || "Bengaluru", b.ordersCount, b.grossSales, b.netSales, b.aov, b.deliveredCount];
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [{ width: 28 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Branch_Performance_${fromDate}`);
  }

  // ── 11. EXECUTIVE SUMMARY EXPORT ──
  public static async exportExecutiveSummary(data: { kpis: any[]; stats: any; top3: any[]; bottom3: any[]; paymentBreakdown: any[]; deliverySla: any; customerRetention: any; cityPerformance: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Executive Summary");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    const toDate = data.filters?.customEndDate || new Date().toISOString().slice(0, 10);
    const periodStr = `${fromDate} TO ${toDate}`;
    this.styleWorksheetHeader(sheet, "EXECUTIVE MANAGEMENT SUMMARY", periodStr, data.filters, 6);

    // Section 1: KPI Dashboard
    sheet.mergeCells("A6:E6");
    sheet.getCell("A6").value = "KEY PERFORMANCE INDICATORS";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    sheet.getRow(7).values = ["KPI Metric", "Current Period", "Previous Period", "Growth %", "Unit"];
    sheet.getRow(7).font = { bold: true };
    sheet.getRow(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    let rIdx = 8;
    for (const k of (data.kpis || [])) {
      sheet.getCell(`A${rIdx}`).value = k.label;
      sheet.getCell(`B${rIdx}`).value = k.currentValue;
      sheet.getCell(`C${rIdx}`).value = k.previousValue;
      sheet.getCell(`D${rIdx}`).value = `${k.growthPct > 0 ? "+" : ""}${k.growthPct}%`;
      sheet.getCell(`E${rIdx}`).value = k.unit;
      sheet.getCell(`B${rIdx}`).numFmt = k.unit === "currency" ? "₹#,##0.00" : (k.unit === "percentage" ? "0.00%" : "#,##0");
      sheet.getCell(`C${rIdx}`).numFmt = k.unit === "currency" ? "₹#,##0.00" : (k.unit === "percentage" ? "0.00%" : "#,##0");
      rIdx++;
    }

    // Section 2: Transactional Summary
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:B${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "TRANSACTIONAL SUMMARY";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    const stats = data.stats || {};
    const statRows: [string, any, string][] = [
      ["Total Orders", stats.totalOrders || 0, "#,##0"],
      ["Gross Revenue", stats.grossRevenue || 0, "₹#,##0.00"],
      ["Total Discounts", stats.discounts || 0, "₹#,##0.00"],
      ["Net Sales (Excl. Tax)", stats.netSalesExclTax || 0, "₹#,##0.00"],
      ["GST Tax Collected", stats.gstCollected || 0, "₹#,##0.00"],
      ["Delivery Revenue", stats.deliveryFleetCosts || 0, "₹#,##0.00"],
      ["Average Order Value", stats.aov || 0, "₹#,##0.00"],
      ["Delivered Orders", stats.deliveredOrders || 0, "#,##0"],
      ["Cancelled Orders", stats.cancelledOrders || 0, "#,##0"],
      ["Total Refunds", stats.refunds || 0, "₹#,##0.00"],
    ];
    for (const [lbl, val, fmt] of statRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      sheet.getCell(`B${rIdx}`).value = val;
      sheet.getCell(`B${rIdx}`).numFmt = fmt;
      rIdx++;
    }

    // Section 3: Top 3 Best Selling Products
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:E${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "TOP 3 BEST SELLING PRODUCTS";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
    rIdx++;
    sheet.getRow(rIdx).values = ["Rank", "Product Name", "SKU", "Units Sold", "Net Revenue"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;
    for (const [i, p] of (data.top3 || []).entries()) {
      sheet.getRow(rIdx).values = [`#${i + 1}`, p.name || p.productName, p.sku, p.quantitySold, p.netSales];
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Section 4: Payment Mix
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:D${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "PAYMENT METHOD BREAKDOWN";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;
    sheet.getRow(rIdx).values = ["Payment Method", "Orders", "Gross Amount", "Net Collected"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;
    for (const p of (data.paymentBreakdown || [])) {
      sheet.getRow(rIdx).values = [p.method, p.count, p.gross, p.netAmount || p.gross];
      sheet.getCell(`C${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`D${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Section 5: Delivery SLA
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:D${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "DELIVERY SLA PERFORMANCE";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;
    const del = data.deliverySla || {};
    const delRows: [string, any][] = [
      ["Total Dispatched", del.totalDeliveries || 0],
      ["On-Time Deliveries", del.onTimeDeliveries || 0],
      ["Delayed Deliveries", del.delayedDeliveries || 0],
      ["Failed Deliveries", del.failedDeliveries || 0],
      ["Avg Processing Time", `${del.avgProcessingMinutes || 0} mins`],
      ["Avg Delivery Time", `${del.avgDeliveryMinutes || 0} mins`],
    ];
    for (const [lbl, val] of delRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      sheet.getCell(`B${rIdx}`).value = val;
      rIdx++;
    }

    // Section 6: Customer Retention
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:B${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "CUSTOMER RETENTION";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;
    const cust = data.customerRetention || {};
    const custRows: [string, any, string][] = [
      ["Total Customers", cust.totalCustomers || 0, "#,##0"],
      ["New Customers", cust.newCustomers || 0, "#,##0"],
      ["Repeat Customers", cust.repeatCustomers || 0, "#,##0"],
      ["Repeat Purchase Rate", (cust.repeatPurchaseRate || 0) / 100, "0.00%"],
      ["Customer Lifetime Value", cust.ltv || 0, "₹#,##0.00"],
    ];
    for (const [lbl, val, fmt] of custRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      sheet.getCell(`B${rIdx}`).value = val;
      sheet.getCell(`B${rIdx}`).numFmt = fmt;
      rIdx++;
    }

    sheet.columns = [{ width: 30 }, { width: 22 }, { width: 20 }, { width: 18 }, { width: 16 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Executive_Summary_${fromDate}`);
  }

  // ── 12. PAYMENTS & REFUNDS EXPORT ──
  public static async exportPaymentsRefunds(data: { payments: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Payments & Refunds");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    this.styleWorksheetHeader(sheet, "PAYMENT METHOD RECONCILIATION & REFUND REPORT", fromDate, data.filters, 6);

    // Section 1: Payment Breakdown Table
    sheet.mergeCells("A6:F6");
    sheet.getCell("A6").value = "PAYMENT METHOD BREAKDOWN";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    sheet.getRow(7).values = ["Payment Method", "Order Count", "Gross Collection", "Refunds", "Net Collection", "Share %"];
    sheet.getRow(7).font = { bold: true };
    sheet.getRow(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    const payments = data.payments || {};
    const breakdown = payments.breakdown || [];
    const totalGross = payments.totalCollected || 0;
    let rIdx = 8;
    for (const p of breakdown) {
      const share = totalGross > 0 ? p.gross / totalGross : 0;
      sheet.getRow(rIdx).values = [p.method, p.count, p.gross, p.refundAmount || 0, p.netAmount || p.gross, share];
      sheet.getCell(`C${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`D${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`F${rIdx}`).numFmt = "0.00%";
      rIdx++;
    }

    // Totals row
    const totRow = sheet.getRow(rIdx);
    totRow.values = ["TOTAL", breakdown.reduce((s: number, p: any) => s + (p.count || 0), 0), totalGross, payments.totalRefunds || 0, payments.netCollected || 0, 1];
    totRow.font = { bold: true };
    totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    sheet.getCell(`C${rIdx}`).numFmt = "₹#,##0.00";
    sheet.getCell(`D${rIdx}`).numFmt = "₹#,##0.00";
    sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
    sheet.getCell(`F${rIdx}`).numFmt = "0.00%";

    // Section 2: Reconciliation Summary
    rIdx += 3;
    sheet.mergeCells(`A${rIdx}:B${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "RECONCILIATION SUMMARY";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;
    sheet.getCell(`A${rIdx}`).value = "Total Payment Collections";
    sheet.getCell(`A${rIdx}`).font = { bold: true };
    sheet.getCell(`B${rIdx}`).value = totalGross;
    sheet.getCell(`B${rIdx}`).numFmt = "₹#,##0.00";
    rIdx++;
    sheet.getCell(`A${rIdx}`).value = "Total Refunds";
    sheet.getCell(`A${rIdx}`).font = { bold: true };
    sheet.getCell(`B${rIdx}`).value = payments.totalRefunds || 0;
    sheet.getCell(`B${rIdx}`).numFmt = "₹#,##0.00";
    rIdx++;
    sheet.getCell(`A${rIdx}`).value = "Net Collection";
    sheet.getCell(`A${rIdx}`).font = { bold: true, size: 12 };
    sheet.getCell(`B${rIdx}`).value = payments.netCollected || 0;
    sheet.getCell(`B${rIdx}`).numFmt = "₹#,##0.00";
    sheet.getCell(`B${rIdx}`).font = { bold: true, size: 12 };

    sheet.columns = [{ width: 24 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 20 }, { width: 14 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Payments_Refunds_${fromDate}`);
  }

  // ── 13. DELIVERY & FLEET EXPORT ──
  public static async exportDeliveryFleet(data: { delivery: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Delivery & Fleet");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    this.styleWorksheetHeader(sheet, "DELIVERY FLEET & SLA PERFORMANCE REPORT", fromDate, data.filters, 6);

    // Section 1: SLA Summary
    sheet.mergeCells("A6:B6");
    sheet.getCell("A6").value = "DELIVERY SLA PERFORMANCE SUMMARY";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const del = data.delivery || {};
    const slaRows: [string, any, string][] = [
      ["Total Dispatched", del.totalDeliveries || 0, "#,##0"],
      ["Delivered Successfully", del.deliveredOrders || 0, "#,##0"],
      ["On-Time Deliveries", del.onTimeDeliveries || 0, "#,##0"],
      ["Delayed Deliveries", del.delayedDeliveries || 0, "#,##0"],
      ["Failed/Cancelled", del.failedDeliveries || 0, "#,##0"],
      ["SLA Compliance", (del.slaCompliancePct || 0) / 100, "0.00%"],
      ["Avg Processing Time", del.avgProcessingMinutes || 0, "#,##0\" mins\""],
      ["Avg Delivery Time", del.avgDeliveryMinutes || 0, "#,##0\" mins\""],
    ];
    let rIdx = 7;
    for (const [lbl, val, fmt] of slaRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      sheet.getCell(`B${rIdx}`).value = val;
      sheet.getCell(`B${rIdx}`).numFmt = fmt;
      rIdx++;
    }

    // Section 2: Fleet Partner Performance
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:H${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "FLEET PARTNER PERFORMANCE";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Partner Name", "Partner ID", "Kitchen Hub", "Status", "Total Deliveries", "On-Time", "Delayed", "Rating"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const partners = del.partners || [];
    for (const p of partners) {
      sheet.getRow(rIdx).values = [p.driverName, p.partnerNumber || p.id, p.branchName, p.status, p.total, p.onTime, p.delayed, p.rating];
      rIdx++;
    }

    sheet.columns = [{ width: 26 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 10 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Delivery_Fleet_${fromDate}`);
  }

  // ── 14. CUSTOMER ANALYTICS EXPORT ──
  public static async exportCustomerAnalytics(data: { customers: any; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customer Analytics");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    this.styleWorksheetHeader(sheet, "CUSTOMER ANALYTICS & RETENTION REPORT", fromDate, data.filters, 8);

    // Section 1: Summary Metrics
    sheet.mergeCells("A6:B6");
    sheet.getCell("A6").value = "CUSTOMER RETENTION SUMMARY";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const cust = data.customers || {};
    const summaryRows: [string, any, string][] = [
      ["Total Active Customers", cust.totalCustomers || 0, "#,##0"],
      ["New Customers", cust.newCustomers || 0, "#,##0"],
      ["Repeat Customers (>1 Order)", cust.repeatCustomers || 0, "#,##0"],
      ["Repeat Purchase Rate", (cust.repeatPurchaseRate || 0) / 100, "0.00%"],
      ["Customer Lifetime Value (LTV)", cust.ltv || 0, "₹#,##0.00"],
      ["Avg Orders Per Customer", cust.avgOrdersPerCustomer || 0, "#,##0.0"],
    ];
    let rIdx = 7;
    for (const [lbl, val, fmt] of summaryRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      sheet.getCell(`B${rIdx}`).value = val;
      sheet.getCell(`B${rIdx}`).numFmt = fmt;
      rIdx++;
    }

    // Section 2: Customer Detail Table
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:H${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "CUSTOMER DETAIL TABLE";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Customer ID", "Customer Name", "Email", "Phone", "Total Orders", "Total Spend", "AOV", "Segment"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    const topCustomers = cust.topCustomers || [];
    for (const c of topCustomers) {
      sheet.getRow(rIdx).values = [c.id, c.name, c.email, c.phone, c.totalOrders, c.totalSpend, c.aov, c.segment];
      sheet.getCell(`F${rIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`G${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    sheet.columns = [{ width: 18 }, { width: 24 }, { width: 26 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 16 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Customer_Analytics_${fromDate}`);
  }

  // ── 15. CROSS-SELL & UPSELL EXPORT ──
  public static async exportCrossSellUpsell(data: { crossSell: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cross-Sell & Upsell");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    this.styleWorksheetHeader(sheet, "CROSS-SELL & UPSELL BASKET AFFINITY REPORT", fromDate, data.filters, 5);

    const headers = ["Primary Product", "Co-Purchased Item", "Co-Purchase Count", "Attach Rate %", "Added Revenue"];
    sheet.getRow(6).values = headers;
    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.crossSell || [];
    let rIdx = 7;
    for (const cs of items) {
      sheet.getRow(rIdx).values = [cs.primaryItem, cs.coPurchasedItem, cs.coPurchaseCount, (cs.attachRatePct || 0) / 100, cs.addedRevenue];
      sheet.getCell(`D${rIdx}`).numFmt = "0.00%";
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
      rIdx++;
    }

    // Totals
    if (items.length > 0) {
      const totRow = sheet.getRow(rIdx);
      totRow.values = ["TOTAL", "", items.reduce((s: number, i: any) => s + (i.coPurchaseCount || 0), 0), "", items.reduce((s: number, i: any) => s + (i.addedRevenue || 0), 0)];
      totRow.font = { bold: true };
      totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      sheet.getCell(`E${rIdx}`).numFmt = "₹#,##0.00";
    }

    sheet.columns = [{ width: 34 }, { width: 30 }, { width: 20 }, { width: 16 }, { width: 18 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Cross_Sell_Upsell_${fromDate}`);
  }

  // ── 16. EXCEPTION CENTER EXPORT ──
  public static async exportExceptionCenter(data: { exceptions: any[]; filters?: any }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Exception Center");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];

    const fromDate = data.filters?.customStartDate || new Date().toISOString().slice(0, 10);
    this.styleWorksheetHeader(sheet, "EXCEPTION CENTER AUDIT REPORT", fromDate, data.filters, 9);

    // Section 1: Summary
    sheet.mergeCells("A6:D6");
    sheet.getCell("A6").value = "EXCEPTION SEVERITY SUMMARY";
    sheet.getCell("A6").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const items = data.exceptions || [];
    const critical = items.filter((e: any) => e.severity === "critical").length;
    const high = items.filter((e: any) => e.severity === "high").length;
    const medium = items.filter((e: any) => e.severity === "medium").length;
    const low = items.filter((e: any) => e.severity === "low").length;
    const open = items.filter((e: any) => e.status === "OPEN").length;
    const resolved = items.filter((e: any) => e.status === "RESOLVED").length;

    const summaryRows: [string, number][] = [
      ["Total Exceptions", items.length],
      ["Critical", critical],
      ["High", high],
      ["Medium", medium],
      ["Low", low],
      ["Open", open],
      ["Resolved", resolved],
    ];
    let rIdx = 7;
    for (const [lbl, val] of summaryRows) {
      sheet.getCell(`A${rIdx}`).value = lbl;
      sheet.getCell(`A${rIdx}`).font = { bold: true };
      sheet.getCell(`B${rIdx}`).value = val;
      rIdx++;
    }

    // Section 2: Exception Detail Table
    rIdx += 2;
    sheet.mergeCells(`A${rIdx}:I${rIdx}`);
    sheet.getCell(`A${rIdx}`).value = "EXCEPTION DETAILS";
    sheet.getCell(`A${rIdx}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    rIdx++;

    sheet.getRow(rIdx).values = ["Exception ID", "Severity", "Category", "Type", "Title", "Description", "Affected Count", "Status", "Detected At"];
    sheet.getRow(rIdx).font = { bold: true };
    sheet.getRow(rIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    rIdx++;

    for (const exc of items) {
      sheet.getRow(rIdx).values = [
        exc.id, (exc.severity || "").toUpperCase(), exc.category, exc.type,
        exc.title, exc.description, exc.affectedCount || 1, exc.status, exc.detectedAt
      ];
      rIdx++;
    }

    sheet.columns = [{ width: 22 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 40 }, { width: 50 }, { width: 16 }, { width: 12 }, { width: 22 }];
    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Exception_Center_${fromDate}`);
  }

  // ── COMPLETE 16-SHEET ENTERPRISE WORKBOOK EXPORT ──

  public static async exportCompleteWorkbook(data: {
    kpis: any[];
    daily: any;
    weekly: any;
    monthly: any;
    products: any[];
    branches: any[];
    cities: any[];
    areaPincodes: any[];
    payments: any;
    delivery: any;
    customers: any;
    gstSummary: { items: any[]; totals: any };
    gstDetailedRegister: any[];
    orderRegister: any[];
    crossSell?: any[];
    exceptions?: any[];
    filters?: any;
  }, filename?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const fromDate = data.filters?.customStartDate || "2026-08-01";
    const toDate = data.filters?.customEndDate || "2026-08-10";
    const periodStr = `${fromDate} TO ${toDate}`;

    // Sheet 1: Executive Summary
    const s1 = workbook.addWorksheet("Executive Summary");
    s1.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s1, "EXECUTIVE MANAGEMENT DASHBOARD", periodStr, data.filters, 6);
    s1.getRow(6).values = ["Executive KPI Metric", "Current Period", "Previous Period", "Growth %", "Unit"];
    s1.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s1.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r1 = 7;
    (data.kpis || []).forEach((k) => {
      s1.getCell(`A${r1}`).value = k.label;
      s1.getCell(`B${r1}`).value = k.currentValue;
      s1.getCell(`C${r1}`).value = k.previousValue;
      s1.getCell(`D${r1}`).value = `${k.growthPct > 0 ? "+" : ""}${k.growthPct}%`;
      s1.getCell(`E${r1}`).value = k.unit;
      s1.getCell(`B${r1}`).numFmt = k.unit === "currency" ? "₹#,##0.00" : (k.unit === "percentage" ? "0.00%" : "#,##0");
      s1.getCell(`C${r1}`).numFmt = k.unit === "currency" ? "₹#,##0.00" : (k.unit === "percentage" ? "0.00%" : "#,##0");
      r1++;
    });
    s1.columns = [{ width: 34 }, { width: 20 }, { width: 20 }, { width: 14 }, { width: 14 }];

    // Sheet 2: Daily Sales
    const s2 = workbook.addWorksheet("Daily Sales");
    s2.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s2, "DAILY SALES AUDIT", periodStr, data.filters, 6);
    s2.getRow(6).values = ["Payment Method", "Order Count", "Gross Amount", "Refund Amount", "Net Collected"];
    s2.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s2.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r2 = 7;
    (data.daily?.paymentSummary || []).forEach((p: any) => {
      s2.getRow(r2).values = [p.method, p.count, p.gross, p.refundAmount || 0, p.netAmount || p.gross];
      s2.getCell(`C${r2}`).numFmt = "₹#,##0.00";
      s2.getCell(`D${r2}`).numFmt = "₹#,##0.00";
      s2.getCell(`E${r2}`).numFmt = "₹#,##0.00";
      r2++;
    });
    s2.columns = [{ width: 24 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }];

    // Sheet 3: Weekly Sales (Top 3 & Least Selling)
    const s3 = workbook.addWorksheet("Weekly Sales");
    s3.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s3, "WEEKLY SALES & PRODUCT RANKING", periodStr, data.filters, 6);
    s3.getRow(6).values = ["Category Ranking", "Cake / Product Name", "SKU", "Units Sold", "Net Revenue", "Average Price"];
    s3.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s3.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r3 = 7;
    (data.weekly?.top3Cakes || []).forEach((p: any) => {
      s3.getRow(r3).values = [`Top #${p.rank}`, p.name, p.sku, p.quantitySold, p.netSales, p.avgSellingPrice];
      s3.getCell(`E${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`F${r3}`).numFmt = "₹#,##0.00";
      r3++;
    });
    (data.weekly?.leastSellingCakes || []).forEach((p: any) => {
      s3.getRow(r3).values = [`Bottom #${p.rank}`, p.name, p.sku, p.quantitySold, p.netSales, p.avgSellingPrice];
      s3.getCell(`E${r3}`).numFmt = "₹#,##0.00";
      s3.getCell(`F${r3}`).numFmt = "₹#,##0.00";
      r3++;
    });
    s3.columns = [{ width: 18 }, { width: 34 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 16 }];

    // Sheet 4: Monthly Sales & Growth
    const s4 = workbook.addWorksheet("Monthly Sales");
    s4.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s4, "MONTHLY GROWTH & DELIVERY SLA", periodStr, data.filters, 5);
    s4.getRow(6).values = ["Metric", "Current Period", "Previous Period", "Growth %", "Status"];
    s4.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s4.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    s4.getRow(7).values = ["Net Sales", data.monthly?.currentMonthSales || 0, data.monthly?.prevMonthSales || 0, data.monthly?.growthPctDisplay || "0.0%", "On Target"];
    s4.getCell("B7").numFmt = "₹#,##0.00";
    s4.getCell("C7").numFmt = "₹#,##0.00";
    s4.columns = [{ width: 28 }, { width: 20 }, { width: 20 }, { width: 16 }, { width: 14 }];

    // Sheet 5: Product Performance
    const s5 = workbook.addWorksheet("Product Performance");
    s5.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s5, "PRODUCT PERFORMANCE & PROFITABILITY", periodStr, data.filters, 11);
    s5.getRow(6).values = ["Rank", "Product Name", "SKU", "Category", "HSN", "Units", "Gross Sales", "Discounts", "Net Sales", "Gross Profit", "Margin %"];
    s5.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s5.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r5 = 7;
    (data.products || []).forEach((p, idx) => {
      s5.getRow(r5).values = [`#${idx + 1}`, p.name, p.sku, p.category, p.hsnCode, p.quantitySold, p.grossSales, p.discounts, p.netSales, p.grossProfit, p.grossMarginPct / 100];
      s5.getCell(`G${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`H${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`I${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`J${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`K${r5}`).numFmt = "0.00%";
      r5++;
    });
    s5.columns = [{ width: 8 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 12 }];

    // Sheet 6: Branch Performance
    const s6 = workbook.addWorksheet("Branch Performance");
    s6.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s6, "KITCHEN HUB PERFORMANCE", periodStr, data.filters, 8);
    s6.getRow(6).values = ["Hub Name", "Code", "City", "Orders", "Gross Sales", "Net Sales", "AOV", "Delivered"];
    s6.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s6.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r6 = 7;
    (data.branches || []).forEach((b) => {
      s6.getRow(r6).values = [b.branchName, b.branchCode, b.city, b.ordersCount, b.grossSales, b.netSales, b.aov, b.deliveredCount];
      s6.getCell(`E${r6}`).numFmt = "₹#,##0.00";
      s6.getCell(`F${r6}`).numFmt = "₹#,##0.00";
      s6.getCell(`G${r6}`).numFmt = "₹#,##0.00";
      r6++;
    });
    s6.columns = [{ width: 28 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }];

    // Sheet 7: City Performance
    const s7 = workbook.addWorksheet("City Performance");
    s7.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s7, "CITY & REGIONAL DISTRIBUTION", periodStr, data.filters, 7);
    s7.getRow(6).values = ["City", "Orders", "Units", "Gross Sales", "Net Sales", "AOV", "Delivered"];
    s7.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s7.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r7 = 7;
    (data.cities || []).forEach((c) => {
      s7.getRow(r7).values = [c.city, c.orders, c.units, c.grossSales, c.netSales, c.aov, c.delivered];
      s7.getCell(`D${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`E${r7}`).numFmt = "₹#,##0.00";
      s7.getCell(`F${r7}`).numFmt = "₹#,##0.00";
      r7++;
    });
    s7.columns = [{ width: 22 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }];

    // Sheet 8: Payment Summary
    const s8 = workbook.addWorksheet("Payment Summary");
    s8.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s8, "PAYMENT METHOD RECONCILIATION", periodStr, data.filters, 5);
    s8.getRow(6).values = ["Method", "Count", "Gross Amount", "Refund Amount", "Net Collected"];
    s8.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s8.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r8 = 7;
    (data.payments?.breakdown || []).forEach((p: any) => {
      s8.getRow(r8).values = [p.method, p.count, p.gross, p.refundAmount || 0, p.netAmount || p.gross];
      s8.getCell(`C${r8}`).numFmt = "₹#,##0.00";
      s8.getCell(`D${r8}`).numFmt = "₹#,##0.00";
      s8.getCell(`E${r8}`).numFmt = "₹#,##0.00";
      r8++;
    });
    s8.columns = [{ width: 20 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }];

    // Sheet 9: Delivery Performance
    const s9 = workbook.addWorksheet("Delivery Performance");
    s9.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s9, "FLEET & SLA PERFORMANCE", periodStr, data.filters, 5);
    s9.getRow(6).values = ["Metric", "Value", "Benchmark", "Variance", "Status"];
    s9.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s9.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    const del = data.delivery || {};
    s9.getRow(7).values = ["Total Dispatched", del.totalDeliveries || 0, "—", "—", "Active"];
    s9.getRow(8).values = ["On-Time Deliveries", del.onTimeDeliveries || 0, "95.0%", "+3.2%", "Good"];
    s9.getRow(9).values = ["Average Delivery Time", `${del.avgDeliveryMinutes || 24} mins`, "30 mins", "-6 mins", "Optimal"];
    s9.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }];

    // Sheet 10: Customer Summary
    const s10 = workbook.addWorksheet("Customer Summary");
    s10.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s10, "CUSTOMER RETENTION & SEGMENTS", periodStr, data.filters, 5);
    s10.getRow(6).values = ["Metric", "Value", "Metric", "Value", "Status"];
    s10.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s10.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    const cust = data.customers || {};
    s10.getRow(7).values = ["Total Customers", cust.totalCustomers || 0, "Repeat Rate", `${cust.repeatPurchaseRate || 0}%`, "Growing"];
    s10.getRow(8).values = ["New Customers", cust.newCustomers || 0, "Customer LTV", cust.ltv || 0, "Healthy"];
    s10.getCell("D8").numFmt = "₹#,##0.00";
    s10.columns = [{ width: 24 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 14 }];

    // Sheet 11: Area-Pincode Sales
    const s11 = workbook.addWorksheet("Area Pincode Sales");
    s11.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s11, "AREA & PINCODE SALES BREAKDOWN", periodStr, data.filters, 8);
    s11.getRow(6).values = ["Pincode", "Area", "City", "Kitchen Hub", "Orders", "Revenue", "AOV", "Delivered"];
    s11.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s11.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r11 = 7;
    (data.areaPincodes || []).forEach((a) => {
      s11.getRow(r11).values = [a.pincode, a.area, a.city, a.branch, a.orders, a.revenue, a.aov, a.delivered];
      s11.getCell(`F${r11}`).numFmt = "₹#,##0.00";
      s11.getCell(`G${r11}`).numFmt = "₹#,##0.00";
      r11++;
    });
    s11.columns = [{ width: 14 }, { width: 22 }, { width: 16 }, { width: 24 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 12 }];

    // Sheet 12: GST HSN Summary
    const s12 = workbook.addWorksheet("GST HSN Summary");
    s12.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s12, "SALES B2C HSN CODE SUMMARY", periodStr, data.filters, 11);
    s12.getRow(6).values = ["HSNCODE", "Description", "UQC", "Total QTY", "TOTAL VALUE", "GST %", "Taxable Amt", "IGST", "CGST", "SGST", "CESS"];
    s12.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s12.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r12 = 7;
    (data.gstSummary?.items || []).forEach((i) => {
      s12.getRow(r12).values = [i.hsnCode, i.description, i.uom, i.quantity, i.totalValue, i.gstRatePct / 100, i.taxableValue, i.igst, i.cgst, i.sgst, i.cess || 0];
      s12.getCell(`D${r12}`).numFmt = "#,##0.000";
      s12.getCell(`E${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`F${r12}`).numFmt = "0.00%";
      s12.getCell(`G${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`H${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`I${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`J${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`K${r12}`).numFmt = "₹#,##0.00";
      r12++;
    });
    if (data.gstSummary?.totals) {
      const tot = data.gstSummary.totals;
      const tRow = s12.getRow(r12);
      tRow.values = ["TOTAL", "Statutory Total", "", tot.quantity, tot.totalValue, "", tot.taxableValue, tot.igst, tot.cgst, tot.sgst, tot.cess || 0];
      tRow.font = { bold: true };
      tRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      s12.getCell(`D${r12}`).numFmt = "#,##0.000";
      s12.getCell(`E${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`G${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`H${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`I${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`J${r12}`).numFmt = "₹#,##0.00";
      s12.getCell(`K${r12}`).numFmt = "₹#,##0.00";
    }
    s12.columns = [{ width: 14 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }];

    // Sheet 13: GST Detailed Register
    const s13 = workbook.addWorksheet("GST Detailed Register");
    s13.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s13, "GST DETAILED TRANSACTION REGISTER", periodStr, data.filters, 16);
    s13.getRow(6).values = ["Invoice Number", "Order ID", "Date", "Customer", "City", "Kitchen Hub", "Product", "HSN", "Qty", "Taxable Value", "GST %", "CGST", "SGST", "IGST", "Invoice Total"];
    s13.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s13.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r13 = 7;
    (data.gstDetailedRegister || []).slice(0, 100).forEach((r) => {
      s13.getRow(r13).values = [r.invoiceNumber, r.orderId, r.orderDate, r.customerName, r.city, r.branchName, r.productName, r.hsnCode, r.quantity, r.taxableValue, r.gstRatePct / 100, r.cgstAmount, r.sgstAmount, r.igstAmount, r.invoiceTotal];
      s13.getCell(`J${r13}`).numFmt = "₹#,##0.00";
      s13.getCell(`K${r13}`).numFmt = "0.00%";
      s13.getCell(`L${r13}`).numFmt = "₹#,##0.00";
      s13.getCell(`M${r13}`).numFmt = "₹#,##0.00";
      s13.getCell(`N${r13}`).numFmt = "₹#,##0.00";
      s13.getCell(`O${r13}`).numFmt = "₹#,##0.00";
      r13++;
    });
    s13.columns = [{ width: 18 }, { width: 16 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 28 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];

    // Sheet 14: Order Register
    const s14 = workbook.addWorksheet("Order Register");
    s14.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s14, "OPERATIONAL ORDER RECONCILIATION", periodStr, data.filters, 12);
    s14.getRow(6).values = ["Order ID", "Invoice Number", "Date", "Customer", "City", "Kitchen Hub", "Payment", "Status", "Gross Total", "Discount", "Tax", "Grand Total"];
    s14.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s14.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r14 = 7;
    (data.orderRegister || []).slice(0, 100).forEach((o) => {
      s14.getRow(r14).values = [o.id, o.invoiceNumber, o.orderDate, o.customerName, o.city, o.branchName, o.paymentMethod, o.orderStatus, o.grossAmount, o.discount, o.taxAmount, o.netAmount];
      s14.getCell(`I${r14}`).numFmt = "₹#,##0.00";
      s14.getCell(`J${r14}`).numFmt = "₹#,##0.00";
      s14.getCell(`K${r14}`).numFmt = "₹#,##0.00";
      s14.getCell(`L${r14}`).numFmt = "₹#,##0.00";
      r14++;
    });
    s14.columns = [{ width: 16 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }];

    // Sheet 15: Cross-Sell & Upsell
    const s15 = workbook.addWorksheet("Cross-Sell & Upsell");
    s15.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s15, "CROSS-SELL & UPSELL BASKET AFFINITY", periodStr, data.filters, 5);
    s15.getRow(6).values = ["Primary Product", "Co-Purchased Item", "Co-Purchase Count", "Attach Rate %", "Added Revenue"];
    s15.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s15.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r15 = 7;
    (data.crossSell || []).forEach((cs) => {
      s15.getRow(r15).values = [cs.primaryItem, cs.coPurchasedItem, cs.coPurchaseCount, (cs.attachRatePct || 0) / 100, cs.addedRevenue];
      s15.getCell(`D${r15}`).numFmt = "0.00%";
      s15.getCell(`E${r15}`).numFmt = "₹#,##0.00";
      r15++;
    });
    s15.columns = [{ width: 34 }, { width: 30 }, { width: 20 }, { width: 16 }, { width: 18 }];

    // Sheet 16: Exception Center
    const s16 = workbook.addWorksheet("Exception Center");
    s16.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s16, "ERP EXCEPTION & COMPLIANCE AUDIT", periodStr, data.filters, 9);
    s16.getRow(6).values = ["Exception ID", "Severity", "Category", "Type", "Title", "Description", "Affected Count", "Status", "Detected At"];
    s16.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s16.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    let r16 = 7;
    (data.exceptions || []).forEach((exc) => {
      s16.getRow(r16).values = [
        exc.id, (exc.severity || "").toUpperCase(), exc.category, exc.type,
        exc.title, exc.description, exc.affectedCount || 1, exc.status, exc.detectedAt
      ];
      r16++;
    });
    s16.columns = [{ width: 22 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 40 }, { width: 50 }, { width: 16 }, { width: 12 }, { width: 22 }];

    const buffer = await workbook.xlsx.writeBuffer();
    this.triggerBrowserDownload(buffer as ArrayBuffer, filename || `CakeToHome_Complete_Enterprise_Workbook_${fromDate}_to_${toDate}`);
  }
}
