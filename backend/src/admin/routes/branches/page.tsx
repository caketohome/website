import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, StatusBadge, Badge, Table, Text, Tabs, Button, Input } from "@medusajs/ui";
import { useState } from "react";
import { StoreIcon } from "../../components/icons";
import {
  useBranches,
  useCities,
  useRegions,
  useBranchStaff,
  useBranchInventory,
  useBranchPricing,
  useTransfers,
} from "../../hooks/use-branches";

const BranchesDashboard = () => {
  const { data: branchesData, loading: branchesLoading, refetch: refetchBranches } = useBranches();
  const { data: citiesData, refetch: refetchCities } = useCities();
  const { data: regionsData, refetch: refetchRegions } = useRegions();
  const { data: transfersData, refetch: refetchTransfers } = useTransfers();

  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  
  const { data: staffData, refetch: refetchStaff } = useBranchStaff(activeBranchId);
  const { data: inventoryData, refetch: refetchInventory } = useBranchInventory(activeBranchId);
  const { data: pricingData, refetch: refetchPricing } = useBranchPricing(activeBranchId);

  // Form states for creating branch
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    address: "",
    latitude: 0,
    longitude: 0,
    shop_id: "res_1", // Default mock shop
  });

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBranch),
      });
      if (response.ok) {
        setShowCreateBranch(false);
        setNewBranch({
          name: "",
          code: "",
          phone: "",
          email: "",
          address: "",
          latitude: 0,
          longitude: 0,
          shop_id: "res_1",
        });
        refetchBranches();
      } else {
        const error = await response.json();
        alert(`Failed to create branch: ${error.message}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Container className="flex flex-col p-6 gap-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <Heading level="h1" className="text-2xl font-bold">Multi-Branch Management</Heading>
          <Text className="text-ui-fg-subtle text-xs mt-1">Manage physical outlets, stock levels, localized pricing, and staff roles.</Text>
        </div>
        <Button variant="primary" onClick={() => setShowCreateBranch(!showCreateBranch)}>
          {showCreateBranch ? "View Branches" : "Create Branch"}
        </Button>
      </div>

      {showCreateBranch ? (
        <form onSubmit={handleCreateBranch} className="bg-ui-bg-subtle p-6 rounded-xl border flex flex-col gap-4 max-w-xl">
          <Heading level="h2" className="text-lg font-bold">New Branch Details</Heading>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ui-fg-muted">Branch Name</label>
              <Input
                value={newBranch.name}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                placeholder="e.g. Connaught Place"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ui-fg-muted">Unique Branch Code</label>
              <Input
                value={newBranch.code}
                onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
                placeholder="e.g. BR-DEL-01"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ui-fg-muted">Phone Number</label>
              <Input
                value={newBranch.phone}
                onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ui-fg-muted">Contact Email</label>
              <Input
                type="email"
                value={newBranch.email}
                onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                placeholder="e.g. delhicp@caketohome.com"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-ui-fg-muted">Physical Address</label>
            <Input
              value={newBranch.address}
              onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
              placeholder="Full address of the branch"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ui-fg-muted">Latitude</label>
              <Input
                type="number"
                step="any"
                value={newBranch.latitude || ""}
                onChange={(e) => setNewBranch({ ...newBranch, latitude: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 28.6304"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ui-fg-muted">Longitude</label>
              <Input
                type="number"
                step="any"
                value={newBranch.longitude || ""}
                onChange={(e) => setNewBranch({ ...newBranch, longitude: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 77.2177"
                required
              />
            </div>
          </div>

          <Button type="submit" variant="primary" className="mt-2">Create</Button>
        </form>
      ) : (
        <Tabs defaultValue="branches">
          <Tabs.List>
            <Tabs.Trigger value="branches">Branches</Tabs.Trigger>
            <Tabs.Trigger value="staff">Staff</Tabs.Trigger>
            <Tabs.Trigger value="inventory">Inventory & Pricing</Tabs.Trigger>
            <Tabs.Trigger value="transfers">Stock Transfers</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="branches" className="pt-4">
            {branchesLoading && <Text>Loading...</Text>}
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Code</Table.HeaderCell>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>City</Table.HeaderCell>
                  <Table.HeaderCell>Coordinates</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Contact</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              {branchesData?.branches && (
                <Table.Body>
                  {branchesData.branches.map((branch) => (
                    <Table.Row key={branch.id}>
                      <Table.Cell className="font-mono text-xs">{branch.code}</Table.Cell>
                      <Table.Cell className="font-semibold">{branch.name}</Table.Cell>
                      <Table.Cell>{branch.city?.name || "N/A"}</Table.Cell>
                      <Table.Cell className="text-xs text-ui-fg-muted">{branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={branch.is_open ? "green" : "red"}>
                          {branch.is_open ? "Open" : "Closed"}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell className="text-xs">
                        <div>{branch.phone}</div>
                        <div className="text-ui-fg-muted">{branch.email}</div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              )}
            </Table>
          </Tabs.Content>

          <Tabs.Content value="staff" className="pt-4 flex flex-col gap-4">
            <div className="flex gap-4 items-center bg-ui-bg-subtle p-4 rounded-xl border">
              <label className="text-sm font-bold text-ui-fg-muted">Select Branch:</label>
              <select
                value={activeBranchId || ""}
                onChange={(e) => setActiveBranchId(e.target.value || null)}
                className="border rounded p-2 text-sm bg-ui-bg-base"
              >
                <option value="">-- Choose Branch --</option>
                {branchesData?.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {activeBranchId ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Email</Table.HeaderCell>
                    <Table.HeaderCell>Role</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {staffData?.staff && staffData.staff.map((member) => (
                    <Table.Row key={member.id}>
                      <Table.Cell className="font-semibold">{member.first_name} {member.last_name}</Table.Cell>
                      <Table.Cell>{member.email}</Table.Cell>
                      <Table.Cell>
                        <Badge color="blue">{member.role}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={member.is_active ? "green" : "red"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {(!staffData?.staff || staffData.staff.length === 0) && (
                    <Table.Row>
                      <Table.Cell {...({ colSpan: 4 } as any)} className="text-center text-ui-fg-muted py-6">
                        No staff members assigned to this branch yet.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            ) : (
              <Text className="text-ui-fg-muted text-center py-6">Please select a branch to view its staff directory.</Text>
            )}
          </Tabs.Content>

          <Tabs.Content value="inventory" className="pt-4 flex flex-col gap-4">
            <div className="flex gap-4 items-center bg-ui-bg-subtle p-4 rounded-xl border">
              <label className="text-sm font-bold text-ui-fg-muted">Select Branch:</label>
              <select
                value={activeBranchId || ""}
                onChange={(e) => setActiveBranchId(e.target.value || null)}
                className="border rounded p-2 text-sm bg-ui-bg-base"
              >
                <option value="">-- Choose Branch --</option>
                {branchesData?.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {activeBranchId ? (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Heading level="h3" className="text-sm font-bold mb-2">Inventory Stock</Heading>
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Variant ID</Table.HeaderCell>
                        <Table.HeaderCell>In Stock</Table.HeaderCell>
                        <Table.HeaderCell>Reserved</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {inventoryData?.inventories && inventoryData.inventories.map((inv) => (
                        <Table.Row key={inv.id}>
                          <Table.Cell className="font-mono text-xs">{inv.variant_id}</Table.Cell>
                          <Table.Cell className="font-semibold">{inv.quantity}</Table.Cell>
                          <Table.Cell className="text-ui-fg-muted">{inv.reserved}</Table.Cell>
                        </Table.Row>
                      ))}
                      {(!inventoryData?.inventories || inventoryData.inventories.length === 0) && (
                        <Table.Row>
                          <Table.Cell {...({ colSpan: 3 } as any)} className="text-center text-ui-fg-muted py-6">
                            No branch stock levels defined.
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                </div>
                <div>
                  <Heading level="h3" className="text-sm font-bold mb-2">Price Overrides</Heading>
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Variant ID</Table.HeaderCell>
                        <Table.HeaderCell>Branch Price</Table.HeaderCell>
                        <Table.HeaderCell>Original Price</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {pricingData?.pricing && pricingData.pricing.map((p) => (
                        <Table.Row key={p.id}>
                          <Table.Cell className="font-mono text-xs">{p.variant_id}</Table.Cell>
                          <Table.Cell className="font-semibold text-rose-600">₹{p.price}</Table.Cell>
                          <Table.Cell className="line-through text-ui-fg-muted text-xs">
                            {p.compare_at_price ? `₹${p.compare_at_price}` : "N/A"}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                      {(!pricingData?.pricing || pricingData.pricing.length === 0) && (
                        <Table.Row>
                          <Table.Cell {...({ colSpan: 3 } as any)} className="text-center text-ui-fg-muted py-6">
                            No localized price overrides set.
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                </div>
              </div>
            ) : (
              <Text className="text-ui-fg-muted text-center py-6">Please select a branch to view inventory and pricing matrices.</Text>
            )}
          </Tabs.Content>

          <Tabs.Content value="transfers" className="pt-4">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>ID</Table.HeaderCell>
                  <Table.HeaderCell>From Branch</Table.HeaderCell>
                  <Table.HeaderCell>To Branch</Table.HeaderCell>
                  <Table.HeaderCell>Variant ID</Table.HeaderCell>
                  <Table.HeaderCell>Quantity</Table.HeaderCell>
                  <Table.HeaderCell>Created By</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              {transfersData?.transfers && (
                <Table.Body>
                  {transfersData.transfers.map((transfer) => (
                    <Table.Row key={transfer.id}>
                      <Table.Cell className="font-mono text-xs">{transfer.id}</Table.Cell>
                      <Table.Cell>{transfer.from_branch?.name || "Supplier (Incoming)"}</Table.Cell>
                      <Table.Cell className="font-semibold">{transfer.to_branch?.name}</Table.Cell>
                      <Table.Cell className="font-mono text-xs">{transfer.variant_id}</Table.Cell>
                      <Table.Cell className="font-bold">{transfer.quantity}</Table.Cell>
                      <Table.Cell className="text-xs text-ui-fg-muted">{transfer.created_by}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge
                          color={
                            transfer.status === "completed"
                              ? "green"
                              : transfer.status === "pending"
                              ? "orange"
                              : "red"
                          }
                        >
                          {transfer.status}
                        </StatusBadge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              )}
            </Table>
          </Tabs.Content>
        </Tabs>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Branches",
  icon: StoreIcon,
});

export default BranchesDashboard;
