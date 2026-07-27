import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, StatusBadge, Table, Text } from "@medusajs/ui";
import ActionsMenu from "../../components/actions-menu";
import { StoreIcon } from "../../components/icons";
import { useShops } from "../../hooks";

const Shops = () => {
  const { data, loading } = useShops();

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="p-6">
        <Heading className="txt-large-plus">Shops</Heading>
      </div>
      {loading && <Text>Loading...</Text>}
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Phone</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        {data?.shops && (
          <Table.Body>
            {data.shops.map((shop) => (
              <Table.Row key={shop.id}>
                <Table.Cell>{shop.name}</Table.Cell>
                <Table.Cell>
                  <StatusBadge color={shop.is_open ? "green" : "red"}>
                    {shop.is_open ? "Open" : "Closed"}
                  </StatusBadge>
                </Table.Cell>
                <Table.Cell>{shop.phone}</Table.Cell>
                <Table.Cell>{shop.email}</Table.Cell>
                <Table.Cell>
                  <ActionsMenu />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        )}
      </Table>
      <div className="p-6"></div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Shops",
  icon: StoreIcon,
});

export default Shops;
