const fs = require('fs');

// 1. Update admin-tabs.tsx
const tabsPath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/admin-tabs.tsx';
let tabsContent = fs.readFileSync(tabsPath, 'utf8');
const targetTab = `{ id: "bank_accounts", label: "Bank Accounts", icon: Landmark },`;
const replaceTab = `{ id: "bank_management", label: "Bank & Cash Management", icon: Landmark },\n  { id: "bank_accounts", label: "Bank Accounts", icon: Landmark },`;

const normTabs = tabsContent.replace(/\r\n/g, '\n');
if (normTabs.includes(targetTab)) {
  const updatedTabs = normTabs.replace(targetTab, replaceTab);
  fs.writeFileSync(tabsPath, updatedTabs.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated admin-tabs.tsx with bank_management tab!');
} else {
  console.log('Target not found in admin-tabs.tsx');
}

// 2. Update dashboard/page.tsx
const pagePath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/app/dashboard/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

const targetImport = `const BankAccountsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bank-accounts-panel"),
  "BankAccountsPanel"
);`;

const replaceImport = `const BankAccountsPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bank-accounts-panel"),
  "BankAccountsPanel"
);
const BankManagementPanel = createDynamicPanel(
  () => import("@frontend/components/dashboard/admin/bank-management-dashboard"),
  "BankManagementDashboard"
);`;

const targetType = `| "gateway_settlements" | "bank_accounts" | "bank_reconciliation"`;
const replaceType = `| "gateway_settlements" | "bank_management" | "bank_accounts" | "bank_reconciliation"`;

const targetPanel = `gateway_settlements: GatewaySettlementPanel,\n  bank_accounts: BankAccountsPanel,`;
const replacePanel = `gateway_settlements: GatewaySettlementPanel,\n  bank_management: BankManagementPanel,\n  bank_accounts: BankManagementPanel,`;

let normPage = pageContent.replace(/\r\n/g, '\n');
if (normPage.includes(targetImport.replace(/\r\n/g, '\n'))) {
  normPage = normPage.replace(targetImport.replace(/\r\n/g, '\n'), replaceImport);
  normPage = normPage.replace(targetType, replaceType);
  normPage = normPage.replace(targetPanel, replacePanel);
  fs.writeFileSync(pagePath, normPage.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated dashboard/page.tsx with BankManagementPanel!');
} else {
  console.log('Target not found in dashboard/page.tsx');
}
