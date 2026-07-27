import { getLoyaltyLedger, redeemLoyaltyPoints } from "@frontend/lib/data";
import { Heading, Text, Container, Badge } from "@medusajs/ui";
import { revalidatePath } from "next/cache";

export default async function AccountLoyaltyPage() {
  const data = await getLoyaltyLedger();

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Heading level="h2">Loyalty Rewards</Heading>
        <Text className="text-ui-fg-subtle">
          Unable to retrieve your loyalty rewards portfolio. Please try again later.
        </Text>
      </div>
    );
  }

  const { ledger, transactions } = data;

  // Calculate tier details
  const getTierDetails = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "silver":
        return { name: "Silver", color: "grey" as const, nextMin: 5000, nextName: "Gold" };
      case "gold":
        return { name: "Gold", color: "orange" as const, nextMin: 10000, nextName: "Platinum" };
      case "platinum":
        return { name: "Platinum", color: "purple" as const, nextMin: null, nextName: "" };
      default:
        return { name: "Bronze", color: "green" as const, nextMin: 1000, nextName: "Silver" };
    }
  };

  const tierInfo = getTierDetails(ledger.tier);
  const progressPercent = tierInfo.nextMin
    ? Math.min(100, Math.round((ledger.lifetime_points / tierInfo.nextMin) * 100))
    : 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center border-b border-ui-border-base pb-4">
        <div>
          <Heading level="h2">Loyalty Program</Heading>
          <Text className="text-ui-fg-subtle">
            Earn points on purchases and unlock premium tiers.
          </Text>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-4">
          <Container className="p-6 flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            <div className="flex justify-between items-center">
              <Text className="text-ui-fg-subtle text-sm uppercase tracking-wider font-semibold">
                Tier Status
              </Text>
              <Badge color={tierInfo.color}>{tierInfo.name.toUpperCase()}</Badge>
            </div>
            
            <div className="flex flex-col gap-1">
              <Text className="text-xs text-ui-fg-subtle">Active Points</Text>
              <Heading level="h1" className="text-4xl font-bold text-ui-fg-base">
                {ledger.points} <span className="text-lg font-normal text-ui-fg-subtle">pts</span>
              </Heading>
            </div>

            <div className="flex flex-col gap-1">
              <Text className="text-xs text-ui-fg-subtle">Lifetime Points</Text>
              <Heading level="h3" className="text-xl font-bold text-ui-fg-base">
                {ledger.lifetime_points} <span className="text-sm font-normal text-ui-fg-subtle">pts</span>
              </Heading>
            </div>
          </Container>
        </div>

        <div className="md:col-span-2">
          <Container className="p-6 flex flex-col gap-4">
            <Heading level="h3">Progress to next tier</Heading>
            {tierInfo.nextMin ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs text-ui-fg-subtle">
                  <span>{ledger.lifetime_points} / {tierInfo.nextMin} pts</span>
                  <span>{tierInfo.nextName} Tier</span>
                </div>
                <div className="w-full bg-ui-bg-field rounded-full h-3 overflow-hidden border border-ui-border-base">
                  <div
                    className="bg-ui-bg-interactive h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <Text className="text-xs text-ui-fg-subtle mt-1">
                  Earn {tierInfo.nextMin - ledger.lifetime_points} more points to reach the {tierInfo.nextName} tier!
                </Text>
              </div>
            ) : (
              <Text className="text-sm text-green-600 font-semibold">
                Congratulations! You are at the highest Platinum tier. Enjoy exclusive benefits!
              </Text>
            )}

            <hr className="border-ui-border-base my-2" />

            <Heading level="h3">Redeem Points</Heading>
            <Text className="text-ui-fg-subtle text-sm">
              Convert your active points into store credit. E.g. 100 points = ₹10.00.
            </Text>
            <form action={async (formData: FormData) => {
              "use server";
              const ptsStr = formData.get("points") as string;
              if (!ptsStr) return;
              const pointsVal = parseInt(ptsStr, 10);
              if (isNaN(pointsVal) || pointsVal <= 0) return;
              try {
                await redeemLoyaltyPoints(pointsVal, `red-${Date.now()}`);
                revalidatePath("/account/loyalty");
              } catch (e) {
                console.error("Points redemption failed:", e);
              }
            }} className="flex gap-2">
              <input
                type="number"
                name="points"
                min="100"
                step="100"
                placeholder="Points count (e.g. 500)"
                className="flex-1 px-3 py-2 border border-ui-border-base rounded bg-ui-bg-field text-sm"
                required
              />
              <button
                type="submit"
                className="bg-ui-bg-interactive text-ui-fg-on-color px-4 py-2 rounded text-sm hover:bg-ui-bg-interactive-hover font-medium transition"
              >
                Redeem Points
              </button>
            </form>
          </Container>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Heading level="h3">Points Activity History</Heading>
        {transactions.length === 0 ? (
          <Container className="p-8 text-center text-ui-fg-subtle">
            No points activities registered yet. Points logs will appear here.
          </Container>
        ) : (
          <div className="overflow-x-auto border border-ui-border-base rounded-lg">
            <table className="min-w-full divide-y divide-ui-border-base text-left text-sm">
              <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Transaction ID</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Points Change</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
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
                      <Badge color={tx.transaction_type === "earn" || tx.transaction_type === "adjustment" && tx.points > 0 ? "green" : "red"}>
                        {tx.transaction_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${tx.points > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.points > 0 ? "+" : ""}{tx.points} pts
                    </td>
                    <td className="px-4 py-3 text-ui-fg-subtle">
                      {tx.description || "No details provided"}
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
