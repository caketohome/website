import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Table, Text } from "@medusajs/ui";
import { DeliveryPartnerDTO } from "../../../modules/delivery/types/common";
import DeliveryPartnerActionsMenu from "../../components/delivery_partner-actions-menu";
import { BikeIcon } from "../../components/icons";
import { useDeliveries, useDeliveryPartners } from "../../hooks";

const DeliveryPartners = () => {
  const { data, loading } = useDeliveryPartners();

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="p-6">
        <Heading className="txt-large-plus">DeliveryPartners</Heading>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Phone</Table.HeaderCell>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Completed deliveries</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        {loading && <Text>Loading...</Text>}
        {data?.delivery_partners && (
          <Table.Body>
            {data.delivery_partners.map((delivery_partner) => {
              return (
                <Table.Row key={delivery_partner.id}>
                  <Table.Cell className="flex gap-2 items-center">
                    {delivery_partner.avatar_url && (
                      <img
                        src={delivery_partner.avatar_url}
                        className="rounded-full h-8"
                      />
                    )}
                    {delivery_partner.first_name} {delivery_partner.last_name}
                  </Table.Cell>
                  <Table.Cell>{delivery_partner.phone}</Table.Cell>
                  <Table.Cell>{delivery_partner.email}</Table.Cell>
                  <Table.Cell>
                    <DeliveryCount delivery_partner={delivery_partner} />
                  </Table.Cell>
                  <Table.Cell>
                    <DeliveryPartnerActionsMenu delivery_partner={delivery_partner} />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        )}
      </Table>
      <div className="p-6"></div>
    </Container>
  );
};

const DeliveryCount = ({ delivery_partner }: { delivery_partner: DeliveryPartnerDTO }) => {
  const { data, loading } = useDeliveries({
    delivery_partner_id: delivery_partner.id,
  });

  return <Text>{loading ? "Loading..." : data?.deliveries.length}</Text>;
};

export const config = defineRouteConfig({
  label: "DeliveryPartners",
  icon: BikeIcon,
});

export default DeliveryPartners;
