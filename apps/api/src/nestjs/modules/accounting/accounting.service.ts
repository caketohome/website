import { Injectable, BadRequestException, NotFoundException, ConflictException } from "@nestjs/common";
let Pool: any;
try {
  Pool = require("pg").Pool;
} catch (e) {
  try {
    Pool = require("E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg").Pool;
  } catch (e2) {
    console.error("Failed to load pg:", e2.message);
  }
}

@Injectable()
export class AccountingService {
  private pool: Pool;

  constructor() {
    const connStr =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5";

    this.pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }

  private maskAccountNumber(acc: string): string {
    const clean = (acc || "").trim();
    if (clean.length <= 4) return `•••• ${clean}`;
    return `•••• •••• •••• ${clean.slice(-4)}`;
  }

  async getDashboardSummary() {
    const q1 = `
      SELECT
        COUNT(*) AS total_banks,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_banks,
        COALESCE(SUM(current_balance), 0) AS total_bank_balance
      FROM public.bank_account
      WHERE deleted_at IS NULL;
    `;
    const q2 = `
      SELECT COALESCE(SUM(current_balance), 0) AS total_cash_balance
      FROM public.cash_account
      WHERE deleted_at IS NULL AND status = 'ACTIVE';
    `;
    const q3 = `
      SELECT COUNT(*) AS unmatched
      FROM public.bank_transaction
      WHERE reconciliation_status = 'UNRECONCILED';
    `;
    const q4 = `
      SELECT COUNT(*) AS pending_recon
      FROM public.bank_reconciliation
      WHERE status = 'IN_PROGRESS';
    `;

    const [r1, r2, r3, r4] = await Promise.all([
      this.pool.query(q1),
      this.pool.query(q2),
      this.pool.query(q3),
      this.pool.query(q4),
    ]);

    return {
      success: true,
      data: {
        totalBankAccounts: parseInt(r1.rows[0]?.total_banks || "0", 10),
        activeBankAccounts: parseInt(r1.rows[0]?.active_banks || "0", 10),
        totalBankBalance: parseFloat(r1.rows[0]?.total_bank_balance || "0"),
        totalCashBalance: parseFloat(r2.rows[0]?.total_cash_balance || "0"),
        pendingReconciliations: parseInt(r4.rows[0]?.pending_recon || "0", 10),
        unmatchedTransactions: parseInt(r3.rows[0]?.unmatched || "0", 10),
      },
    };
  }

  async listBankAccounts(filter: { status?: string; search?: string; branchId?: string }) {
    const conditions: string[] = ["ba.deleted_at IS NULL"];
    const values: any[] = [];
    let idx = 1;

    if (filter.status && filter.status !== "ALL") {
      conditions.push(`ba.status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.branchId) {
      conditions.push(`ba.branch_id = $${idx++}`);
      values.push(filter.branchId);
    }
    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      conditions.push(
        `(ba.account_name ILIKE $${idx} OR ba.bank_name ILIKE $${idx} OR ba.account_number_masked ILIKE $${idx} OR ba.ifsc_code ILIKE $${idx} OR aa.code ILIKE $${idx} OR aa.name ILIKE $${idx})`
      );
      values.push(q);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT
        ba.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name,
        br.code AS branch_code,
        br.name AS branch_display_name
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      LEFT JOIN public.branch br ON ba.branch_id = br.id
      ${where}
      ORDER BY ba.is_primary DESC, ba.created_at DESC;
    `;

    const res = await this.pool.query(sql, values);
    const maskedRows = res.rows.map((r: any) => ({
      ...r,
      account_number: r.account_number_masked || this.maskAccountNumber(r.account_number || ""),
    }));
    return {
      success: true,
      data: maskedRows,
      bankAccounts: maskedRows,
    };
  }

  async getBankAccount(id: string) {
    const sql = `
      SELECT
        ba.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name,
        br.code AS branch_code,
        br.name AS branch_display_name
      FROM public.bank_account ba
      LEFT JOIN public.accounting_account aa ON ba.gl_account_id = aa.id
      LEFT JOIN public.branch br ON ba.branch_id = br.id
      WHERE ba.id = $1 AND ba.deleted_at IS NULL;
    `;
    const res = await this.pool.query(sql, [id]);
    if (!res.rows[0]) {
      throw new NotFoundException(`Bank account '${id}' not found`);
    }
    return {
      success: true,
      data: res.rows[0],
      bankAccount: res.rows[0],
    };
  }

  async createBankAccount(body: any) {
    const bankName = (body.bank_name || body.bankName || "").trim();
    const accountName = (body.account_name || body.accountName || "").trim();
    const accountNumber = (body.account_number || body.accountNumber || "").trim();
    const ifsc = (body.ifsc_code || body.ifscCode || "").trim().toUpperCase();

    if (bankName.length < 2) throw new BadRequestException("Bank name must be at least 2 characters.");
    if (accountName.length < 2) throw new BadRequestException("Account name must be at least 2 characters.");
    if (accountNumber.length < 4) throw new BadRequestException("Account number must be at least 4 digits.");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      throw new BadRequestException(`Invalid IFSC code format: '${ifsc}'. Must be 11 characters, e.g. HDFC0000053.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Company resolution
      const compRes = await client.query("SELECT id FROM public.company LIMIT 1;");
      const companyId = compRes.rows[0]?.id;
      if (!companyId) throw new BadRequestException("Company not configured in database.");

      // Duplicate check
      const dup = await client.query(
        "SELECT id FROM public.bank_account WHERE company_id = $1 AND ifsc_code = $2 AND account_number = $3 AND deleted_at IS NULL;",
        [companyId, ifsc, accountNumber]
      );
      if (dup.rows.length > 0) {
        throw new ConflictException(`Bank account with IFSC '${ifsc}' and account number '${accountNumber}' already exists.`);
      }

      // GL Account linkage or auto-provision
      let glAccountId = body.gl_account_id || body.glAccountId;
      if (glAccountId && glAccountId !== "AUTO") {
        const glRes = await client.query("SELECT id, code, name, type, subtype, is_active FROM public.accounting_account WHERE id = $1;", [glAccountId]);
        if (!glRes.rows[0]) throw new NotFoundException(`GL Account '${glAccountId}' not found.`);
        const mapped = await client.query("SELECT id FROM public.bank_account WHERE gl_account_id = $1 AND deleted_at IS NULL;", [glAccountId]);
        if (mapped.rows.length > 0) throw new ConflictException(`GL account is already mapped to bank account '${mapped.rows[0].id}'.`);
      } else {
        // Auto provision GL Account under 1110
        const parentRes = await client.query("SELECT id FROM public.accounting_account WHERE code = '1110' LIMIT 1;");
        const parentId = parentRes.rows[0]?.id;
        const countRes = await client.query("SELECT code FROM public.accounting_account WHERE code LIKE '1112%' ORDER BY code DESC LIMIT 5;");
        let nextNum = 1;
        for (const r of countRes.rows) {
          const m = r.code.match(/1112[_-]?(\d+)/);
          if (m && parseInt(m[1], 10) >= nextNum) nextNum = parseInt(m[1], 10) + 1;
        }
        const nextCode = `1112-${String(nextNum).padStart(2, "0")}`;
        glAccountId = `acc_bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await client.query(`
          INSERT INTO public.accounting_account (
            id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active,
            description, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, 'ASSET', 'BANK', $4, 4, false, false, true,
            $5, 'system', NOW(), NOW()
          );
        `, [glAccountId, nextCode, `${bankName} - ${accountName}`, parentId, `Bank GL for ${accountName}`]);
      }

      const id = `ba_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const masked = this.maskAccountNumber(accountNumber);
      const openBal = Number(body.opening_balance || body.openingBalance) || 0;
      const openDate = body.opening_balance_date || body.openingBalanceDate || new Date().toISOString().split("T")[0];
      const branchId = body.branch_id || body.branchId || null;
      const accountType = body.account_type || body.accountType || "CURRENT";

      // Insert bank account
      const insertSql = `
        INSERT INTO public.bank_account (
          id, company_id, account_name, bank_name, account_number, account_number_masked,
          ifsc_code, account_type, branch_name, branch_id, currency, gl_account_id,
          opening_balance, opening_balance_date, current_balance, statement_balance,
          is_primary, allow_payments, allow_receipts, reconciliation_required,
          status, created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, 'INR', $11,
          $12, $13, $12, $12,
          $14, true, true, true,
          'ACTIVE', 'admin_01', 'admin_01', NOW(), NOW()
        )
        RETURNING *;
      `;
      const bankRes = await client.query(insertSql, [
        id, companyId, accountName, bankName, accountNumber, masked,
        ifsc, accountType, body.branch_name || body.branchName || null, branchId, glAccountId,
        openBal, openDate, Boolean(body.is_primary || body.isPrimary)
      ]);

      // If opening balance > 0, post balanced double-entry voucher
      if (openBal > 0) {
        const offsetRes = await client.query("SELECT id FROM public.accounting_account WHERE code = '3300' OR subtype = 'OPENING_OFFSET' LIMIT 1;");
        const offsetId = offsetRes.rows[0]?.id;

        if (offsetId) {
          const vchId = `vch_ob_${Date.now()}`;
          const vchNo = `JV-OB-${Date.now().toString().slice(-6)}`;
          await client.query(`
            INSERT INTO public.accounting_voucher (
              id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
              status, total_amount, currency, reference_type, reference_id, reference_event,
              narration, created_by, posted_by, posted_at, created_at, updated_at
            ) VALUES (
              $1, $2, 'OPENING_BALANCE', $3, COALESCE($4, 'br_indiranagar_01'), '26-27',
              'POSTED', $5, 'INR', 'BANK_ACCOUNT', $6, 'BANK_OPENING_BALANCE',
              $7, 'admin_01', 'admin_01', NOW(), NOW(), NOW()
            );
          `, [vchId, vchNo, openDate, branchId, openBal, id, `Opening balance for ${bankName} - ${accountName}`]);

          const entryId = `je_ob_${Date.now()}`;
          await client.query(`
            INSERT INTO public.accounting_journal_entry (
              id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
              total_debit, total_credit, is_reversed, narration, created_by, created_at
            ) VALUES (
              $1, $2, $3, $4, COALESCE($5, 'br_indiranagar_01'), '26-27',
              $6, $6, false, $7, 'admin_01', NOW()
            );
          `, [entryId, `JE-OB-${Date.now().toString().slice(-6)}`, vchId, openDate, branchId, openBal, `Opening balance journal for ${bankName}`]);

          // Debit Bank GL
          await client.query(`
            INSERT INTO public.accounting_journal_line (
              id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
            ) VALUES ($1, $2, 1, $3, $4, 0.00, COALESCE($5, 'br_indiranagar_01'), $6);
          `, [`jl_${Date.now()}_1`, entryId, glAccountId, openBal, branchId, `Debit Bank GL ${accountName}`]);

          // Credit Opening Offset GL
          await client.query(`
            INSERT INTO public.accounting_journal_line (
              id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
            ) VALUES ($1, $2, 2, $3, 0.00, $4, COALESCE($5, 'br_indiranagar_01'), $6);
          `, [`jl_${Date.now()}_2`, entryId, offsetId, openBal, branchId, `Credit Opening Offset Equity`]);

          // Initial bank transaction
          await client.query(`
            INSERT INTO public.bank_transaction (
              id, bank_account_id, transaction_date, value_date, transaction_type,
              reference_no, description, debit_amount, credit_amount, running_balance,
              reconciliation_status, voucher_id, journal_entry_id, created_by, created_at
            ) VALUES (
              $1, $2, $3, $3, 'OPENING_BALANCE',
              $4, $5, 0.00, $6, $6,
              'RECONCILED', $7, $8, 'admin_01', NOW()
            );
          `, [`bt_ob_${Date.now()}`, id, openDate, vchNo, `Opening balance posted to ${glAccountId}`, openBal, vchId, entryId]);
        }
      }

      await client.query("COMMIT");
      return {
        success: true,
        data: bankRes.rows[0],
        bankAccount: bankRes.rows[0],
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async updateBankAccount(id: string, body: any) {
    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    if (body.account_name !== undefined) {
      fields.push(`account_name = $${idx++}`);
      values.push(body.account_name.trim());
    }
    if (body.bank_name !== undefined) {
      fields.push(`bank_name = $${idx++}`);
      values.push(body.bank_name.trim());
    }
    if (body.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(body.status);
    }
    if (body.is_primary !== undefined) {
      fields.push(`is_primary = $${idx++}`);
      values.push(Boolean(body.is_primary));
    }
    fields.push("updated_at = NOW()");

    const sql = `
      UPDATE public.bank_account
      SET ${fields.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = await this.pool.query(sql, values);
    if (!res.rows[0]) throw new NotFoundException(`Bank account '${id}' not found`);
    return { success: true, data: res.rows[0], bankAccount: res.rows[0] };
  }

  async deactivateBankAccount(id: string) {
    const sql = `
      UPDATE public.bank_account
      SET status = 'INACTIVE', updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = await this.pool.query(sql, [id]);
    if (!res.rows[0]) throw new NotFoundException(`Bank account '${id}' not found`);
    return { success: true, data: res.rows[0], bankAccount: res.rows[0] };
  }

  async getBankTransactions(id: string) {
    const sql = `
      SELECT * FROM public.bank_transaction
      WHERE bank_account_id = $1
      ORDER BY transaction_date DESC, created_at DESC;
    `;
    const res = await this.pool.query(sql, [id]);
    return { success: true, data: res.rows, transactions: res.rows };
  }

  async transferFunds(body: any) {
    const sourceId = body.source_bank_account_id || body.sourceBankAccountId;
    const destId = body.dest_bank_account_id || body.destBankAccountId;
    const amount = Number(body.transfer_amount || body.amount);
    const date = body.transfer_date || body.date || new Date().toISOString().split("T")[0];
    const refNo = (body.reference_no || body.referenceNo || `TRF-${Date.now().toString().slice(-6)}`).trim();
    const desc = (body.description || `Internal fund transfer from ${sourceId} to ${destId}`).trim();

    if (sourceId === destId) throw new BadRequestException("Source and destination accounts must be distinct.");
    if (!amount || amount <= 0) throw new BadRequestException("Transfer amount must be greater than zero.");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const sRes = await client.query("SELECT * FROM public.bank_account WHERE id = $1 FOR UPDATE;", [sourceId]);
      const dRes = await client.query("SELECT * FROM public.bank_account WHERE id = $1 FOR UPDATE;", [destId]);

      if (!sRes.rows[0] || !dRes.rows[0]) throw new NotFoundException("Source or destination bank account not found.");
      const source = sRes.rows[0];
      const dest = dRes.rows[0];

      if (source.status !== "ACTIVE" || dest.status !== "ACTIVE") {
        throw new BadRequestException("Both bank accounts must be ACTIVE to transfer funds.");
      }

      if (Number(source.current_balance) < amount) {
        throw new BadRequestException(`Insufficient funds in source bank account. Available: ₹${source.current_balance}`);
      }

      const vchId = `vch_trf_${Date.now()}`;
      const entryId = `je_trf_${Date.now()}`;

      // Insert Voucher
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
          status, total_amount, currency, reference_type, reference_id, reference_event,
          narration, created_by, posted_by, posted_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'CONTRA', $3, 'br_indiranagar_01', '26-27',
          'POSTED', $4, 'INR', 'BANK_TRANSFER', $5, 'INTERNAL_TRANSFER',
          $6, 'admin_01', 'admin_01', NOW(), NOW(), NOW()
        );
      `, [vchId, `JV-TRF-${Date.now().toString().slice(-6)}`, date, amount, refNo, desc]);

      // Insert Journal Entry
      await client.query(`
        INSERT INTO public.accounting_journal_entry (
          id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
          total_debit, total_credit, is_reversed, narration, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, 'br_indiranagar_01', '26-27',
          $5, $5, false, $6, 'admin_01', NOW()
        );
      `, [entryId, `JE-TRF-${Date.now().toString().slice(-6)}`, vchId, date, amount, desc]);

      // Debit Destination Bank GL
      await client.query(`
        INSERT INTO public.accounting_journal_line (
          id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
        ) VALUES ($1, $2, 1, $3, $4, 0.00, 'br_indiranagar_01', $5);
      `, [`jl_${Date.now()}_1`, entryId, dest.gl_account_id, amount, `Debit Destination Bank ${dest.account_name}`]);

      // Credit Source Bank GL
      await client.query(`
        INSERT INTO public.accounting_journal_line (
          id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
        ) VALUES ($1, $2, 2, $3, 0.00, $4, 'br_indiranagar_01', $5);
      `, [`jl_${Date.now()}_2`, entryId, source.gl_account_id, amount, `Credit Source Bank ${source.account_name}`]);

      const newSourceBal = Number(source.current_balance) - amount;
      const newDestBal = Number(dest.current_balance) + amount;

      // Update source
      await client.query("UPDATE public.bank_account SET current_balance = $2, updated_at = NOW() WHERE id = $1;", [sourceId, newSourceBal]);
      // Update dest
      await client.query("UPDATE public.bank_account SET current_balance = $2, updated_at = NOW() WHERE id = $1;", [destId, newDestBal]);

      // Record source transaction
      await client.query(`
        INSERT INTO public.bank_transaction (
          id, bank_account_id, transaction_date, value_date, transaction_type,
          reference_no, description, debit_amount, credit_amount, running_balance,
          reconciliation_status, voucher_id, journal_entry_id, created_by, created_at
        ) VALUES ($1, $2, $3, $3, 'TRANSFER_OUT', $4, $5, $6, 0.00, $7, 'MATCHED', $8, $9, 'admin_01', NOW());
      `, [`bt_trf_out_${Date.now()}`, sourceId, date, refNo, `Transfer to ${dest.bank_name}`, amount, newSourceBal, vchId, entryId]);

      // Record dest transaction
      await client.query(`
        INSERT INTO public.bank_transaction (
          id, bank_account_id, transaction_date, value_date, transaction_type,
          reference_no, description, debit_amount, credit_amount, running_balance,
          reconciliation_status, voucher_id, journal_entry_id, created_by, created_at
        ) VALUES ($1, $2, $3, $3, 'TRANSFER_IN', $4, $5, 0.00, $6, $7, 'MATCHED', $8, $9, 'admin_01', NOW());
      `, [`bt_trf_in_${Date.now()}`, destId, date, refNo, `Transfer from ${source.bank_name}`, amount, newDestBal, vchId, entryId]);

      // Insert transfer record
      const trfId = `trf_${Date.now()}`;
      const trfRes = await client.query(`
        INSERT INTO public.bank_transfer (
          id, source_bank_account_id, dest_bank_account_id, transfer_amount,
          transfer_date, reference_no, description, status, voucher_id, journal_entry_id,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'POSTED', $8, $9, 'admin_01', NOW())
        RETURNING *;
      `, [trfId, sourceId, destId, amount, date, refNo, desc, vchId, entryId]);

      await client.query("COMMIT");
      return { success: true, data: trfRes.rows[0], transfer: trfRes.rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async listCashAccounts(filter: { branchId?: string }) {
    const conditions = ["ca.deleted_at IS NULL"];
    const values: any[] = [];
    if (filter.branchId) {
      conditions.push("ca.branch_id = $1");
      values.push(filter.branchId);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const sql = `
      SELECT
        ca.*,
        aa.code AS gl_account_code,
        aa.name AS gl_account_name,
        br.name AS branch_name
      FROM public.cash_account ca
      LEFT JOIN public.accounting_account aa ON ca.gl_account_id = aa.id
      LEFT JOIN public.branch br ON ca.branch_id = br.id
      ${where}
      ORDER BY ca.created_at ASC;
    `;
    const res = await this.pool.query(sql, values);
    return { success: true, data: res.rows, cashAccounts: res.rows };
  }

  async createCashAccount(body: any) {
    const accountName = (body.account_name || body.accountName || "").trim();
    if (!accountName) throw new BadRequestException("Account name is required.");

    const compRes = await this.pool.query("SELECT id FROM public.company LIMIT 1;");
    const companyId = compRes.rows[0]?.id;

    let glId = body.gl_account_id || body.glAccountId;
    if (!glId) {
      const glRes = await this.pool.query("SELECT id FROM public.accounting_account WHERE code = '1114' LIMIT 1;");
      glId = glRes.rows[0]?.id;
    }

    const id = `cash_${Date.now()}`;
    const openBal = Number(body.opening_balance || body.openingBalance) || 0;
    const branchId = body.branch_id || body.branchId || null;
    const accType = body.account_type || body.accountType || "BRANCH_CASH";

    const sql = `
      INSERT INTO public.cash_account (
        id, company_id, branch_id, account_name, account_type, gl_account_id,
        opening_balance, current_balance, status, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'ACTIVE', 'admin_01', 'admin_01', NOW(), NOW())
      RETURNING *;
    `;
    const res = await this.pool.query(sql, [id, companyId, branchId, accountName, accType, glId, openBal]);
    return { success: true, data: res.rows[0], cashAccount: res.rows[0] };
  }

  async listCashfreeSettlements() {
    const sql = `
      SELECT
        csb.*,
        csb.batch_ref AS settlement_id,
        csb.gateway_fee AS fee_amount,
        csb.gateway_tax AS tax_amount,
        ba.account_name AS bank_name,
        ba.account_number_masked,
        '1113' AS clearing_gl_code,
        'Payment Gateway Clearing' AS clearing_gl_name
      FROM public.cashfree_settlement_batch csb
      LEFT JOIN public.bank_account ba ON csb.bank_account_id = ba.id
      ORDER BY csb.settlement_date DESC, csb.created_at DESC;
    `;
    const res = await this.pool.query(sql);
    return { success: true, data: res.rows, settlements: res.rows };
  }

  async importBankStatement(body: any) {
    const bankAccountId = body.bank_account_id || body.bankAccountId;
    const fileName = body.file_name || body.fileName || "statement.csv";
    const lines = body.lines || [];

    if (!bankAccountId) throw new BadRequestException("bank_account_id is required");
    const bankRes = await this.pool.query("SELECT * FROM public.bank_account WHERE id = $1;", [bankAccountId]);
    if (!bankRes.rows[0]) throw new NotFoundException("Bank account not found.");

    const importId = `stmt_imp_${Date.now()}`;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO public.bank_statement_import (
          id, bank_account_id, file_name, file_format, total_lines, imported_lines, status, created_by, created_at
        ) VALUES ($1, $2, $3, 'CSV', $4, $4, 'COMPLETED', 'admin_01', NOW());
      `, [importId, bankAccountId, fileName, lines.length]);

      let lineNum = 1;
      for (const line of lines) {
        const lineId = `stmt_line_${Date.now()}_${lineNum}`;
        await client.query(`
          INSERT INTO public.bank_statement_line (
            id, statement_import_id, bank_account_id, line_number, transaction_date,
            value_date, reference_no, narration, debit_amount, credit_amount, balance,
            is_matched, created_at
          ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, false, NOW());
        `, [
          lineId, importId, bankAccountId, lineNum++, line.date || new Date().toISOString().split("T")[0],
          line.reference_no || null, line.description || "Statement entry",
          Number(line.debit) || 0, Number(line.credit) || 0, Number(line.balance) || 0
        ]);
      }

      await client.query("COMMIT");
      return { success: true, importId, totalLines: lines.length };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async matchReconciliation(body: any) {
    const { statement_line_id, transaction_id } = body;
    if (!statement_line_id || !transaction_id) {
      throw new BadRequestException("Both statement_line_id and transaction_id are required.");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        UPDATE public.bank_statement_line
        SET is_matched = true, matched_bank_transaction_id = $2, matched_at = NOW()
        WHERE id = $1;
      `, [statement_line_id, transaction_id]);

      await client.query(`
        UPDATE public.bank_transaction
        SET reconciliation_status = 'MATCHED'
        WHERE id = $1;
      `, [transaction_id]);

      await client.query("COMMIT");
      return { success: true, message: "Matched successfully." };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Pre-existing methods preserved
  async reconcilePayment(orderId: string) {
    return {
      order_id: orderId,
      gateway: "cashfree",
      invoice_series: "CH",
      fiscal_year: "26-27",
      reconciled: true,
      variance: 0.0,
      journal_voucher: {
        voucher_type: "RECEIPT",
        debit_account: "1010_CASHFREE_CLEARING",
        debit_amount: 525.0,
        credit_account: "1020_CUSTOMER_RECEIVABLE",
        credit_amount: 525.0,
        variance: 0.0,
        status: "POSTED",
      },
      verified_at: new Date().toISOString(),
    };
  }

  async getVouchers() {
    return [
      {
        id: "vch_001",
        voucher_no: "JV-2026-0001",
        voucher_type: "SALES",
        status: "POSTED",
        total_amount: 525.0,
      },
    ];
  }
}
