import { Controller, Get, Post, Patch, Param, Body, Query } from "@nestjs/common";
import { AccountingService } from "./accounting.service";

@Controller("api/v1/accounting")
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get("dashboard/summary")
  async getDashboardSummary() {
    return await this.accountingService.getDashboardSummary();
  }

  @Get("bank-accounts")
  async listBankAccounts(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("branchId") branchId?: string
  ) {
    return await this.accountingService.listBankAccounts({ status, search, branchId });
  }

  @Post("bank-accounts")
  async createBankAccount(@Body() body: any) {
    return await this.accountingService.createBankAccount(body);
  }

  @Get("bank-accounts/:id")
  async getBankAccount(@Param("id") id: string) {
    return await this.accountingService.getBankAccount(id);
  }

  @Patch("bank-accounts/:id")
  async updateBankAccount(@Param("id") id: string, @Body() body: any) {
    return await this.accountingService.updateBankAccount(id, body);
  }

  @Post("bank-accounts/:id/deactivate")
  async deactivateBankAccount(@Param("id") id: string) {
    return await this.accountingService.deactivateBankAccount(id);
  }

  @Get("bank-accounts/:id/transactions")
  async getBankTransactions(@Param("id") id: string) {
    return await this.accountingService.getBankTransactions(id);
  }

  @Post("bank-transfers")
  async transferFunds(@Body() body: any) {
    return await this.accountingService.transferFunds(body);
  }

  @Get("cash-accounts")
  async listCashAccounts(@Query("branchId") branchId?: string) {
    return await this.accountingService.listCashAccounts({ branchId });
  }

  @Post("cash-accounts")
  async createCashAccount(@Body() body: any) {
    return await this.accountingService.createCashAccount(body);
  }

  @Get("cashfree-settlements")
  async listCashfreeSettlements() {
    return await this.accountingService.listCashfreeSettlements();
  }

  @Post("reconciliations/import")
  async importBankStatement(@Body() body: any) {
    return await this.accountingService.importBankStatement(body);
  }

  @Post("reconciliations/match")
  async matchReconciliation(@Body() body: any) {
    return await this.accountingService.matchReconciliation(body);
  }

  @Get("reconcile/:orderId")
  async reconcile(@Param("orderId") orderId: string) {
    return await this.accountingService.reconcilePayment(orderId);
  }

  @Get("vouchers")
  async getVouchers() {
    return await this.accountingService.getVouchers();
  }
}
