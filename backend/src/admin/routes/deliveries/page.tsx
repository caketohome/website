import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useState } from "react";
import {
  Container,
  Heading,
  Table,
  Text,
  Button,
  Input,
  Label,
  Switch,
  Select,
  Badge,
} from "@medusajs/ui";
import DeliveryRow from "../../components/delivery-row";
import { PizzaIcon } from "../../components/icons";
import { useDeliveries } from "../../hooks";
import {
  useDeliveryZones,
  upsertDeliveryZone,
  deleteDeliveryZone,
  useDeliverySlots,
  upsertDeliverySlot,
  deleteDeliverySlot,
} from "../../hooks/use-catalog";
import React from "react";

const Deliveries = () => {
  const [tab, setTab] = useState<"active" | "zones" | "slots">("active");

  return (
    <Container className="flex flex-col p-6 gap-6">
      <div className="flex items-center justify-between border-b pb-4">
        <Heading level="h1" className="text-2xl font-bold">Delivery Operations</Heading>
        <div className="flex gap-2">
          {(["active", "zones", "slots"] as const).map((t) => (
            <Button
              key={t}
              variant={tab === t ? "secondary" : "transparent"}
              size="small"
              onClick={() => setTab(t)}
            >
              {t === "active"
                ? "Active Deliveries"
                : t === "zones"
                  ? "Delivery Zones"
                  : "Time Slots"}
            </Button>
          ))}
        </div>
      </div>

      {tab === "active" && <ActiveDeliveriesTab />}
      {tab === "zones" && <DeliveryZonesTab />}
      {tab === "slots" && <DeliverySlotsTab />}
    </Container>
  );
};

// ── Active Deliveries Tab ───────────────────────────────────────────────────

function ActiveDeliveriesTab() {
  const { data, loading } = useDeliveries();

  return (
    <div className="flex flex-col gap-4">
      {loading && <Text>Loading deliveries...</Text>}
      {data?.deliveries && (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Delivery</Table.HeaderCell>
              <Table.HeaderCell>Shop</Table.HeaderCell>
              <Table.HeaderCell>Items</Table.HeaderCell>
              <Table.HeaderCell>Action</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.deliveries.map((delivery) => (
              <DeliveryRow key={delivery.id} delivery={delivery} />
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}

// ── Delivery Zones Tab ──────────────────────────────────────────────────────

function DeliveryZonesTab() {
  const { data, loading } = useDeliveryZones();
  const [pincode, setPincode] = useState("");
  const [branchId, setBranchId] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isServiceable, setIsServiceable] = useState(true);
  const [saving, setSaving] = useState(false);

  const zones = data?.delivery_zones ?? [];

  async function handleSave() {
    if (!pincode || !branchId) return;
    setSaving(true);
    try {
      await upsertDeliveryZone({
        pincode,
        branch_id: branchId,
        delivery_fee: deliveryFee,
        is_serviceable: isServiceable,
      });
      setPincode("");
      setBranchId("");
      setDeliveryFee(0);
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upsert Zone */}
      <div className="border rounded-lg p-4 flex flex-col gap-4 bg-ui-bg-base">
        <Heading level="h2" className="text-sm font-bold">Add / Update Delivery Zone</Heading>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Pincode</Label>
            <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="e.g., 110001" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Branch / Shop ID</Label>
            <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="e.g., res_1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Delivery Fee (INR/Euros)</Label>
            <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between pt-6 border-l pl-4">
            <Label>Serviceable</Label>
            <Switch checked={isServiceable} onCheckedChange={setIsServiceable} />
          </div>
        </div>
        <Button onClick={handleSave} isLoading={saving} className="w-fit">Save Zone</Button>
      </div>

      {/* List Zones */}
      <div className="flex flex-col gap-2">
        <Heading level="h2" className="text-sm font-bold">Serviceable Zones ({zones.length})</Heading>
        {loading ? (
          <Text>Loading zones...</Text>
        ) : zones.length === 0 ? (
          <Text className="text-ui-fg-subtle">No delivery zones configured yet.</Text>
        ) : (
          <div className="flex flex-col gap-2">
            {zones.map((zone) => (
              <div key={zone.id} className="border rounded p-3 flex items-center justify-between bg-ui-bg-base">
                <div className="flex flex-col gap-1">
                  <Text className="text-sm font-semibold">Pincode: {zone.pincode}</Text>
                  <Text className="text-xs text-ui-fg-subtle">Branch: {zone.branch_id}</Text>
                  <div className="flex gap-1 flex-wrap mt-1">
                    <Badge size="small" color={zone.is_serviceable ? "green" : "red"}>
                      {zone.is_serviceable ? "Serviceable" : "Unserviceable"}
                    </Badge>
                    <Badge size="small" color="blue">Fee: €{Number(zone.delivery_fee).toFixed(2)}</Badge>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="small"
                  onClick={async () => {
                    await deleteDeliveryZone(zone.id);
                    window.location.reload();
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delivery Slots Tab ──────────────────────────────────────────────────────

function DeliverySlotsTab() {
  const { data, loading } = useDeliverySlots();
  const [branchId, setBranchId] = useState("");
  const [slotName, setSlotName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [maxCapacity, setMaxCapacity] = useState(10);
  const [extraCharge, setExtraCharge] = useState(0);
  const [saving, setSaving] = useState(false);

  const slots = data?.delivery_slots ?? [];

  async function handleSave() {
    if (!branchId || !slotName || !startTime || !endTime) return;
    setSaving(true);
    try {
      await upsertDeliverySlot({
        branch_id: branchId,
        slot_name: slotName,
        start_time: startTime,
        end_time: endTime,
        max_capacity: maxCapacity,
        extra_charge: extraCharge,
      });
      setSlotName("");
      setBranchId("");
      setMaxCapacity(10);
      setExtraCharge(0);
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upsert Slot */}
      <div className="border rounded-lg p-4 flex flex-col gap-4 bg-ui-bg-base">
        <Heading level="h2" className="text-sm font-bold">Add Delivery Time Slot</Heading>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Branch ID</Label>
            <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="e.g. res_1" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Slot Name</Label>
            <Input value={slotName} onChange={(e) => setSlotName(e.target.value)} placeholder="e.g. Morning (9 AM - 12 PM)" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Start Time (HH:MM)</Label>
            <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="09:00" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>End Time (HH:MM)</Label>
            <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="12:00" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Max Bookings Capacity</Label>
            <Input type="number" value={maxCapacity} onChange={(e) => setMaxCapacity(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Express / Surcharge Fee</Label>
            <Input type="number" value={extraCharge} onChange={(e) => setExtraCharge(Number(e.target.value))} />
          </div>
        </div>
        <Button onClick={handleSave} isLoading={saving} className="w-fit">Save Time Slot</Button>
      </div>

      {/* List Slots */}
      <div className="flex flex-col gap-2">
        <Heading level="h2" className="text-sm font-bold">Configured Delivery Slots ({slots.length})</Heading>
        {loading ? (
          <Text>Loading slots...</Text>
        ) : slots.length === 0 ? (
          <Text className="text-ui-fg-subtle">No slots configured yet.</Text>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => (
              <div key={slot.id} className="border rounded p-3 flex items-center justify-between bg-ui-bg-base">
                <div className="flex flex-col gap-1">
                  <Text className="text-sm font-semibold">{slot.slot_name}</Text>
                  <Text className="text-xs text-ui-fg-subtle">Branch: {slot.branch_id} | Timing: {slot.start_time} - {slot.end_time}</Text>
                  <div className="flex gap-1 flex-wrap mt-1">
                    <Badge size="small" color="blue">Capacity: {slot.max_capacity} orders</Badge>
                    {slot.extra_charge > 0 && (
                      <Badge size="small" color="orange">Surcharge: +€{Number(slot.extra_charge).toFixed(2)}</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="small"
                  onClick={async () => {
                    await deleteDeliverySlot(slot.id);
                    window.location.reload();
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const config = defineRouteConfig({
  label: "Deliveries",
  icon: PizzaIcon,
});

export default Deliveries;
