import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Table, Button, Badge, Input, Label } from "@medusajs/ui";
import { useState, useEffect } from "react";
import { SettingsIcon } from "../../components/icons";

const RedirectsPage = () => {
  const [redirects, setRedirects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    from_path: "",
    to_url: "",
    redirect_type: 301,
  });

  const fetchRedirects = async () => {
    setLoading(true);
    try {
      const response = await fetch("/admin/cms/redirects");
      const result = await response.json();
      setRedirects(result.redirects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedirects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/admin/cms/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setShowCreate(false);
        setFormData({ from_path: "", to_url: "", redirect_type: 301 });
        fetchRedirects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/admin/cms/redirects/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchRedirects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Container className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Heading>Redirects Manager</Heading>
          <Text className="text-ui-fg-subtle">
            Manage SEO redirections and URL routing paths.
          </Text>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "View Redirects List" : "Add Redirect Rule"}
        </Button>
      </div>

      {showCreate ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-4 border border-ui-border-base p-6 rounded-lg">
          <Heading level="h3">New Redirect Rule</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Source Path (from)</Label>
              <Input
                placeholder="e.g. /old-blog-path"
                value={formData.from_path}
                onChange={(e) => setFormData({ ...formData, from_path: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Destination URL (to)</Label>
              <Input
                placeholder="e.g. /new-blog-path or https://external.com"
                value={formData.to_url}
                onChange={(e) => setFormData({ ...formData, to_url: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 w-64">
            <Label>Redirect Type</Label>
            <Input
              type="number"
              placeholder="301"
              value={formData.redirect_type}
              onChange={(e) => setFormData({ ...formData, redirect_type: Number(e.target.value) })}
            />
          </div>
          <Button type="submit" className="w-fit">Save Rule</Button>
        </form>
      ) : loading ? (
        <Text>Loading redirects...</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Source Path</Table.HeaderCell>
              <Table.HeaderCell>Destination URL</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {redirects.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell className="font-mono text-sm">{r.from_path}</Table.Cell>
                <Table.Cell className="font-mono text-sm">{r.to_url}</Table.Cell>
                <Table.Cell className="font-bold">{r.redirect_type}</Table.Cell>
                <Table.Cell>
                  <Badge color={r.is_active ? "green" : "red"}>
                    {r.is_active ? "active" : "inactive"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button variant="danger" size="small" onClick={() => handleDelete(r.id)}>
                    Delete
                  </Button>
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
  label: "Redirects",
  icon: SettingsIcon,
});

export default RedirectsPage;
