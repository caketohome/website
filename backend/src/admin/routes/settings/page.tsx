import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useState } from "react";
import {
  Container,
  Heading,
  Input,
  Label,
  Button,
  Text,
  Select,
  Textarea,
  Switch,
  Badge,
  StatusBadge,
} from "@medusajs/ui";
import { SettingsIcon } from "../../components/icons";
import {
  useSettings,
  saveSetting,
  type SettingEntry,
} from "../../hooks/use-settings";

const SETTING_GROUPS = [
  "system",
  "business",
  "delivery",
  "payment",
  "seo",
  "referral",
  "loyalty",
  "wallet",
  "notification",
  "marketing",
  "feature_flags",
  "localization",
  "platform",
];

const SettingsPage = () => {
  const { data, loading, refetch } = useSettings();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isJson, setIsJson] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const settings: SettingEntry[] = data?.settings ?? [];

  const filtered = selectedGroup
    ? settings.filter((s) => s.group === selectedGroup)
    : settings;

  const handleSave = async () => {
    if (!selectedGroup || !newKey) {
      setMessage("Group and key are required");
      return;
    }

    setSaving(true);
    let parsedValue: unknown = newValue;

    if (isJson && newValue) {
      try {
        parsedValue = JSON.parse(newValue);
      } catch {
        setMessage("Invalid JSON value");
        setSaving(false);
        return;
      }
    }

    const ok = await saveSetting({
      group: selectedGroup,
      key: newKey,
      value: parsedValue,
      is_json: isJson,
      is_secret: isSecret,
      description,
    });

    setSaving(false);
    setMessage(ok ? "Setting saved" : "Failed to save setting");

    if (ok) {
      setNewKey("");
      setNewValue("");
      setIsJson(false);
      setIsSecret(false);
      setDescription("");
      refetch();
    }
  };

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="p-6 flex flex-col gap-4">
        <Heading>Settings</Heading>
        <Text className="text-ui-fg-subtle">
          Centralized configuration for the CakeToHome platform. All features
          read from these settings dynamically.
        </Text>

        <div className="flex gap-4 items-end">
          <div className="flex flex-col gap-1 w-64">
            <Label>Group</Label>
            <Select
              value={selectedGroup}
              onValueChange={setSelectedGroup}
            >
              <Select.Trigger>
                <Select.Value placeholder="All groups" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">All groups</Select.Item>
                {SETTING_GROUPS.map((g) => (
                  <Select.Item key={g} value={g}>
                    {g}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 flex flex-col gap-4">
        <Heading level="h3">Add / Update Setting</Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Key</Label>
            <Input
              placeholder="e.g. default_currency"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Description</Label>
            <Input
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Value {isJson && "(JSON)"}</Label>
          {isJson ? (
            <Textarea
              placeholder='{"key": "value"}'
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              rows={4}
            />
          ) : (
            <Input
              placeholder="Setting value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          )}
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <Switch checked={isJson} onCheckedChange={setIsJson} />
            <Label>JSON value</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isSecret} onCheckedChange={setIsSecret} />
            <Label>Secret (hidden from storefront)</Label>
          </div>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
          >
            Save Setting
          </Button>
        </div>
        {message && (
          <Badge
            color={message.includes("saved") ? "green" : "red"}
            className="w-fit"
          >
            {message}
          </Badge>
        )}
      </div>

      <div className="px-6 pb-6">
        <Heading level="h3">Current Settings</Heading>
        {loading ? (
          <Text>Loading...</Text>
        ) : filtered.length === 0 ? (
          <Text className="text-ui-fg-subtle">No settings found.</Text>
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-1 border border-ui-border-base rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge>{s.group}</Badge>
                  <Text className="font-semibold">{s.key}</Text>
                  {s.is_secret && (
                    <StatusBadge color="orange">secret</StatusBadge>
                  )}
                  {s.is_json && <StatusBadge color="blue">json</StatusBadge>}
                </div>
                {s.description && (
                  <Text className="text-ui-fg-subtle text-sm">
                    {s.description}
                  </Text>
                )}
                <Text className="text-sm font-mono break-all">
                  {s.is_secret ? "••••••••" : (s.value ?? "—")}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Settings",
  icon: SettingsIcon,
});

export default SettingsPage;
