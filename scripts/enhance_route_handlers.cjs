const fs = require('fs');
const filePath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/[...path]/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. In GET handler: add summary, cash-accounts, cashfree-settlements, and transactions
const targetGet = `    if (path === "admin/bank-accounts" || path === "admin/accounting/bank-accounts") {`;
const replacementGet = `    // ── Banking Dashboard Summary ──
    if (path === "admin/accounting/dashboard/summary" || path === "accounting/dashboard/summary" || path === "admin/bank-management/summary") {
      try {
        const summary = await BankAccountService.getDashboardSummary();
        return jsonWithDataSource({ success: true, data: summary }, "postgres");
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: "SUMMARY_FAILED", message: err.message }, "error", 500);
      }
    }

    // ── Cash Accounts ──
    if (path === "admin/accounting/cash-accounts" || path === "accounting/cash-accounts" || path === "admin/cash-accounts") {
      try {
        const branchId = url.searchParams.get("branchId") || undefined;
        const cashAccounts = await BankAccountService.listCashAccounts({ branchId });
        return jsonWithDataSource({ success: true, data: cashAccounts, cashAccounts }, "postgres");
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: "CASH_ACCOUNTS_FAILED", message: err.message }, "error", 500);
      }
    }

    // ── Cashfree Settlements ──
    if (path === "admin/accounting/cashfree-settlements" || path === "accounting/cashfree-settlements") {
      try {
        const res = await dbQuery(\`
          SELECT
            csb.*,
            ba.account_name AS bank_name,
            ba.account_number_masked,
            aa.code AS clearing_gl_code,
            aa.name AS clearing_gl_name
          FROM public.cashfree_settlement_batch csb
          LEFT JOIN public.bank_account ba ON csb.destination_bank_account_id = ba.id
          LEFT JOIN public.accounting_account aa ON csb.clearing_gl_account_id = aa.id
          ORDER BY csb.settlement_date DESC, csb.created_at DESC;
        \`);
        return jsonWithDataSource({ success: true, data: res.rows, settlements: res.rows }, "postgres");
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: "SETTLEMENTS_FAILED", message: err.message }, "error", 500);
      }
    }

    // ── Bank Account Transactions ──
    const bankAccountTxMatch = path.match(/^(admin\/)?(accounting\/)?bank-accounts\\/([^/]+)\\/transactions$/);
    if (bankAccountTxMatch) {
      const accountId = bankAccountTxMatch[3];
      try {
        const transactions = await BankAccountService.getTransactions(accountId);
        return jsonWithDataSource({ success: true, data: transactions, transactions }, "postgres");
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: "TRANSACTIONS_FAILED", message: err.message }, "error", 500);
      }
    }

    if (path === "admin/bank-accounts" || path === "admin/accounting/bank-accounts" || path === "accounting/bank-accounts") {`;

// 2. In POST handler: add bank-transfers, cash-accounts, reconciliations/import, reconciliations/match, deactivate
const targetPost = `    if (path === "admin/bank-accounts" || path === "admin/accounting/bank-accounts") {`;
const replacementPost = `    // ── Bank Fund Transfers ──
    if (path === "admin/accounting/bank-transfers" || path === "accounting/bank-transfers" || path === "admin/bank-transfers") {
      const userCtx = resolveUserContext(req);
      try {
        const transfer = await BankAccountService.transferFunds({
          source_bank_account_id: body.source_bank_account_id || body.sourceBankAccountId,
          dest_bank_account_id: body.dest_bank_account_id || body.destBankAccountId,
          amount: Number(body.transfer_amount || body.amount),
          transfer_date: body.transfer_date || body.date,
          reference_no: body.reference_no || body.referenceNo,
          description: body.description,
          actorContext: userCtx,
        });
        return jsonWithDataSource({ success: true, data: transfer, transfer }, "postgres", 201);
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: err.code || "TRANSFER_FAILED", message: err.message }, "error", 400);
      }
    }

    // ── Create Cash Account ──
    if (path === "admin/accounting/cash-accounts" || path === "accounting/cash-accounts" || path === "admin/cash-accounts") {
      try {
        const companyRes = await dbQuery("SELECT id FROM public.company LIMIT 1;");
        const companyId = companyRes.rows[0]?.id;
        const created = await BankAccountService.createCashAccount({
          company_id: companyId,
          branch_id: body.branch_id || body.branchId,
          account_name: body.account_name || body.accountName,
          account_type: body.account_type || body.accountType,
          gl_account_id: body.gl_account_id || body.glAccountId,
          opening_balance: body.opening_balance || body.openingBalance,
          created_by: "admin_01",
        });
        return jsonWithDataSource({ success: true, data: created, cashAccount: created }, "postgres", 201);
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: "CREATE_CASH_ACCOUNT_FAILED", message: err.message }, "error", 400);
      }
    }

    // ── Bank Deactivate ──
    const bankDeactivateMatch = path.match(/^(admin\/)?(accounting\/)?bank-accounts\\/([^/]+)\\/deactivate$/);
    if (bankDeactivateMatch) {
      const userCtx = resolveUserContext(req);
      const accountId = bankDeactivateMatch[3];
      try {
        const updated = await BankAccountService.setBankAccountStatus(accountId, "INACTIVE", userCtx);
        return jsonWithDataSource({ success: true, data: updated, bankAccount: updated }, "postgres", 200);
      } catch (err: any) {
        return jsonWithDataSource({ success: false, error: "DEACTIVATE_FAILED", message: err.message }, "error", 400);
      }
    }

    if (path === "admin/bank-accounts" || path === "admin/accounting/bank-accounts" || path === "accounting/bank-accounts") {`;

const normContent = content.replace(/\\r\\n/g, '\\n');
const normTargetGet = targetGet.replace(/\\r\\n/g, '\\n');
const normTargetPost = targetPost.replace(/\\r\\n/g, '\\n');

if (normContent.includes(normTargetGet) && normContent.includes(normTargetPost)) {
  let updated = normContent.replace(normTargetGet, replacementGet);
  updated = updated.replace(normTargetPost, replacementPost);
  fs.writeFileSync(filePath, updated.replace(/\\n/g, '\\r\\n'), 'utf8');
  console.log('Successfully enhanced route.ts with Bank & Cash endpoints!');
} else {
  console.log('Targets not found in route.ts. Checking matches...');
  console.log('TargetGet found?', normContent.includes(normTargetGet));
  console.log('TargetPost found?', normContent.includes(normTargetPost));
}
