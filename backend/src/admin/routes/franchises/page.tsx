import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, Button, Badge, Input, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { ChartPieIcon } from "../../components/icons";

const FranchisesPage = () => {
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    franchisee_name: "",
    shop_id: "",
    commission_rate: 10,
  });

  const fetchFranchises = async () => {
    setLoading(true);
    try {
      const response = await fetch("/admin/analytics/franchises");
      const result = await response.json();
      setFranchises(result.franchises || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFranchises();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/admin/analytics/franchises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setShowCreate(false);
        setFormData({ franchisee_name: "", shop_id: "", commission_rate: 10 });
        fetchFranchises();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading>Franchise Management Console</Heading>
          <Text className="text-ui-fg-subtle">
            Manage franchisee billing contracts and commission split agreements.
          </Text>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "View Agreements List" : "Add Franchise Agreement"}
        </Button>
      </div>

      {showCreate ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-4 border border-ui-border-base p-6 rounded-lg">
          <Heading level="h3">New Franchise Agreement</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Franchisee Name</Label>
              <Input
                placeholder="Owner full name"
                value={formData.franchisee_name}
                onChange={(e) => setFormData({ ...formData, franchisee_name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Shop / Branch ID</Label>
              <Input
                placeholder="e.g. branch_1"
                value={formData.shop_id}
                onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 w-64">
            <Label>Commission Rate (%)</Label>
            <Input
              type="number"
              placeholder="e.g. 15"
              value={formData.commission_rate}
              onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
            />
          </div>
          <Button type="submit" className="w-fit">Save Contract</Button>
        </form>
      ) : loading ? (
        <Text>Loading franchises agreements...</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Agreement ID</Table.HeaderCell>
              <Table.HeaderCell>Franchisee Name</Table.HeaderCell>
              <Table.HeaderCell>Shop ID</Table.HeaderCell>
              <Table.HeaderCell>Commission Rate</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {franchises.map((f) => (
              <Table.Row key={f.id}>
                <Table.Cell className="font-mono text-xs">{f.id}</Table.Cell>
                <Table.Cell className="font-semibold">{f.franchisee_name}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{f.shop_id}</Table.Cell>
                <Table.Cell className="font-bold">{f.commission_rate}%</Table.Cell>
                <Table.Cell>
                  <Badge color={f.is_active ? "green" : "red"}>
                    {f.is_active ? "active" : "inactive"}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Franchises",
  icon: ChartPieIcon,
});

export default FranchisesPage;
