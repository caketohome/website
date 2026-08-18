import { getWalletBalance, validateGiftCard, redeemGiftCard } from "@frontend/lib/data";
import { Heading, Text, Container, Badge } from "@medusajs/ui";

export default async function AccountWalletPage() {
  const data = await getWalletBalance();

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Heading level="h2">Wallet</Heading>
        <Text className="text-ui-fg-subtle">
          Unable to retrieve your wallet balance. Please try again later.
        </Text>
      </div>
    );
  }

  const { wallet, transactions } = data;

  // Format currency
  const formatCurrency = (amount: number, code: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code || "INR",
    }).format(amount / 100);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center border-b border-ui-border-base pb-4">
        <div>
          <Heading level="h2">Wallet</Heading>
          <Text className="text-ui-fg-subtle">
            Manage your store credits and view recent transactions.
          </Text>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Container className="bg-ui-bg-subtle p-6 flex flex-col gap-2 rounded-lg border border-ui-border-base">
            <Text className="text-ui-fg-subtle text-sm uppercase tracking-wider font-semibold">
              Available Balance
            </Text>
            <Heading level="h1" className="text-4xl font-bold text-ui-fg-base">
              {formatCurrency(wallet.balance, wallet.currency_code)}
            </Heading>
            <Text className="text-xs text-ui-fg-subtle">
              This balance can be applied at checkout to pay for your orders.
            </Text>
          </Container>
        </div>

        <div className="md:col-span-2">
          <Container className="p-6 flex flex-col gap-4">
            <Heading level="h3">Redeem a Gift Card / Voucher</Heading>
            <Text className="text-ui-fg-subtle text-sm">
              Have a gift card voucher code? Enter it below to add the amount to your wallet balance.
            </Text>
            
            {/* Server action / client form can call redeemGiftCard */}
            <form action={async (formData: FormData) => {
              "use server";
              const code = formData.get("voucher_code") as string;
              if (!code) return;
              try {
                const check = await validateGiftCard(code);
                if (check && check.valid) {
                  await redeemGiftCard(code);
                  // Refresh page
                }
              } catch (e) {
                console.error("Redemption failed:", e);
              }
            }} className="flex gap-2">
              <input
                type="text"
                name="voucher_code"
                placeholder="Enter Code (e.g. GC-XXXX-XXXX)"
                className="flex-1 px-3 py-2 border border-ui-border-base rounded bg-ui-bg-field text-sm"
                required
              />
              <button
                type="submit"
                className="bg-ui-bg-interactive text-ui-fg-on-color px-4 py-2 rounded text-sm hover:bg-ui-bg-interactive-hover font-medium transition"
              >
                Add Credit
              </button>
            </form>
          </Container>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Heading level="h3">Transaction History</Heading>
        {transactions.length === 0 ? (
          <Container className="p-8 text-center text-ui-fg-subtle">
            No transactions found. Your wallet history will be displayed here.
          </Container>
        ) : (
          <div className="overflow-x-auto border border-ui-border-base rounded-lg">
            <table className="min-w-full divide-y divide-ui-border-base text-left text-sm">
              <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Transaction ID</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base bg-ui-bg-base">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-ui-bg-subtle-hover transition">
                    <td className="px-4 py-3 font-mono text-xs text-ui-fg-subtle">
                      {tx.id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={tx.type === "credit" ? "green" : "red"}>
                        {tx.type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "credit" ? "+" : "-"} {formatCurrency(tx.amount, wallet.currency_code)}
                    </td>
                    <td className="px-4 py-3 text-ui-fg-subtle">
                      {tx.description || "No description provided"}
                    </td>
                    <td className="px-4 py-3 text-ui-fg-subtle text-xs">
                      {new Date(tx.created_at).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
