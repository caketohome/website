"use client";
import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";

export const RewardsPanel = memo(function RewardsPanel() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminLoyaltyLedgers().then((r: any) => setLedgers(r?.ledgers || r?.data || [])).catch(() => null),
      apiClient.getAdminReferralPrograms().then((r: any) => setPrograms(r?.programs || r?.data || [])).catch(() => null),
      apiClient.getAdminWalletTransactions().then((r: any) => setTransactions(r?.transactions || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div><Heading level="h2" className="text-xl">Rewards & Loyalty</Heading>
        <Text className="text-ui-fg-subtle text-sm">Manage loyalty points, referral programs, and wallet transactions.</Text></div>

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading rewards data...</Text></Container>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Container className="p-5 flex flex-col gap-3">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Loyalty Ledgers</Text>
            <Text className="text-3xl font-bold">{ledgers.length}</Text>
            <Text className="text-xs text-ui-fg-muted">Customer point balances tracked</Text>
            {ledgers.length > 0 && ledgers.slice(0, 3).map((l: any, i: number) => (
              <div key={i} className="text-xs p-2 bg-ui-bg-subtle rounded">
                {l.customer_name || l.customer_id || `Customer #${i + 1}`}: <strong>{l.balance || l.points || 0} pts</strong>
              </div>
            ))}
          </Container>
          <Container className="p-5 flex flex-col gap-3">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Referral Programs</Text>
            <Text className="text-3xl font-bold">{programs.length}</Text>
            <Text className="text-xs text-ui-fg-muted">Active referral campaigns</Text>
            {programs.length > 0 && programs.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="text-xs p-2 bg-ui-bg-subtle rounded flex items-center justify-between">
                <span>{p.name || `Program #${i + 1}`}</span>
                <Badge color={p.is_active ? "green" : "grey"} className="text-[10px]">{p.is_active ? "Active" : "Paused"}</Badge>
              </div>
            ))}
          </Container>
          <Container className="p-5 flex flex-col gap-3">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">Wallet Transactions</Text>
            <Text className="text-3xl font-bold">{transactions.length}</Text>
            <Text className="text-xs text-ui-fg-muted">Recent wallet operations</Text>
            {transactions.length > 0 && transactions.slice(0, 3).map((t: any, i: number) => (
              <div key={i} className="text-xs p-2 bg-ui-bg-subtle rounded flex items-center justify-between">
                <span>{t.type || "credit"}</span>
                <span className="font-semibold">₹{t.amount || 0}</span>
              </div>
            ))}
          </Container>
        </div>
      )}
    </div>
  );
});
