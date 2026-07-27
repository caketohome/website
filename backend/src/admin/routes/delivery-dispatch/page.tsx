import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, StatusBadge, Button, Badge } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { BikeIcon } from "../../components/icons";

const DispatchBoardPage = () => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoard = async () => {
    try {
      const res = await fetch("/admin/delivery/dispatch");
      if (res.ok) {
        const payload = await res.json();
        setDeliveries(payload.deliveries || []);
        setDrivers(payload.drivers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, []);

  const handleManualAssign = async (deliveryId: string, partnerId: string) => {
    try {
      const res = await fetch("/admin/delivery/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_id: deliveryId, partner_id: partnerId }),
      });
      if (res.ok) {
        fetchBoard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Text>Loading Dispatch Board...</Text>;
  }

  return (
    <Container className="flex flex-col gap-6">
      <div>
        <Heading>Delivery Dispatch Board</Heading>
        <Text className="text-ui-fg-subtle">
          Monitor delivery partner shifts and manage orders auto-routing.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Container className="col-span-2 p-6 flex flex-col gap-4">
          <Heading level="h2">Active Deliveries</Heading>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Delivery ID</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Assigned Partner</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {deliveries.map((d) => (
                <Table.Row key={d.id}>
                  <Table.Cell className="font-mono text-sm font-semibold">{d.id}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={d.delivery_status === "delivered" ? "green" : "orange"}>
                      {d.delivery_status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell className="font-mono text-xs">{d.delivery_partner_id || "unassigned"}</Table.Cell>
                  <Table.Cell>
                    {!d.delivery_partner_id && drivers.length > 0 && (
                      <div className="flex gap-1">
                        <Button
                          size="small"
                          onClick={() => handleManualAssign(d.id, drivers[0].partner_id)}
                        >
                          Assign Driver
                        </Button>
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>

        <Container className="col-span-1 p-6 flex flex-col gap-4">
          <Heading level="h2">Driver Availability</Heading>
          {drivers.map((drv) => (
            <div key={drv.id} className="p-3 border rounded-lg flex justify-between items-center text-sm">
              <div>
                <div className="font-mono font-semibold">{drv.partner_id.substring(0, 10)}...</div>
                <div className="text-xs text-ui-fg-muted mt-1">Rating: {drv.rating}</div>
              </div>
              <Badge color={drv.is_verified ? "green" : "orange"}>
                {drv.is_verified ? "Verified" : "Pending"}
              </Badge>
            </div>
          ))}
        </Container>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Dispatch Board",
  icon: BikeIcon,
});

export default DispatchBoardPage;
