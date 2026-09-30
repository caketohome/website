import { retrieveUser } from "@frontend/lib/data";
import { ShopManagerDTO } from "@frontend/lib/types";
import { redirect } from "next/navigation";
import ExpensePanel from "@frontend/components/dashboard/admin/expense-panel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Expenses | CakeToHome Admin",
  description: "Expense management, approvals, and reporting",
};

export default async function ExpensesPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;
  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }
  return (
    <div className="p-6">
      <ExpensePanel />
    </div>
  );
}
