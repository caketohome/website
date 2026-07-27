import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useState, useEffect } from "react";
import {
  Container,
  Heading,
  Input,
  Label,
  Button,
  Text,
  Select,
  Textarea,
  Badge,
  Table,
} from "@medusajs/ui";
import { Coins } from "lucide-react";
import React from "react";

const RewardsIcon: React.ForwardRefExoticComponent<
  React.RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props, ref) => (
  <Coins ref={ref} size={16} {...props} />
));

const RewardsAdminPage = () => {
  const [activeTab, setActiveTab] = useState<"timeline" | "wallets" | "loyalty" | "giftcards" | "referrals" | "customer360">("timeline");

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ui-border-base pb-4">
        <div>
          <Heading level="h1">Rewards & Campaigns Suite</Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Administer customer wallets, loyalty points, rules, gift vouchers, referral campaigns, and fraud review gates.
          </Text>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-ui-border-base gap-2 overflow-x-auto pb-1">
        {[
          { id: "timeline", label: "Unified Timeline" },
          { id: "wallets", label: "Wallets" },
          { id: "loyalty", label: "Loyalty Program" },
          { id: "giftcards", label: "Gift Cards" },
          { id: "referrals", label: "Referrals & Fraud" },
          { id: "customer360", label: "Customer 360 View" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-ui-border-interactive text-ui-fg-interactive bg-ui-bg-subtle-hover"
                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="w-full">
        {activeTab === "timeline" && <TimelinePanel />}
        {activeTab === "wallets" && <WalletsPanel />}
        {activeTab === "loyalty" && <LoyaltyPanel />}
        {activeTab === "giftcards" && <GiftCardsPanel />}
        {activeTab === "referrals" && <ReferralsPanel />}
        {activeTab === "customer360" && <Customer360Panel />}
      </div>
    </div>
  );
};

// ── Tab 1: Unified Chronological Timeline ────────────────────────────────────

function TimelinePanel() {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/rewards/timeline");
      const data = await res.json();
      setTimeline(data.timeline || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, []);

  const filteredTimeline = filterType
    ? timeline.filter((item) => item.type === filterType)
    : timeline;

  const handleExportCSV = () => {
    const headers = ["ID", "Type", "Title", "Description", "Timestamp", "Customer ID"];
    const rows = filteredTimeline.map((item) => [
      item.id,
      item.type,
      item.title,
      item.description,
      new Date(item.timestamp).toLocaleString(),
      item.customer_id || "N/A",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rewards_timeline_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Container className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading level="h2">Chronological Rewards Audit Log</Heading>
          <Text className="text-xs text-ui-fg-subtle">
            Audit logs tracking adjustments, credit conversions, referrals, and fraud.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <Select.Trigger className="w-40">
              <Select.Value placeholder="Filter type" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All Types</Select.Item>
              <Select.Item value="wallet">Wallet</Select.Item>
              <Select.Item value="loyalty">Loyalty</Select.Item>
              <Select.Item value="referral">Referral</Select.Item>
              <Select.Item value="fraud">Fraud Gate</Select.Item>
            </Select.Content>
          </Select>
          <Button variant="secondary" onClick={handleExportCSV}>Export CSV</Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center animate-pulse text-ui-fg-subtle">Loading chronological audit logs...</div>
      ) : filteredTimeline.length === 0 ? (
        <div className="p-12 text-center text-ui-fg-subtle italic border border-dashed rounded-lg">
          No audit log matches found.
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-l-2 border-ui-border-base pl-6 ml-4">
          {filteredTimeline.map((item) => {
            const badgeColors: Record<string, string> = {
              wallet: "green",
              loyalty: "blue",
              referral: "purple",
              fraud: "red",
            };
            return (
              <div key={item.id} className="relative flex flex-col gap-1 bg-ui-bg-subtle p-4 rounded-lg border">
                <span className="absolute -left-9 top-6 w-4 h-4 bg-ui-bg-interactive rounded-full border-2 border-ui-bg-base" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ui-fg-base">{item.title}</span>
                    <Badge color={badgeColors[item.type] as any}>{item.type.toUpperCase()}</Badge>
                  </div>
                  <span className="text-xs text-ui-fg-subtle">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                <Text className="text-sm text-ui-fg-subtle">{item.description}</Text>
                {item.customer_id && (
                  <span className="text-xs text-ui-fg-muted font-mono">Customer ID: {item.customer_id}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}

// ── Tab 2: Wallets Management Panel ──────────────────────────────────────────

function WalletsPanel() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustDesc, setAdjustDesc] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const loadWallets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/rewards/wallets");
      const data = await res.json();
      setWallets(data.wallets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt === 0) return;

    try {
      const res = await fetch(`/admin/rewards/wallets/${selectedWallet.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amt * 100), // convert to cents
          description: adjustDesc || "Administrative adjustments",
        }),
      });
      if (res.ok) {
        setMessage("Wallet adjusted successfully!");
        setAdjustAmount("");
        setAdjustDesc("");
        setSelectedWallet(null);
        loadWallets();
      } else {
        const data = await res.json();
        setMessage(`Adjustment failed: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Adjustment failed: ${err.message}`);
    }
  };

  return (
    <Container className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading level="h2">Customer Wallets</Heading>
          <Text className="text-xs text-ui-fg-subtle">
            Manage store credits, view balances, and apply overrides.
          </Text>
        </div>
      </div>

      {message && <Badge color="orange" className="p-2 justify-center">{message}</Badge>}

      {selectedWallet && (
        <div className="bg-ui-bg-subtle p-6 rounded-lg border border-ui-border-base flex flex-col gap-4">
          <Heading level="h3">Adjust Balance for Wallet ID: {selectedWallet.id}</Heading>
          <form onSubmit={handleAdjust} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-xs font-semibold">Amount (Positive to Credit, Negative to Debit)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 50.00 or -20.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Adjustment Notes / Reason</Label>
              <Input
                placeholder="Reason description"
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Submit Override</Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedWallet(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center animate-pulse text-ui-fg-subtle">Loading wallets...</div>
      ) : wallets.length === 0 ? (
        <div className="p-12 text-center text-ui-fg-subtle italic border border-dashed rounded-lg">
          No customer wallets exist.
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Wallet ID</Table.HeaderCell>
              <Table.HeaderCell>Customer ID</Table.HeaderCell>
              <Table.HeaderCell>Available Balance</Table.HeaderCell>
              <Table.HeaderCell>Currency</Table.HeaderCell>
              <Table.HeaderCell>Created At</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {wallets.map((wallet) => (
              <Table.Row key={wallet.id}>
                <Table.Cell className="font-mono text-xs">{wallet.id}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{wallet.customer_id}</Table.Cell>
                <Table.Cell className="font-semibold">
                  {(wallet.balance / 100).toFixed(2)}
                </Table.Cell>
                <Table.Cell className="uppercase">{wallet.currency_code}</Table.Cell>
                <Table.Cell className="text-xs">{new Date(wallet.created_at).toLocaleDateString()}</Table.Cell>
                <Table.Cell>
                  <Button variant="secondary" size="small" onClick={() => setSelectedWallet(wallet)}>
                    Adjust Balance
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
}

// ── Tab 3: Loyalty Program Panel ─────────────────────────────────────────────

function LoyaltyPanel() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<any>(null);
  const [adjustPoints, setAdjustPoints] = useState<string>("");
  const [adjustDesc, setAdjustDesc] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const loadLoyalty = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/rewards/loyalty/ledgers");
      const data = await res.json();
      setLedgers(data.ledgers || []);

      const rulesRes = await fetch("/admin/rewards/loyalty/rules");
      const rulesData = await rulesRes.json();
      setRules(rulesData.rules || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoyalty();
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedger) return;
    const pts = parseInt(adjustPoints, 10);
    if (isNaN(pts) || pts === 0) return;

    try {
      const res = await fetch("/admin/rewards/loyalty/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedLedger.customer_id,
          points: pts,
          description: adjustDesc || "Administrative adjustments",
        }),
      });
      if (res.ok) {
        setMessage("Points adjusted successfully!");
        setAdjustPoints("");
        setAdjustDesc("");
        setSelectedLedger(null);
        loadLoyalty();
      } else {
        const data = await res.json();
        setMessage(`Adjustment failed: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Adjustment failed: ${err.message}`);
    }
  };

  return (
    <Container className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading level="h2">Loyalty Ledgers</Heading>
          <Text className="text-xs text-ui-fg-subtle">
            Manage points, customer tiers, and earn rules.
          </Text>
        </div>
      </div>

      {message && <Badge color="orange" className="p-2 justify-center">{message}</Badge>}

      {selectedLedger && (
        <div className="bg-ui-bg-subtle p-6 rounded-lg border border-ui-border-base flex flex-col gap-4">
          <Heading level="h3">Adjust Loyalty Points for Customer: {selectedLedger.customer_id}</Heading>
          <form onSubmit={handleAdjust} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-xs font-semibold">Points (Positive to Add, Negative to Deduct)</Label>
              <Input
                type="number"
                placeholder="e.g. 500 or -200"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Adjustment Notes / Reason</Label>
              <Input
                placeholder="Reason description"
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Submit Override</Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedLedger(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center animate-pulse text-ui-fg-subtle">Loading loyalty logs...</div>
      ) : ledgers.length === 0 ? (
        <div className="p-12 text-center text-ui-fg-subtle italic border border-dashed rounded-lg">
          No customer loyalty accounts exist.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Ledger ID</Table.HeaderCell>
                <Table.HeaderCell>Customer ID</Table.HeaderCell>
                <Table.HeaderCell>Current Points</Table.HeaderCell>
                <Table.HeaderCell>Lifetime Points</Table.HeaderCell>
                <Table.HeaderCell>Tier</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {ledgers.map((ledg) => (
                <Table.Row key={ledg.id}>
                  <Table.Cell className="font-mono text-xs">{ledg.id}</Table.Cell>
                  <Table.Cell className="font-mono text-xs">{ledg.customer_id}</Table.Cell>
                  <Table.Cell className="font-bold text-green-600">{ledg.points}</Table.Cell>
                  <Table.Cell className="font-semibold text-ui-fg-subtle">{ledg.lifetime_points}</Table.Cell>
                  <Table.Cell>
                    <Badge color={ledg.tier === "platinum" ? "purple" : ledg.tier === "gold" ? "orange" : ledg.tier === "silver" ? "blue" : "green"}>
                      {ledg.tier.toUpperCase()}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Button variant="secondary" size="small" onClick={() => setSelectedLedger(ledg)}>
                      Adjust Points
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          <div>
            <Heading level="h3" className="mb-2">Accumulation Rules</Heading>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Rule ID</Table.HeaderCell>
                  <Table.HeaderCell>Campaign Title</Table.HeaderCell>
                  <Table.HeaderCell>Min Spent</Table.HeaderCell>
                  <Table.HeaderCell>Points Awarded</Table.HeaderCell>
                  <Table.HeaderCell>Ratio Spend</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rules.map((rule) => (
                  <Table.Row key={rule.id}>
                    <Table.Cell className="font-mono text-xs">{rule.id}</Table.Cell>
                    <Table.Cell className="font-semibold">{rule.name}</Table.Cell>
                    <Table.Cell>₹{rule.min_spent || 0}</Table.Cell>
                    <Table.Cell className="font-bold">{rule.fixed_points || 0}</Table.Cell>
                    <Table.Cell>{rule.ratio_spend_points ? `${rule.ratio_spend_points} pts per ₹1 spent` : "N/A"}</Table.Cell>
                    <Table.Cell>
                      <Badge color={rule.is_active ? "green" : "grey"}>
                        {rule.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}
    </Container>
  );
}

// ── Tab 4: Gift Cards Management Panel ───────────────────────────────────────

function GiftCardsPanel() {
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkCount, setBulkCount] = useState("5");
  const [bulkAmount, setBulkAmount] = useState("500");
  const [bulkPrefix, setBulkPrefix] = useState("GC-");
  const [message, setMessage] = useState<string>("");

  const loadGiftCards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/rewards/gift-cards");
      const data = await res.json();
      setGiftCards(data.gift_cards || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGiftCards();
  }, []);

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/admin/rewards/gift-cards/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: parseInt(bulkCount, 10),
          amount: parseFloat(bulkAmount),
          prefix: bulkPrefix || "GC-",
        }),
      });
      if (res.ok) {
        setMessage(`Successfully generated ${bulkCount} gift cards!`);
        loadGiftCards();
      } else {
        const data = await res.json();
        setMessage(`Bulk generation failed: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Bulk generation failed: ${err.message}`);
    }
  };

  const handleToggleStatus = async (cardId: string, active: boolean) => {
    try {
      const endpoint = active ? "activate" : "disable";
      const res = await fetch(`/admin/rewards/gift-cards/${cardId}/${endpoint}`, {
        method: "POST",
      });
      if (res.ok) {
        loadGiftCards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Container className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading level="h2">Gift Cards & Voucher Ledgers</Heading>
          <Text className="text-xs text-ui-fg-subtle">
            Generate and deactivate store vouchers.
          </Text>
        </div>
      </div>

      {message && <Badge color="orange" className="p-2 justify-center">{message}</Badge>}

      <div className="bg-ui-bg-subtle p-6 rounded-lg border border-ui-border-base flex flex-col gap-4">
        <Heading level="h3">Bulk Voucher Alphanumeric Generator</Heading>
        <form onSubmit={handleBulkGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-xs font-semibold">Count of Vouchers</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={bulkCount}
              onChange={(e) => setBulkCount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Voucher Value (INR)</Label>
            <Input
              type="number"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Voucher Code Prefix</Label>
            <Input
              placeholder="e.g. BDAY-"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
            />
          </div>
          <div>
            <Button type="submit" className="w-full">Generate Vouchers</Button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="p-12 text-center animate-pulse text-ui-fg-subtle">Loading gift cards...</div>
      ) : giftCards.length === 0 ? (
        <div className="p-12 text-center text-ui-fg-subtle italic border border-dashed rounded-lg">
          No gift cards exist.
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Code</Table.HeaderCell>
              <Table.HeaderCell>Initial Val</Table.HeaderCell>
              <Table.HeaderCell>Remaining Balance</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Expiry</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {giftCards.map((card) => (
              <Table.Row key={card.id}>
                <Table.Cell className="font-mono text-sm font-bold tracking-wider">{card.code}</Table.Cell>
                <Table.Cell>₹{card.initial_balance}</Table.Cell>
                <Table.Cell className="font-semibold text-green-600">₹{card.current_balance}</Table.Cell>
                <Table.Cell>
                  <Badge color={card.status === "active" ? "green" : "red"}>
                    {card.status.toUpperCase()}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-xs text-ui-fg-subtle">
                  {card.expires_at ? new Date(card.expires_at).toLocaleDateString() : "Never"}
                </Table.Cell>
                <Table.Cell>
                  {card.status === "active" ? (
                    <Button variant="secondary" size="small" onClick={() => handleToggleStatus(card.id, false)}>
                      Disable Card
                    </Button>
                  ) : (
                    <Button variant="secondary" size="small" onClick={() => handleToggleStatus(card.id, true)}>
                      Activate Card
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
}

// ── Tab 5: Referrals & Fraud Reviews ─────────────────────────────────────────

function ReferralsPanel() {
  const [fraudReviews, setFraudReviews] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/rewards/referrals/fraud");
      const data = await res.json();
      setFraudReviews(data.reviews || []);

      const campRes = await fetch("/admin/rewards/referrals/programs");
      const campData = await campRes.json();
      setCampaigns(campData.programs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const handleResolveFraud = async (reviewId: string, approve: boolean) => {
    try {
      const res = await fetch("/admin/rewards/referrals/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          resolution: approve ? "approved" : "rejected",
          notes: approve ? "Manually overrides indicators" : "Decline suspicious signups",
        }),
      });
      if (res.ok) {
        setMessage(`Fraud review ${approve ? "approved" : "rejected"} successfully.`);
        loadReferrals();
      } else {
        const data = await res.json();
        setMessage(`Resolution failed: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Resolution failed: ${err.message}`);
    }
  };

  return (
    <Container className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading level="h2">Campaign & Fraud Review gates</Heading>
          <Text className="text-xs text-ui-fg-subtle">
            Verify referee signups, resolve flags, and configure campaigns.
          </Text>
        </div>
      </div>

      {message && <Badge color="orange" className="p-2 justify-center">{message}</Badge>}

      <div>
        <Heading level="h3" className="mb-2">Referral Campaigns</Heading>
        {campaigns.length === 0 ? (
          <div className="p-6 text-center text-ui-fg-subtle border border-dashed rounded-lg">No active campaigns.</div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Campaign Title</Table.HeaderCell>
                <Table.HeaderCell>Reward Type</Table.HeaderCell>
                <Table.HeaderCell>Reward Value</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {campaigns.map((camp) => (
                <Table.Row key={camp.id}>
                  <Table.Cell className="font-semibold">{camp.name}</Table.Cell>
                  <Table.Cell className="uppercase font-mono text-xs">{camp.reward_type}</Table.Cell>
                  <Table.Cell className="font-bold text-green-600">{camp.reward_value}</Table.Cell>
                  <Table.Cell>
                    <Badge color={camp.status === "active" ? "green" : "grey"}>
                      {camp.status.toUpperCase()}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <div className="border-t pt-4">
        <Heading level="h3" className="mb-2">Fraud Review Queue</Heading>
        {loading ? (
          <div className="p-12 text-center animate-pulse text-ui-fg-subtle">Loading review queue...</div>
        ) : fraudReviews.length === 0 ? (
          <div className="p-12 text-center text-ui-fg-subtle italic border border-dashed rounded-lg">
            Fraud queue is empty. All referee conversions cleared.
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Review ID</Table.HeaderCell>
                <Table.HeaderCell>Referral Event ID</Table.HeaderCell>
                <Table.HeaderCell>Indicators</Table.HeaderCell>
                <Table.HeaderCell>Flag Status</Table.HeaderCell>
                <Table.HeaderCell>Review Date</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fraudReviews.map((review) => (
                <Table.Row key={review.id}>
                  <Table.Cell className="font-mono text-xs">{review.id}</Table.Cell>
                  <Table.Cell className="font-mono text-xs">{review.referral_event_id}</Table.Cell>
                  <Table.Cell className="text-red-600 font-semibold">{review.fraud_indicator}</Table.Cell>
                  <Table.Cell>
                    <Badge color={review.resolution_status === "approved" ? "green" : review.resolution_status === "rejected" ? "red" : "orange"}>
                      {review.resolution_status.toUpperCase()}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-xs">{new Date(review.created_at).toLocaleDateString()}</Table.Cell>
                  <Table.Cell>
                    {review.resolution_status === "pending" && (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="small" onClick={() => handleToggleFraud(review.id, true)}>
                          Approve Referral
                        </Button>
                        <Button variant="danger" size="small" onClick={() => handleToggleFraud(review.id, false)}>
                          Decline Fraud
                        </Button>
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  );

  async function handleToggleFraud(reviewId: string, approve: boolean) {
    await handleResolveFraud(reviewId, approve);
  }
}

// ── Tab 6: Customer 360 View Panel ───────────────────────────────────────────

function Customer360Panel() {
  const [customerId, setCustomerId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    setLoading(true);
    setMessage("");
    setData(null);
    try {
      const res = await fetch(`/admin/rewards/customers/${customerId}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.summary);
      } else {
        setMessage("Customer rewards profile not found.");
      }
    } catch (err: any) {
      setMessage(`Retrieval failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="p-6 flex flex-col gap-6">
      <Heading level="h2">Customer Rewards 360 Profile</Heading>
      <Text className="text-xs text-ui-fg-subtle">
        Search for any Customer ID to view their unified portfolio and timeline history.
      </Text>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Enter Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
          className="flex-1 font-mono"
        />
        <Button type="submit">Query Profile</Button>
      </form>

      {message && <Badge color="red" className="p-2 justify-center">{message}</Badge>}
      {loading && <div className="p-12 text-center animate-pulse text-ui-fg-subtle">Compiling customer rewards profile...</div>}

      {data && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Container className="p-6 bg-ui-bg-subtle border flex flex-col gap-1 rounded-lg">
              <Text className="text-xs text-ui-fg-subtle font-bold">Wallet Balance</Text>
              <Heading level="h1" className="text-3xl text-green-600 font-bold">
                {data.wallet ? `₹${(data.wallet.balance / 100).toFixed(2)}` : "₹0.00"}
              </Heading>
            </Container>

            <Container className="p-6 bg-ui-bg-subtle border flex flex-col gap-1 rounded-lg">
              <Text className="text-xs text-ui-fg-subtle font-bold">Loyalty Points & Tier</Text>
              <div className="flex items-center justify-between mt-1">
                <Heading level="h1" className="text-3xl font-bold">
                  {data.loyalty ? data.loyalty.points : "0"} <span className="text-sm font-normal text-ui-fg-subtle">pts</span>
                </Heading>
                {data.loyalty && (
                  <Badge color={data.loyalty.tier === "platinum" ? "purple" : data.loyalty.tier === "gold" ? "orange" : data.loyalty.tier === "silver" ? "blue" : "green"}>
                    {data.loyalty.tier.toUpperCase()}
                  </Badge>
                )}
              </div>
            </Container>

            <Container className="p-6 bg-ui-bg-subtle border flex flex-col gap-1 rounded-lg">
              <Text className="text-xs text-ui-fg-subtle font-bold">Active Referral Code</Text>
              <Heading level="h1" className="text-xl font-bold tracking-widest font-mono text-ui-fg-base mt-2">
                {data.referral?.code ? data.referral.code.code : "N/A"}
              </Heading>
              <Text className="text-xs text-ui-fg-subtle mt-1">
                Clicks: {data.referral?.stats?.clicks} | Conversions: {data.referral?.stats?.signups}
              </Text>
            </Container>
          </div>

          <div>
            <Heading level="h3" className="mb-2">Unified Customer Audit Timeline</Heading>
            {data.timeline.length === 0 ? (
              <div className="p-6 text-center text-ui-fg-subtle border border-dashed rounded-lg">Timeline is empty.</div>
            ) : (
              <div className="flex flex-col gap-3 border-l pl-4 ml-2">
                {data.timeline.map((entry: any) => (
                  <div key={entry.id} className="relative flex flex-col p-3 bg-ui-bg-subtle border rounded">
                    <span className="absolute -left-6 top-5 w-3 h-3 bg-ui-bg-interactive rounded-full" />
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{entry.title}</span>
                      <span className="text-ui-fg-subtle">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <Text className="text-xs text-ui-fg-subtle mt-1">{entry.description}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}

export const config = defineRouteConfig({
  label: "Rewards Management",
  icon: RewardsIcon,
});

export default RewardsAdminPage;
