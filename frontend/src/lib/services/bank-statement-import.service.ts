/**
 * CakeToHome ERP — Bank Statement Import Service
 * Phase 4F Step 4.10 Substep 4.10.5-B: Bank Statement Import & Ingestion Service
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. EVIDENCE-ONLY INGESTION:
 *    - Ingestion strictly records external bank proof (immutable source evidence).
 *    - ZERO accounting vouchers, journal entries, or Stage-2 financial postings are created on import.
 * 2. CRYPTOGRAPHIC REPLAY & DEDUPLICATION DEFENSE:
 *    - Entire file is hashed via SHA-256; re-uploading an identical file for the same bank account is rejected.
 *    - Every statement line generates a deterministic line_hash (date, amount, ref, description) for duplicate detection.
 * 3. MULTI-FORMAT PARSING:
 *    - CSV: Flexible headers (Standard, Indian Banks like HDFC/ICICI/SBI, signed amounts, separate CR/DR).
 *    - MT940: SWIFT standard statement format (:60F, :61, :86, :62F).
 *    - OFX: Open Financial Exchange XML/SGML statement format (<STMTTRN>).
 * 4. STRICT FINANCIAL DATA VALIDATIONS:
 *    - Single-sided invariant: (debit > 0 XOR credit > 0). Never both, never neither.
 *    - Non-negative amounts, proper paise precision.
 *    - Period start <= period end.
 *    - Line number > 0 sequential integrity.
 * 5. ATOMIC DATABASE INGESTION:
 *    - Entire import + all parsed lines run in a single DB transaction.
 *    - If any validation or constraint fails, the entire batch rolls back cleanly.
 */

import crypto from "crypto";
import { getDbPool } from "../db";
import {
  BankStatementImportRepository,
  BankStatementImportError,
  type CreateImportParams,
  type CreateLineParams,
  type ListImportsFilter,
  type ListLinesFilter,
} from "../repositories/bank-statement-import.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { CompanyRepository } from "../repositories/company.repository";
import type {
  BankStatementImportRow,
  BankStatementLineRow,
  BankStatementSourceFormat,
} from "../types/accounting.types";

export class BankStatementServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BankStatementServiceError";
    this.code = code;
  }
}

export interface ParsedRawLine {
  lineNumber: number;
  transactionDate: string; // YYYY-MM-DD
  valueDate?: string | null; // YYYY-MM-DD
  description: string;
  bankReference?: string | null;
  debitAmount: number;
  creditAmount: number;
  runningBalance?: number | null;
  metadata?: Record<string, unknown>;
}

export interface IngestStatementParams {
  bankAccountId: string;
  sourceFilename: string;
  fileContent: string | Buffer;
  sourceFormat?: BankStatementSourceFormat;
  importedBy: string;
  companyId?: string;
  customColumnMapping?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface IngestStatementResult {
  importRecord: BankStatementImportRow;
  linesCount: number;
  totalDebitAmount: number;
  totalCreditAmount: number;
  statementPeriodStart: string;
  statementPeriodEnd: string;
}

export class BankStatementImportService {
  /**
   * Primary entry point: Ingests, validates, hashes, parses, and atomically stores a bank statement.
   */
  static async ingestStatement(params: IngestStatementParams): Promise<IngestStatementResult> {
    // 1. Basic parameter validation
    if (!params.bankAccountId || !params.bankAccountId.trim()) {
      throw new BankStatementServiceError("BANK_ACCOUNT_REQUIRED", "bankAccountId is required.");
    }
    if (!params.sourceFilename || !params.sourceFilename.trim()) {
      throw new BankStatementServiceError("FILENAME_REQUIRED", "sourceFilename is required.");
    }
    if (!params.importedBy || !params.importedBy.trim()) {
      throw new BankStatementServiceError("IMPORTED_BY_REQUIRED", "importedBy user reference is required.");
    }
    if (!params.fileContent || (typeof params.fileContent === "string" && !params.fileContent.trim())) {
      throw new BankStatementServiceError("EMPTY_FILE_CONTENT", "Statement file content cannot be empty.");
    }

    const sourceFormat: BankStatementSourceFormat = params.sourceFormat || "CSV";
    const contentString =
      typeof params.fileContent === "string"
        ? params.fileContent
        : params.fileContent.toString("utf-8");

    if (contentString.trim().length === 0) {
      throw new BankStatementServiceError("EMPTY_FILE_CONTENT", "Statement file content cannot be empty.");
    }

    // 2. Validate Bank Account exists and is ACTIVE
    const bankAccount = await BankAccountRepository.findById(params.bankAccountId.trim());
    if (!bankAccount) {
      throw new BankStatementServiceError(
        "BANK_ACCOUNT_NOT_FOUND",
        `Bank account with ID ${params.bankAccountId} does not exist.`
      );
    }
    if (bankAccount.status !== "ACTIVE") {
      throw new BankStatementServiceError(
        "BANK_ACCOUNT_NOT_ACTIVE",
        `Bank account ${params.bankAccountId} is ${bankAccount.status}. Imports are only permitted for ACTIVE accounts.`
      );
    }

    // 3. Compute File SHA-256 & Replay Protection
    const fileSha256 = crypto
      .createHash("sha256")
      .update(typeof params.fileContent === "string" ? Buffer.from(params.fileContent, "utf-8") : params.fileContent)
      .digest("hex");

    const existingImport = await BankStatementImportRepository.findBySha256(
      params.bankAccountId.trim(),
      fileSha256
    );
    if (existingImport) {
      throw new BankStatementServiceError(
        "DUPLICATE_STATEMENT_FILE",
        `A statement file with identical checksum (SHA-256: ${fileSha256}) has already been imported for this bank account (Import ID: ${existingImport.id}, Filename: ${existingImport.source_filename}).`
      );
    }

    // 4. Parse statement lines according to source format
    let rawLines: ParsedRawLine[] = [];
    switch (sourceFormat) {
      case "CSV":
        rawLines = this.parseCsv(contentString, params.customColumnMapping);
        break;
      case "MT940":
        rawLines = this.parseMt940(contentString);
        break;
      case "OFX":
        rawLines = this.parseOfx(contentString);
        break;
      default:
        // Try CSV fallback for CUSTOM or MANUAL
        rawLines = this.parseCsv(contentString, params.customColumnMapping);
        break;
    }

    if (!rawLines || rawLines.length === 0) {
      throw new BankStatementServiceError(
        "NO_STATEMENT_LINES_FOUND",
        "The statement file contains no valid transaction lines."
      );
    }

    // 5. Compute aggregates, periods, and line hashes
    let totalDebit = 0;
    let totalCredit = 0;
    let periodStart = rawLines[0].transactionDate;
    let periodEnd = rawLines[0].transactionDate;

    const lineInputs: CreateLineParams[] = [];
    const importId = `bsi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    for (const raw of rawLines) {
      // Validate dates
      if (!this.isValidIsoDate(raw.transactionDate)) {
        throw new BankStatementServiceError(
          "INVALID_TRANSACTION_DATE",
          `Line ${raw.lineNumber} has invalid transaction date: ${raw.transactionDate}. Expected format YYYY-MM-DD.`
        );
      }
      if (raw.valueDate && !this.isValidIsoDate(raw.valueDate)) {
        throw new BankStatementServiceError(
          "INVALID_VALUE_DATE",
          `Line ${raw.lineNumber} has invalid value date: ${raw.valueDate}. Expected format YYYY-MM-DD.`
        );
      }

      // Update period range
      if (raw.transactionDate < periodStart) periodStart = raw.transactionDate;
      if (raw.transactionDate > periodEnd) periodEnd = raw.transactionDate;

      // Validate amounts (single-sided invariant)
      const debit = Math.round(raw.debitAmount * 100) / 100;
      const credit = Math.round(raw.creditAmount * 100) / 100;

      if (debit < 0 || credit < 0) {
        throw new BankStatementServiceError(
          "NEGATIVE_AMOUNT_REJECTED",
          `Line ${raw.lineNumber} has negative amount: debit=${debit}, credit=${credit}.`
        );
      }

      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw new BankStatementServiceError(
          "INVALID_LINE_AMOUNT",
          `Line ${raw.lineNumber} violates single-sided amount constraint: debit=${debit}, credit=${credit}. Exactly one side must be > 0.`
        );
      }

      totalDebit = Math.round((totalDebit + debit) * 100) / 100;
      totalCredit = Math.round((totalCredit + credit) * 100) / 100;

      // Deterministic line hash for deduplication
      const lineHash = crypto
        .createHash("sha256")
        .update(
          `${raw.lineNumber}:${raw.transactionDate}:${raw.valueDate || ""}:${raw.description.trim()}:${debit}:${credit}:${(raw.bankReference || "").trim()}`
        )
        .digest("hex");

      lineInputs.push({
        import_id: importId,
        bank_account_id: params.bankAccountId.trim(),
        line_number: raw.lineNumber,
        transaction_date: raw.transactionDate,
        value_date: raw.valueDate || null,
        description: raw.description.trim(),
        bank_reference: raw.bankReference ? raw.bankReference.trim() : null,
        debit_amount: debit,
        credit_amount: credit,
        running_balance: raw.runningBalance !== undefined && raw.runningBalance !== null ? Math.round(raw.runningBalance * 100) / 100 : null,
        line_hash: lineHash,
        reconciliation_status: "UNMATCHED",
        metadata: raw.metadata || {},
      });
    }

    // 6. Execute atomic DB transaction
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Insert parent import record
      const importParams: CreateImportParams = {
        id: importId,
        bank_account_id: params.bankAccountId.trim(),
        company_id: params.companyId || bankAccount.company_id || await CompanyRepository.resolveCompanyId(),
        source_filename: params.sourceFilename.trim(),
        source_format: sourceFormat,
        file_sha256: fileSha256,
        file_size_bytes: Buffer.byteLength(contentString, "utf-8"),
        statement_period_start: periodStart,
        statement_period_end: periodEnd,
        total_lines_imported: lineInputs.length,
        total_debit_amount: totalDebit,
        total_credit_amount: totalCredit,
        status: "COMPLETED",
        imported_by: params.importedBy.trim(),
        metadata: {
          ...params.metadata,
          importedAt: new Date().toISOString(),
          originalLineCount: lineInputs.length,
        },
      };

      const createdImport = await BankStatementImportRepository.createImport(importParams, client);

      // Insert statement lines batch
      await BankStatementImportRepository.createLinesBatch(lineInputs, client);

      await client.query("COMMIT");

      return {
        importRecord: createdImport,
        linesCount: lineInputs.length,
        totalDebitAmount: totalDebit,
        totalCreditAmount: totalCredit,
        statementPeriodStart: periodStart,
        statementPeriodEnd: periodEnd,
      };
    } catch (err: unknown) {
      await client.query("ROLLBACK");
      if (err instanceof BankStatementImportError || err instanceof BankStatementServiceError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new BankStatementServiceError("INGESTION_TRANSACTION_FAILED", `Failed to ingest statement: ${message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves an import record by ID.
   */
  static async getImportById(id: string): Promise<BankStatementImportRow | null> {
    return BankStatementImportRepository.findById(id);
  }

  /**
   * Lists statement imports with filtering and pagination.
   */
  static async listImports(
    filter: ListImportsFilter = {}
  ): Promise<{ imports: BankStatementImportRow[]; totalCount: number }> {
    return BankStatementImportRepository.listImports(filter);
  }

  /**
   * Retrieves statement lines for an import.
   */
  static async getImportLines(
    importId: string,
    filter: ListLinesFilter = {}
  ): Promise<{ lines: BankStatementLineRow[]; totalCount: number }> {
    return BankStatementImportRepository.getLinesByImportId(importId, filter);
  }

  /**
   * Retrieves a single statement line by ID.
   */
  static async getLineById(lineId: string): Promise<BankStatementLineRow | null> {
    return BankStatementImportRepository.getLineById(lineId);
  }

  /**
   * Cancels a statement import IF none of its lines have been reconciled or matched.
   */
  static async cancelImport(
    importId: string,
    cancelledBy: string,
    reason: string
  ): Promise<BankStatementImportRow> {
    const importRec = await BankStatementImportRepository.findById(importId);
    if (!importRec) {
      throw new BankStatementServiceError("IMPORT_NOT_FOUND", `Statement import ${importId} not found.`);
    }

    if (importRec.status === "SUPERSEDED" || importRec.status === "FAILED") {
      throw new BankStatementServiceError(
        "IMPORT_ALREADY_CANCELLED",
        `Statement import ${importId} is already ${importRec.status}.`
      );
    }

    // Check if any lines are MATCHED or PARTIALLY_MATCHED
    const { lines } = await BankStatementImportRepository.getLinesByImportId(importId);
    const matchedLines = lines.filter(
      (l) => l.reconciliation_status === "MATCHED" || l.reconciliation_status === "PARTIALLY_MATCHED"
    );
    if (matchedLines.length > 0) {
      throw new BankStatementServiceError(
        "CANNOT_CANCEL_RECONCILED_IMPORT",
        `Cannot cancel import ${importId}: ${matchedLines.length} lines have already been reconciled. Reverse matches before cancelling.`
      );
    }

    return BankStatementImportRepository.updateImportStatus(importId, "SUPERSEDED", {
      cancelledBy,
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSER IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Parses standard CSV bank statements.
   * Supports standard column names, Indian banking formats (HDFC, ICICI, SBI),
   * separate debit/credit columns, and single signed-amount columns with DR/CR indicators.
   */
  static parseCsv(csvText: string, customMapping?: Record<string, string>): ParsedRawLine[] {
    const cleaned = csvText.replace(/^\uFEFF/, "").trim(); // Remove UTF-8 BOM
    if (!cleaned) return [];

    const lines = this.splitCsvLines(cleaned);
    if (lines.length < 2) return [];

    // Find header row (first non-empty row that matches expected column patterns)
    let headerIdx = -1;
    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      const lowerRow = row.map((c) => c.toLowerCase().trim());
      // Look for telltale headers like date, description/particulars, debit/credit/withdrawal/deposit
      const hasDate = lowerRow.some((c) => c.includes("date"));
      const hasDesc = lowerRow.some(
        (c) =>
          c.includes("desc") ||
          c.includes("particular") ||
          c.includes("narration") ||
          c.includes("detail")
      );
      const hasAmount = lowerRow.some(
        (c) =>
          c.includes("debit") ||
          c.includes("credit") ||
          c.includes("withdrawal") ||
          c.includes("deposit") ||
          c.includes("amount")
      );

      if (hasDate && (hasDesc || hasAmount)) {
        headerIdx = i;
        headers = lowerRow;
        break;
      }
    }

    if (headerIdx === -1) {
      // Fallback: assume first line is header
      headerIdx = 0;
      headers = lines[0].map((c) => c.toLowerCase().trim());
    }

    // Map column indices
    const colMap = this.detectColumnIndices(headers, customMapping);

    const parsed: ParsedRawLine[] = [];
    let lineNum = 1;

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
        continue; // skip blank rows
      }

      const dateStr = colMap.dateIdx !== -1 && row[colMap.dateIdx] ? row[colMap.dateIdx].trim() : "";
      if (!dateStr) continue;

      const isoDate = this.parseDateToIso(dateStr);
      if (!isoDate) continue; // Skip summary / footer rows that don't have valid dates

      const valueDateStr =
        colMap.valueDateIdx !== -1 && row[colMap.valueDateIdx]
          ? row[colMap.valueDateIdx].trim()
          : null;
      const isoValueDate = valueDateStr ? this.parseDateToIso(valueDateStr) : null;

      const desc =
        colMap.descIdx !== -1 && row[colMap.descIdx]
          ? row[colMap.descIdx].trim()
          : `Transaction Line ${lineNum}`;

      const ref =
        colMap.refIdx !== -1 && row[colMap.refIdx] ? row[colMap.refIdx].trim() : null;

      let debit = 0;
      let credit = 0;

      if (colMap.debitIdx !== -1 && colMap.creditIdx !== -1) {
        // Separate Debit & Credit columns
        const debitRaw = row[colMap.debitIdx] ? this.parseAmount(row[colMap.debitIdx]) : 0;
        const creditRaw = row[colMap.creditIdx] ? this.parseAmount(row[colMap.creditIdx]) : 0;
        debit = debitRaw;
        credit = creditRaw;
      } else if (colMap.amountIdx !== -1) {
        // Single Amount column
        const rawAmt = row[colMap.amountIdx] ? this.parseAmount(row[colMap.amountIdx]) : 0;
        let typeIndicator = "";
        if (colMap.typeIdx !== -1 && row[colMap.typeIdx]) {
          typeIndicator = row[colMap.typeIdx].trim().toUpperCase();
        }

        if (typeIndicator === "DR" || typeIndicator === "DEBIT" || rawAmt < 0) {
          debit = Math.abs(rawAmt);
          credit = 0;
        } else {
          credit = Math.abs(rawAmt);
          debit = 0;
        }
      }

      // Balance
      const balance =
        colMap.balanceIdx !== -1 && row[colMap.balanceIdx]
          ? this.parseAmount(row[colMap.balanceIdx])
          : null;

      // Include non-zero lines (including negative/invalid for validation enforcement)
      if (debit !== 0 || credit !== 0) {
        parsed.push({
          lineNumber: lineNum++,
          transactionDate: isoDate,
          valueDate: isoValueDate,
          description: desc,
          bankReference: ref || null,
          debitAmount: debit,
          creditAmount: credit,
          runningBalance: balance,
        });
      }
    }

    return parsed;
  }

  /**
   * Parses SWIFT MT940 statement format.
   */
  static parseMt940(mt940Text: string): ParsedRawLine[] {
    const lines = mt940Text.split(/\r?\n/);
    const parsed: ParsedRawLine[] = [];
    let lineNum = 1;

    let currentTxn: Partial<ParsedRawLine> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith(":61:")) {
        // If there was a previous transaction, push it
        if (currentTxn && (currentTxn.debitAmount! > 0 || currentTxn.creditAmount! > 0)) {
          parsed.push(currentTxn as ParsedRawLine);
          currentTxn = null;
        }

        // Tag :61: Statement Line
        // Format: :61:YYMMDD[MMDD]D/C[F]AmountN...
        const content = line.substring(4);
        const match = content.match(/^(\d{6})(\d{4})?(CR|DR|RC|RD|C|D)([A-Z])?([0-9,.]+)(?:N[A-Z0-9]{3}|F[A-Z0-9]{3}|[A-Z0-9]{4})?(.*)$/i);
        if (match) {
          const valDateRaw = match[1]; // YYMMDD
          const cdMark = match[3].toUpperCase();
          const amtRaw = match[5].replace(",", ".");
          const rawRef = match[6] ? match[6].trim() : "";
          const refRaw = rawRef.includes("//") ? rawRef.split("//")[1].trim() : rawRef;

          const parsedAmt = parseFloat(amtRaw);
          const isDebit = cdMark === "D" || cdMark === "DR" || cdMark === "RD";

          const year = parseInt(valDateRaw.substring(0, 2), 10) + 2000;
          const month = valDateRaw.substring(2, 4);
          const day = valDateRaw.substring(4, 6);
          const isoDate = `${year}-${month}-${day}`;

          currentTxn = {
            lineNumber: lineNum++,
            transactionDate: isoDate,
            valueDate: isoDate,
            description: refRaw || "SWIFT MT940 Transaction",
            bankReference: refRaw || null,
            debitAmount: isDebit ? parsedAmt : 0,
            creditAmount: !isDebit ? parsedAmt : 0,
            runningBalance: null,
          };
        }
      } else if (line.startsWith(":86:") && currentTxn) {
        // Tag :86: Information to Account Owner (Description/Narration)
        const info = line.substring(4).trim();
        currentTxn.description = info || currentTxn.description;
      }
    }

    if (currentTxn && (currentTxn.debitAmount! > 0 || currentTxn.creditAmount! > 0)) {
      parsed.push(currentTxn as ParsedRawLine);
    }

    return parsed;
  }

  /**
   * Parses OFX / QFX statement format.
   */
  static parseOfx(ofxText: string): ParsedRawLine[] {
    const parsed: ParsedRawLine[] = [];
    let lineNum = 1;

    // Match each <STMTTRN>...</STMTTRN> block
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match: RegExpExecArray | null;

    while ((match = stmtTrnRegex.exec(ofxText)) !== null) {
      const block = match[1];

      const trnType = this.extractOfxTag(block, "TRNTYPE") || "";
      const dtPosted = this.extractOfxTag(block, "DTPOSTED") || "";
      const trnAmt = this.extractOfxTag(block, "TRNAMT") || "0";
      const fitId = this.extractOfxTag(block, "FITID") || null;
      const name = this.extractOfxTag(block, "NAME") || "";
      const memo = this.extractOfxTag(block, "MEMO") || "";

      const rawAmount = parseFloat(trnAmt.replace(",", "."));
      const isDebit = rawAmount < 0 || trnType.toUpperCase() === "DEBIT";

      // Parse date: OFX is typically YYYYMMDDHHMMSS or YYYYMMDD
      let isoDate = "";
      if (dtPosted.length >= 8) {
        const y = dtPosted.substring(0, 4);
        const m = dtPosted.substring(4, 6);
        const d = dtPosted.substring(6, 8);
        isoDate = `${y}-${m}-${d}`;
      } else {
        isoDate = new Date().toISOString().split("T")[0];
      }

      const desc = [name, memo].filter(Boolean).join(" - ") || "OFX Transaction";

      const debit = isDebit ? Math.abs(rawAmount) : 0;
      const credit = !isDebit ? Math.abs(rawAmount) : 0;

      if (debit > 0 || credit > 0) {
        parsed.push({
          lineNumber: lineNum++,
          transactionDate: isoDate,
          valueDate: isoDate,
          description: desc,
          bankReference: fitId,
          debitAmount: debit,
          creditAmount: credit,
          runningBalance: null,
        });
      }
    }

    return parsed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CSV HELPERS & DATE/AMOUNT PARSERS
  // ─────────────────────────────────────────────────────────────────────────────

  private static splitCsvLines(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        currentRow.push(currentField);
        currentField = "";
      } else if ((char === "\r" || char === "\n") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++; // skip \n
        }
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  }

  private static detectColumnIndices(
    headers: string[],
    customMapping?: Record<string, string>
  ) {
    let dateIdx = -1;
    let valueDateIdx = -1;
    let descIdx = -1;
    let refIdx = -1;
    let debitIdx = -1;
    let creditIdx = -1;
    let amountIdx = -1;
    let typeIdx = -1;
    let balanceIdx = -1;

    // Apply custom mapping if provided
    if (customMapping) {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (customMapping.date && h === customMapping.date.toLowerCase()) dateIdx = i;
        if (customMapping.valueDate && h === customMapping.valueDate.toLowerCase()) valueDateIdx = i;
        if (customMapping.description && h === customMapping.description.toLowerCase()) descIdx = i;
        if (customMapping.reference && h === customMapping.reference.toLowerCase()) refIdx = i;
        if (customMapping.debit && h === customMapping.debit.toLowerCase()) debitIdx = i;
        if (customMapping.credit && h === customMapping.credit.toLowerCase()) creditIdx = i;
        if (customMapping.amount && h === customMapping.amount.toLowerCase()) amountIdx = i;
        if (customMapping.balance && h === customMapping.balance.toLowerCase()) balanceIdx = i;
      }
    }

    // Auto-detect standard columns if not mapped
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];

      // Value Date vs Txn Date
      if (h.includes("value") && h.includes("date") && valueDateIdx === -1) {
        valueDateIdx = i;
      } else if (h.includes("date") && dateIdx === -1) {
        dateIdx = i;
      }

      // Description / Narration / Particulars
      if (
        (h.includes("desc") ||
          h.includes("particular") ||
          h.includes("narration") ||
          h.includes("remarks") ||
          h.includes("transaction detail")) &&
        descIdx === -1
      ) {
        descIdx = i;
      }

      // Reference / UTR / Cheque No
      if (
        (h.includes("ref") ||
          h.includes("chq") ||
          h.includes("cheque") ||
          h.includes("utr") ||
          h.includes("txn id") ||
          h.includes("transaction id")) &&
        refIdx === -1
      ) {
        refIdx = i;
      }

      // Debit / Withdrawal
      if (
        (h.includes("debit") ||
          h.includes("withdrawal") ||
          h.startsWith("dr") ||
          /\bdr\b/i.test(h) ||
          h.includes("paid out") ||
          h.includes("debit amount")) &&
        debitIdx === -1
      ) {
        debitIdx = i;
      }

      // Credit / Deposit
      if (
        (h.includes("credit") ||
          h.includes("deposit") ||
          h.startsWith("cr") ||
          /\bcr\b/i.test(h) ||
          h.includes("paid in") ||
          h.includes("credit amount")) &&
        creditIdx === -1
      ) {
        creditIdx = i;
      }

      // Single Amount
      if (h === "amount" || h === "transaction amount" || h === "net amount") {
        if (amountIdx === -1) amountIdx = i;
      }

      // Type (DR/CR)
      if (h === "type" || h === "cr/dr" || h === "dr/cr" || h === "d/c") {
        if (typeIdx === -1) typeIdx = i;
      }

      // Running Balance
      if (
        (h.includes("balance") || h.includes("closing balance") || h.includes("bal")) &&
        balanceIdx === -1
      ) {
        balanceIdx = i;
      }
    }

    return {
      dateIdx,
      valueDateIdx,
      descIdx,
      refIdx,
      debitIdx,
      creditIdx,
      amountIdx,
      typeIdx,
      balanceIdx,
    };
  }

  private static parseDateToIso(dateStr: string): string | null {
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    // ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Format: DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // Format: DD-Mon-YYYY or DD Mon YYYY (e.g., 15-Jan-2026 or 15 Jan 2026)
    const monthNames: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const monMatch = trimmed.match(/^(\d{1,2})[\s\-]([a-zA-Z]{3})[\s\-](\d{4})$/);
    if (monMatch) {
      const day = monMatch[1].padStart(2, "0");
      const monStr = monMatch[2].toLowerCase();
      const month = monthNames[monStr];
      const year = monMatch[3];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    // Fallback: Date.parse
    const ts = Date.parse(trimmed);
    if (!isNaN(ts)) {
      const d = new Date(ts);
      return d.toISOString().split("T")[0];
    }

    return null;
  }

  private static parseAmount(val: string): number {
    if (!val) return 0;
    // Remove currency symbols, commas, spaces
    const sanitized = val.replace(/[^0-9.\-]/g, "").trim();
    if (!sanitized) return 0;
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  private static isValidIsoDate(str: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(str);
    return !isNaN(d.getTime()) && d.toISOString().startsWith(str);
  }

  private static extractOfxTag(block: string, tag: string): string | null {
    // Matches both <TAG>value and <TAG>value</TAG>
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)(?:<\\/${tag}>)?`, "i");
    const match = block.match(regex);
    return match ? match[1].trim() : null;
  }
}
