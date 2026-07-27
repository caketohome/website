import { retrieveUser } from "@frontend/lib/data";
import { Heading, Text } from "@medusajs/ui";

export default async function AccountProfilePage() {
    const user = (await retrieveUser()) as {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
    } | null;

    return (
        <div className="flex flex-col gap-4">
            <Heading level="h2">Profile</Heading>
            <div className="flex flex-col gap-2">
                <Text>
                    <span className="text-ui-fg-subtle">Name: </span>
                    {user?.first_name ?? ""} {user?.last_name ?? ""}
                </Text>
                <Text>
                    <span className="text-ui-fg-subtle">Email: </span>
                    {user?.email ?? "—"}
                </Text>
                <Text>
                    <span className="text-ui-fg-subtle">Phone: </span>
                    {user?.phone ?? "—"}
                </Text>
            </div>
        </div>
    );
}
