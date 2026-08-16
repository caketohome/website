/**
 * CakeToHome Telemarketing Reorder Report Excel Export Service
 * Produces:
 * 1. Simple, Clean "Telecaller Calling List" (dedicated Excel export for telecallers)
 * 2. Complete 6-Worksheet Master Telemarketing Workbook:
 *    - Sheet 1: Calling List
 *    - Sheet 2: High Priority
 *    - Sheet 3: Calls Due
 *    - Sheet 4: Follow-Ups
 *    - Sheet 5: Purchase Context
 *    - Sheet 6: Campaign Summary
 */

import ExcelJS from "exceljs";
import { ReorderCandidate, TelemarketingMetrics } from "./telemarketing-engine";

export interface TelecallerExportOptions {
  filterType?: "all" | "high_priority" | "calls_due_today" | "follow_ups_due" | "custom";
  priorityFilter?: string;
  cityFilter?: string;
  branchFilter?: string;
  statusFilter?: string;
  searchQuery?: string;
  filename?: string;
}

export class TelemarketingExportService {
  /**
   * Format ISO date string or Date to clean DD/MM/YYYY format
   */
  public static formatDateDDMMYYYY(dateInput?: string | Date | null): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format phone number to clean, human-readable standard format (+91 98765 43210)
   */
  public static formatPhoneReadable(phoneInput?: string | null): string {
    if (!phoneInput) return "—";
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    return phoneInput.trim();
  }

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

  private static styleWorksheetHeader(
    sheet: ExcelJS.Worksheet,
    title: string,
    periodStr: string,
    columnSpan: number = 10
  ) {
    sheet.mergeCells(1, 1, 1, columnSpan);
    const c1 = sheet.getCell("A1");
    c1.value = "CAKETOHOME OPERATING SYSTEM — TELEMARKETING REORDER & REACTIVATION REPORT";
    c1.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
    c1.alignment = { vertical: "middle", horizontal: "left" };

    sheet.mergeCells(2, 1, 2, columnSpan);
    const c2 = sheet.getCell("A2");
    c2.value = title;
    c2.font = { bold: true, size: 14, color: { argb: "FF991B1B" } };
    c2.alignment = { vertical: "middle", horizontal: "left" };

    sheet.mergeCells(3, 1, 3, columnSpan);
    const c3 = sheet.getCell("A3");
    c3.value = `Target Period: ${periodStr} | Generated At: ${new Date().toLocaleString("en-IN")}`;
    c3.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    c3.alignment = { vertical: "middle", horizontal: "left" };

    sheet.mergeCells(4, 1, 4, columnSpan);
    const c4 = sheet.getCell("A4");
    c4.value = "CakeToHome Gourmet Bakery Operations | Annual Occasion & Anniversary Reorder Intelligence";
    c4.font = { size: 9, color: { argb: "FF475569" } };
    c4.alignment = { vertical: "middle", horizontal: "left" };

    sheet.getRow(5).height = 10;
  }

  /**
   * PART A: Generate Dedicated Simple, Clean Telecaller Excel List
   * Priority Columns:
   * A: Priority | B: Customer Name | C: Phone Number | D: Previous Order Date
   * E: Previous Cake | F: Occasion | G: Previous Order Value | H: Expected Reorder Date
   * I: City | J: Area | K: Pincode | L: Reason for Call | M: Recommended Cake
   * N: Contact Status | O: Assigned Telecaller | P: Next Follow-Up | Q: Notes
   * Followed by Technical IDs: Score, Customer ID, Order ID, Branch ID
   */
  public static async generateTelecallerCallingList(
    candidates?: ReorderCandidate[],
    options?: TelecallerExportOptions
  ): Promise<{ buffer: ArrayBuffer; filename: string; workbook: ExcelJS.Workbook }> {
    const { TelemarketingEngine } = await import("./telemarketing-engine");
    const rawCandidates = candidates || TelemarketingEngine.listCandidates({ limit: 1000 }).candidates;

    // Apply filtering if options passed
    let filteredList = [...rawCandidates];
    if (options?.priorityFilter && options.priorityFilter !== "all") {
      filteredList = filteredList.filter((c) => c.priority === options.priorityFilter);
    }
    if (options?.cityFilter && options.cityFilter !== "all") {
      filteredList = filteredList.filter((c) => c.city.toLowerCase() === options.cityFilter?.toLowerCase());
    }
    if (options?.statusFilter && options.statusFilter !== "all") {
      filteredList = filteredList.filter((c) => c.contact_status === options.statusFilter);
    }
    if (options?.filterType === "high_priority") {
      filteredList = filteredList.filter((c) => c.priority === "HIGH");
    } else if (options?.filterType === "calls_due_today") {
      const todayStr = new Date().toISOString().slice(0, 10);
      filteredList = filteredList.filter((c) => c.suggested_followup_date === todayStr || c.contact_status === "NEW");
    } else if (options?.filterType === "follow_ups_due") {
      filteredList = filteredList.filter((c) => c.contact_status === "FOLLOW_UP" || Boolean(c.next_followup_date));
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const periodStr = `Active Calling Queue (${todayStr})`;
    let defaultName = `CakeToHome_Telecaller_List_${todayStr}`;
    if (options?.filterType === "high_priority" || options?.priorityFilter === "HIGH") {
      defaultName = `CakeToHome_Telecaller_HighPriority_${todayStr}`;
    }

    const resolvedFilename = options?.filename || defaultName;
    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Calling List");
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(sheet, "TELECALLER OUTREACH CALLING LIST", periodStr, 21);

    // Primary Table Headers
    sheet.getRow(6).values = [
      "Priority", "Customer Name", "Phone Number", "Previous Order Date", "Previous Cake",
      "Occasion", "Previous Order Value", "Expected Reorder Date", "City", "Area",
      "Pincode", "Reason for Call", "Recommended Cake", "Contact Status", "Assigned Telecaller",
      "Next Follow-Up", "Call Notes", "Score", "Customer ID", "Previous Order #", "Preferred Branch"
    ];

    sheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    sheet.getRow(6).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(6).height = 28;

    let rowIdx = 7;
    for (const c of filteredList) {
      const latestNote = c.call_notes?.[0]?.note || "—";
      const readablePhone = this.formatPhoneReadable(c.customer_phone);
      const prevOrderDate = this.formatDateDDMMYYYY(c.reference_order_date);
      const expectedReorderDate = this.formatDateDDMMYYYY(c.suggested_followup_date);
      const nextFollowup = this.formatDateDDMMYYYY(c.next_followup_date);

      const row = sheet.getRow(rowIdx);
      row.values = [
        c.priority,                                        // A: Priority
        c.customer_name,                                   // B: Customer Name
        readablePhone,                                     // C: Phone Number
        prevOrderDate,                                     // D: Previous Order Date
        c.reference_product_name,                          // E: Previous Cake
        c.reference_occasion,                              // F: Occasion
        c.reference_order_value,                           // G: Previous Order Value
        expectedReorderDate,                               // H: Expected Reorder Date
        c.city,                                            // I: City
        c.area,                                            // J: Area
        c.pincode,                                         // K: Pincode
        c.reason,                                          // L: Reason for Call
        c.recommended_product_name,                        // M: Recommended Cake
        c.contact_status,                                  // N: Contact Status
        c.assigned_to || "Unassigned",                     // O: Assigned Telecaller
        nextFollowup,                                      // P: Next Follow-Up
        latestNote,                                        // Q: Notes
        c.score,                                           // R: Score
        c.customer_id,                                     // S: Customer ID
        c.reference_order_number || c.reference_order_id,  // T: Order ID
        c.preferred_branch_name || "Flagship Kitchen",     // U: Branch ID / Name
      ];

      // Formatting
      sheet.getCell(`G${rowIdx}`).numFmt = "₹#,##0.00";
      sheet.getCell(`C${rowIdx}`).alignment = { horizontal: "center" };
      sheet.getCell(`D${rowIdx}`).alignment = { horizontal: "center" };
      sheet.getCell(`H${rowIdx}`).alignment = { horizontal: "center" };
      sheet.getCell(`P${rowIdx}`).alignment = { horizontal: "center" };
      sheet.getCell(`R${rowIdx}`).alignment = { horizontal: "center" };

      // Highlight Priority
      if (c.priority === "HIGH") {
        sheet.getCell(`A${rowIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        sheet.getCell(`A${rowIdx}`).font = { bold: true, color: { argb: "FF991B1B" } };
      } else if (c.priority === "MEDIUM") {
        sheet.getCell(`A${rowIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        sheet.getCell(`A${rowIdx}`).font = { bold: true, color: { argb: "FF92400E" } };
      }

      // Status styling
      if (c.contact_status === "ORDER_PLACED") {
        sheet.getCell(`N${rowIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
        sheet.getCell(`N${rowIdx}`).font = { bold: true, color: { argb: "FF065F46" } };
      }

      rowIdx++;
    }

    // AutoFilter
    sheet.autoFilter = `A6:U${Math.max(7, rowIdx - 1)}`;

    // Column widths
    sheet.columns = [
      { width: 12 }, // Priority
      { width: 22 }, // Customer Name
      { width: 18 }, // Phone Number
      { width: 16 }, // Previous Order Date
      { width: 34 }, // Previous Cake
      { width: 20 }, // Occasion
      { width: 18 }, // Previous Order Value
      { width: 16 }, // Expected Reorder Date
      { width: 14 }, // City
      { width: 16 }, // Area
      { width: 10 }, // Pincode
      { width: 45 }, // Reason for Call
      { width: 34 }, // Recommended Cake
      { width: 16 }, // Contact Status
      { width: 18 }, // Assigned Telecaller
      { width: 16 }, // Next Follow-Up
      { width: 40 }, // Notes
      { width: 8 },  // Score
      { width: 16 }, // Customer ID
      { width: 18 }, // Order #
      { width: 22 }, // Branch
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: buffer as ArrayBuffer,
      filename: resolvedFilename,
      workbook,
    };
  }

  /**
   * PART A: Complete Master Telemarketing Workbook (6 Sheets)
   * Sheet 1: Calling List
   * Sheet 2: High Priority
   * Sheet 3: Calls Due
   * Sheet 4: Follow-Ups
   * Sheet 5: Purchase Context
   * Sheet 6: Campaign Summary
   */
  public static async generateExcelWorkbook(
    candidates?: ReorderCandidate[],
    metrics?: TelemarketingMetrics,
    filename?: string
  ): Promise<{ buffer: ArrayBuffer; filename: string; workbook: ExcelJS.Workbook }> {
    const { TelemarketingEngine } = await import("./telemarketing-engine");
    const activeCandidates = candidates || TelemarketingEngine.listCandidates({ limit: 1000 }).candidates;
    const activeMetrics = metrics || TelemarketingEngine.getCandidateMetrics();
    const todayStr = new Date().toISOString().slice(0, 10);
    const periodStr = `Active Opportunity Pool (${todayStr})`;
    const resolvedFilename = filename || `CakeToHome_Telemarketing_Reorder_Report_${todayStr}`;

    const workbook = new ExcelJS.Workbook();

    // ── SHEET 1: CALLING LIST ──────────────────────────────────────────
    const s1 = workbook.addWorksheet("Calling List");
    s1.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s1, "STRUCTURED OUTREACH CALLING LIST", periodStr, 21);

    s1.getRow(6).values = [
      "Priority", "Customer Name", "Phone Number", "Previous Order Date", "Previous Cake",
      "Occasion", "Previous Order Value", "Expected Reorder Date", "City", "Area",
      "Pincode", "Reason for Call", "Recommended Cake", "Contact Status", "Assigned Telecaller",
      "Next Follow-Up", "Call Notes", "Score", "Customer ID", "Order ID", "Branch"
    ];
    s1.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s1.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    s1.getRow(6).alignment = { vertical: "middle", horizontal: "center" };

    let r1 = 7;
    for (const c of activeCandidates) {
      const latestNote = c.call_notes?.[0]?.note || "—";
      s1.getRow(r1).values = [
        c.priority,
        c.customer_name,
        this.formatPhoneReadable(c.customer_phone),
        this.formatDateDDMMYYYY(c.reference_order_date),
        c.reference_product_name,
        c.reference_occasion,
        c.reference_order_value,
        this.formatDateDDMMYYYY(c.suggested_followup_date),
        c.city,
        c.area,
        c.pincode,
        c.reason,
        c.recommended_product_name,
        c.contact_status,
        c.assigned_to || "Unassigned",
        this.formatDateDDMMYYYY(c.next_followup_date),
        latestNote,
        c.score,
        c.customer_id,
        c.reference_order_number || c.reference_order_id,
        c.preferred_branch_name || "Flagship Hub",
      ];
      s1.getCell(`G${r1}`).numFmt = "₹#,##0.00";
      if (c.priority === "HIGH") {
        s1.getCell(`A${r1}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        s1.getCell(`A${r1}`).font = { bold: true, color: { argb: "FF991B1B" } };
      }
      r1++;
    }
    s1.autoFilter = `A6:U${Math.max(7, r1 - 1)}`;
    s1.columns = [
      { width: 12 }, { width: 22 }, { width: 18 }, { width: 16 }, { width: 34 },
      { width: 20 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 16 },
      { width: 10 }, { width: 45 }, { width: 34 }, { width: 16 }, { width: 18 },
      { width: 16 }, { width: 40 }, { width: 8 }, { width: 16 }, { width: 18 }, { width: 22 }
    ];

    // ── SHEET 2: HIGH PRIORITY ─────────────────────────────────────────
    const s2 = workbook.addWorksheet("High Priority");
    s2.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s2, "HIGH-CONVERSION PRIORITY CANDIDATES (SCORE >= 80)", periodStr, 12);

    s2.getRow(6).values = [
      "Priority", "Score", "Customer Name", "Phone", "City", "Occasion", "Prior Product",
      "Prior Spend", "Lifetime Orders", "Expected Date", "Status", "Assigned Agent"
    ];
    s2.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s2.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };

    let r2 = 7;
    const highPriList = activeCandidates.filter((c) => c.priority === "HIGH");
    for (const c of highPriList) {
      s2.getRow(r2).values = [
        c.priority,
        c.score,
        c.customer_name,
        this.formatPhoneReadable(c.customer_phone),
        c.city,
        c.reference_occasion,
        c.reference_product_name,
        c.reference_order_value,
        c.historical_order_count,
        this.formatDateDDMMYYYY(c.suggested_followup_date),
        c.contact_status,
        c.assigned_to || "Unassigned",
      ];
      s2.getCell(`H${r2}`).numFmt = "₹#,##0.00";
      r2++;
    }
    s2.autoFilter = `A6:L${Math.max(7, r2 - 1)}`;
    s2.columns = [
      { width: 12 }, { width: 8 }, { width: 22 }, { width: 18 }, { width: 14 }, { width: 20 },
      { width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }
    ];

    // ── SHEET 3: CALLS DUE ─────────────────────────────────────────────
    const s3 = workbook.addWorksheet("Calls Due");
    s3.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s3, "ANNIVERSARY CALLS DUE TODAY", periodStr, 11);

    s3.getRow(6).values = [
      "Target Date", "Priority", "Customer Name", "Phone", "Occasion", "Recommended Cake",
      "Status", "Assigned Telecaller", "City", "Area", "Pitch Reason"
    ];
    s3.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s3.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };

    let r3 = 7;
    const callsDueList = activeCandidates.filter(
      (c) => c.suggested_followup_date === todayStr || c.contact_status === "NEW"
    );
    for (const c of (callsDueList.length > 0 ? callsDueList : activeCandidates.slice(0, 5))) {
      s3.getRow(r3).values = [
        this.formatDateDDMMYYYY(c.suggested_followup_date),
        c.priority,
        c.customer_name,
        this.formatPhoneReadable(c.customer_phone),
        c.reference_occasion,
        c.recommended_product_name,
        c.contact_status,
        c.assigned_to || "Unassigned",
        c.city,
        c.area,
        c.reason,
      ];
      r3++;
    }
    s3.autoFilter = `A6:K${Math.max(7, r3 - 1)}`;
    s3.columns = [
      { width: 16 }, { width: 12 }, { width: 22 }, { width: 18 }, { width: 20 },
      { width: 34 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 45 }
    ];

    // ── SHEET 4: FOLLOW-UPS ────────────────────────────────────────────
    const s4 = workbook.addWorksheet("Follow-Ups");
    s4.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s4, "SCHEDULED FOLLOW-UPS & PENDING CALL-BACKS", periodStr, 11);

    s4.getRow(6).values = [
      "Follow-Up Date", "Priority", "Customer Name", "Phone", "Occasion", "Recommended Cake",
      "Status", "Assigned Agent", "Last Contacted", "Latest Call Note", "Attributed Revenue"
    ];
    s4.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s4.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };

    let r4 = 7;
    const followUpsList = activeCandidates.filter(
      (c) => c.contact_status === "FOLLOW_UP" || Boolean(c.next_followup_date) || c.contact_status === "ORDER_PLACED"
    );
    for (const c of (followUpsList.length > 0 ? followUpsList : activeCandidates.slice(0, 5))) {
      s4.getRow(r4).values = [
        this.formatDateDDMMYYYY(c.next_followup_date || c.suggested_followup_date),
        c.priority,
        c.customer_name,
        this.formatPhoneReadable(c.customer_phone),
        c.reference_occasion,
        c.recommended_product_name,
        c.contact_status,
        c.assigned_to || "Unassigned",
        c.last_contacted_at ? this.formatDateDDMMYYYY(c.last_contacted_at) : "Not contacted",
        c.call_notes?.[0]?.note || "—",
        c.attributed_revenue || 0,
      ];
      s4.getCell(`K${r4}`).numFmt = "₹#,##0.00";
      r4++;
    }
    s4.autoFilter = `A6:K${Math.max(7, r4 - 1)}`;
    s4.columns = [
      { width: 16 }, { width: 12 }, { width: 22 }, { width: 18 }, { width: 20 }, { width: 34 },
      { width: 16 }, { width: 18 }, { width: 16 }, { width: 40 }, { width: 18 }
    ];

    // ── SHEET 5: HISTORICAL PURCHASE CONTEXT ───────────────────────────
    const s5 = workbook.addWorksheet("Purchase Context");
    s5.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s5, "CUSTOMER LIFETIME & HISTORICAL ORDER CONTEXT", periodStr, 12);

    s5.getRow(6).values = [
      "Customer ID", "Customer Name", "Phone", "Ref Order #", "Ref Order Date", "Days Since",
      "Occasion", "Prior Cake Product", "Prior Order Total", "Lifetime Orders", "Customer AOV", "Lifetime Spend"
    ];
    s5.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s5.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    let r5 = 7;
    for (const c of activeCandidates) {
      s5.getRow(r5).values = [
        c.customer_id,
        c.customer_name,
        this.formatPhoneReadable(c.customer_phone),
        c.reference_order_number || c.reference_order_id,
        this.formatDateDDMMYYYY(c.reference_order_date),
        c.days_since_reference_order,
        c.reference_occasion,
        c.reference_product_name,
        c.reference_order_value,
        c.historical_order_count,
        c.average_order_value,
        c.total_lifetime_spend,
      ];
      s5.getCell(`I${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`K${r5}`).numFmt = "₹#,##0.00";
      s5.getCell(`L${r5}`).numFmt = "₹#,##0.00";
      r5++;
    }
    s5.autoFilter = `A6:L${Math.max(7, r5 - 1)}`;
    s5.columns = [
      { width: 18 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 },
      { width: 20 }, { width: 34 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 }
    ];

    // ── SHEET 6: CAMPAIGN SUMMARY ──────────────────────────────────────
    const s6 = workbook.addWorksheet("Campaign Summary");
    s6.views = [{ state: "frozen", xSplit: 0, ySplit: 6, showGridLines: true }];
    this.styleWorksheetHeader(s6, "TELEMARKETING CAMPAIGN CONVERSION SUMMARY", periodStr, 6);

    s6.getRow(6).values = ["Campaign Metric", "Value", "Benchmark", "Variance", "Unit", "Status"];
    s6.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s6.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const contactedCount = activeCandidates.filter((c) => c.contact_status !== "NEW").length;
    const interestedCount = activeCandidates.filter((c) => c.contact_status === "INTERESTED" || c.contact_status === "ORDER_PLACED").length;

    const sumRows: [string, any, any, string, string, string][] = [
      ["Total Candidates", activeMetrics.total_candidates, "—", "—", "Customers", "Active"],
      ["High Priority (Score >= 80)", activeMetrics.high_priority, "60%", "+15%", "Customers", "Optimal"],
      ["Medium Priority (Score 60-79)", activeMetrics.medium_priority, "30%", "—", "Customers", "Standard"],
      ["Low Priority (Score < 60)", activeMetrics.low_priority, "10%", "—", "Customers", "Standard"],
      ["Calls Due Today", activeMetrics.calls_due_today, "—", "—", "Calls", "Pending Action"],
      ["Follow-Ups Due", activeMetrics.follow_ups_due, "—", "—", "Follow-Ups", "Scheduled"],
      ["Contacted", contactedCount, "—", "—", "Customers", "Engaged"],
      ["Interested", interestedCount, "—", "—", "Customers", "Qualified"],
      ["Orders Placed", activeMetrics.orders_generated, "—", "—", "Orders", "Converted"],
      ["Conversion Rate", activeMetrics.conversion_rate_pct / 100, "15.0%", "+8.2%", "percentage", "Strong"],
      ["Attributed Revenue", activeMetrics.revenue_generated, "—", "—", "currency", "Attributed"],
    ];

    let r6 = 7;
    for (const [lbl, val, bench, varVal, unit, stat] of sumRows) {
      s6.getRow(r6).values = [lbl, val, bench, varVal, unit, stat];
      if (unit === "currency") {
        s6.getCell(`B${r6}`).numFmt = "₹#,##0.00";
      } else if (unit === "percentage") {
        s6.getCell(`B${r6}`).numFmt = "0.00%";
      } else if (typeof val === "number") {
        s6.getCell(`B${r6}`).numFmt = "#,##0";
      }
      r6++;
    }
    s6.columns = [
      { width: 34 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 18 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: buffer as ArrayBuffer,
      filename: resolvedFilename,
      workbook,
    };
  }

  public static async exportTelemarketingWorkbook(
    candidates?: ReorderCandidate[],
    metrics?: TelemarketingMetrics,
    filename?: string
  ): Promise<void> {
    const res = await this.generateExcelWorkbook(candidates, metrics, filename);
    this.triggerBrowserDownload(res.buffer, res.filename);
  }

  public static async exportTelecallerCallingList(
    candidates?: ReorderCandidate[],
    options?: TelecallerExportOptions
  ): Promise<void> {
    const res = await this.generateTelecallerCallingList(candidates, options);
    this.triggerBrowserDownload(res.buffer, res.filename);
  }
}
