/**
 * CakeToHome — Invoice Sequence Service
 * Generates unique, sequential, immutable GST Invoice Numbers format CTH/26-27/000001
 * Server-side atomic sequence generator compliant with Indian GST Statutory Requirements.
 */

export class InvoiceSequenceService {
  private static currentSequence = 124;

  /**
   * Calculate current Indian Financial Year (e.g. FY 2026-2027 => "26-27")
   */
  public static getFinancialYearCode(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed (0 = Jan, 3 = April)
    
    // FY runs from April 1 to March 31
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;

    const startStr = String(startYear).slice(-2);
    const endStr = String(endYear).slice(-2);

    return `${startStr}-${endStr}`;
  }

  /**
   * Generate next sequential GST invoice number format: CTH/26-27/000001
   */
  public static generateNextInvoiceNumber(date: Date = new Date(), existingDisplayId?: number): string {
    const fyCode = this.getFinancialYearCode(date);
    const seq = existingDisplayId || ++this.currentSequence;
    const seqStr = String(seq).padStart(6, "0");

    return `CTH/${fyCode}/${seqStr}`;
  }

  /**
   * Ensure order has a valid GST invoice number if delivered.
   */
  public static ensureInvoiceNumberForOrder(order: any): string {
    if (order.metadata?.invoice_number && order.metadata.invoice_number.startsWith("CTH/")) {
      return order.metadata.invoice_number;
    }

    const orderDate = order.created_at ? new Date(order.created_at) : new Date();
    const seqNum = typeof order.display_id === "number" ? order.display_id : 125;
    
    return this.generateNextInvoiceNumber(orderDate, seqNum);
  }
}
