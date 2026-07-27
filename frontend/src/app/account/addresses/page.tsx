import { listAddresses } from "@frontend/lib/data/customer-server";
import { AddressManager } from "@frontend/components/store/account/address-manager";
import { Heading } from "@medusajs/ui";

export default async function AddressesPage() {
    let addresses: Awaited<ReturnType<typeof listAddresses>> = [];
    try {
        addresses = await listAddresses();
    } catch {
        addresses = [];
    }

    return (
        <div className="flex flex-col gap-4">
            <Heading level="h2">Saved Addresses</Heading>
            <AddressManager addresses={addresses} />
        </div>
    );
}
