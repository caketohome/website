export class ExpenseNotFoundError extends Error {
  public code = "EXPENSE_NOT_FOUND";
  public status = 404;

  constructor(expenseId: string) {
    super(`Expense with ID ${expenseId} not found.`);
    this.name = "ExpenseNotFoundError";
  }
}

export class ExpenseValidationError extends Error {
  public code = "EXPENSE_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ExpenseValidationError";
  }
}

export class FranchiseNotFoundError extends Error {
  public code = "FRANCHISE_NOT_FOUND";
  public status = 404;

  constructor(franchiseId: string) {
    super(`Franchise with ID ${franchiseId} not found.`);
    this.name = "FranchiseNotFoundError";
  }
}

export class FranchiseValidationError extends Error {
  public code = "FRANCHISE_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "FranchiseValidationError";
  }
}

export class AnalyticsValidationError extends Error {
  public code = "ANALYTICS_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "AnalyticsValidationError";
  }
}

export class BranchNotFoundError extends Error {
  public code = "BRANCH_NOT_FOUND";
  public status = 404;

  constructor(branchId: string) {
    super(`Branch with ID ${branchId} not found.`);
    this.name = "BranchNotFoundError";
  }
}
