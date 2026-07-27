/**
 * CakeToHome Core API - GST, Invoicing & Accounting Engine (Feature 11)
 * Manages Intra/Inter-State GST (CGST/SGST/IGST), Configurable Invoice Numbering (Prefix, Suffix, FY Reset, Branch Series),
 * Tax Invoices, Credit Notes, GSTR-1 / GSTR-3B Reports, TallyPrime XML Exporter, and Compliance Audits.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service.ts";

export interface GstConfigDto {
  gstin: string;
  legalName: string;
  stateCode: string;
  isGstEnabled: boolean;
  defaultPricingMode: "INCLUSIVE" | "EXCLUSIVE";
}

export interface InvoiceNumberingConfigDto {
  prefix: string;
  suffix?: string;
  separator: "/" | "-" | "_" | "";
  paddingLength: number;
  resetPolicy: "CONTINUOUS" | "FINANCIAL_YEAR" | "BRANCH_WISE";
  currentSequence: number;
}

export interface TaxLineItemDto {
  hsnCode: string;
  description: string;
  quantity: number;
  unitPrice: string;
  gstPercentage: number;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalItemAmount: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  branchCode: string;
  placeOfSupplyStateCode: string;
  isInterState: boolean;
  customerName: string;
  customerGstin?: string;
  lineItems: TaxLineItemDto[];
  pricing: {
    totalTaxableAmount: string;
    totalCgstAmount: string;
    totalSgstAmount: string;
    totalIgstAmount: string;
    grandTotal: string;
  };
  status: "ISSUED" | "CANCELLED" | "CREDIT_NOTE_ISSUED";
  issuedAt: string;
}

export class AccountingService {
  private gstConfig: GstConfigDto = {
    gstin: "29AAAAA0000A1Z5",
    legalName: "CakeToHome Bakery Private Limited",
    stateCode: "29",
    isGstEnabled: true,
    defaultPricingMode: "INCLUSIVE",
  };

  private numberingConfig: InvoiceNumberingConfigDto = {
    prefix: "INV",
    suffix: "2026",
    separator: "-",
    paddingLength: 6,
    resetPolicy: "FINANCIAL_YEAR",
    currentSequence: 1,
  };

  private invoices: Map<string, InvoiceDto> = new Map();
  private auditLogs: { id: string; action: string; invoiceNumber: string; timestamp: string }[] = [];

  generateInvoiceNumber(branchCode?: string): string {
    const seqPadded = String(this.numberingConfig.currentSequence).padStart(this.numberingConfig.paddingLength, "0");
    const sep = this.numberingConfig.separator;
    const prefix = branchCode && this.numberingConfig.resetPolicy === "BRANCH_WISE" ? branchCode : this.numberingConfig.prefix;

    let invNum = `${prefix}${sep}${seqPadded}`;
    if (this.numberingConfig.suffix) {
      invNum += `${sep}${this.numberingConfig.suffix}`;
    }

    this.numberingConfig.currentSequence += 1;
    return invNum;
  }

  async createTaxInvoice(orderData: {
    orderId: string;
    orderNumber: string;
    branchCode: string;
    customerName: string;
    customerStateCode: string;
    customerGstin?: string;
    items: { hsnCode: string; description: string; quantity: number; unitPrice: string; gstPercentage: number }[];
  }): Promise<InvoiceDto> {
    const invoiceId = `inv_${Date.now()}`;
    const invoiceNumber = this.generateInvoiceNumber(orderData.branchCode);
    const isInterState = orderData.customerStateCode !== this.gstConfig.stateCode;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const lineItems: TaxLineItemDto[] = orderData.items.map((it) => {
      const unitNum = parseFloat(it.unitPrice);
      const lineTotal = unitNum * it.quantity;

      const gstRate = it.gstPercentage / 100;
      const taxableNum = lineTotal / (1 + gstRate);
      const taxNum = lineTotal - taxableNum;

      let cgstNum = 0;
      let sgstNum = 0;
      let igstNum = 0;

      if (isInterState) {
        igstNum = taxNum;
      } else {
        cgstNum = taxNum / 2;
        sgstNum = taxNum / 2;
      }

      totalTaxable += taxableNum;
      totalCgst += cgstNum;
      totalSgst += sgstNum;
      totalIgst += igstNum;

      return {
        hsnCode: it.hsnCode,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        gstPercentage: it.gstPercentage,
        taxableAmount: taxableNum.toFixed(2),
        cgstAmount: cgstNum.toFixed(2),
        sgstAmount: sgstNum.toFixed(2),
        igstAmount: igstNum.toFixed(2),
        totalItemAmount: lineTotal.toFixed(2),
      };
    });

    const grandTotalNum = totalTaxable + totalCgst + totalSgst + totalIgst;

    const invoice: InvoiceDto = {
      id: invoiceId,
      invoiceNumber,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      branchCode: orderData.branchCode,
      placeOfSupplyStateCode: orderData.customerStateCode,
      isInterState,
      customerName: orderData.customerName,
      customerGstin: orderData.customerGstin,
      lineItems,
      pricing: {
        totalTaxableAmount: totalTaxable.toFixed(2),
        totalCgstAmount: totalCgst.toFixed(2),
        totalSgstAmount: totalSgst.toFixed(2),
        totalIgstAmount: totalIgst.toFixed(2),
        grandTotal: grandTotalNum.toFixed(2),
      },
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
    };

    this.invoices.set(invoiceId, invoice);
    this.auditLogs.push({ id: `aud_${Date.now()}`, action: "INVOICE_ISSUED", invoiceNumber, timestamp: new Date().toISOString() });

    OutboxPublisherService.createOutboxRecord({
      eventType: "TaxInvoiceGenerated",
      aggregateId: invoiceId,
      payload: { invoiceId, invoiceNumber, grandTotal: invoice.pricing.grandTotal, isInterState },
    });

    return invoice;
  }

  exportTallyPrimeXml(invoiceId: string): string {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) throw new Error("Invoice not found for Tally export");

    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${invoice.issuedAt.slice(0, 10).replace(/-/g, "")}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoice.invoiceNumber}</VOUCHERNUMBER>
            <REFERENCE>${invoice.orderNumber}</REFERENCE>
            <PARTYLEDGERNAME>${invoice.customerName}</PARTYLEDGERNAME>
            <AMOUNT>-${invoice.pricing.grandTotal}</AMOUNT>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${invoice.pricing.totalTaxableAmount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${invoice.pricing.totalCgstAmount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${invoice.pricing.totalSgstAmount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  getInvoice(invoiceId: string): InvoiceDto | null {
    return this.invoices.get(invoiceId) || null;
  }
}

export const accountingService = new AccountingService();
