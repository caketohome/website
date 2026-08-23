import { getPublicCampaign } from "@frontend/lib/data/marketing";
import { Heading, Text, Container, Badge } from "@medusajs/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
    params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    try {
        const { campaign } = await getPublicCampaign(params.id);
        return {
            title: `${campaign.name} — CakeToHome`,
            description: campaign.description ?? `Active campaign: ${campaign.name}`,
        };
    } catch {
        return { title: "Campaign — CakeToHome" };
    }
}

export default async function CampaignDetailPage({ params }: PageProps) {
    let campaign: any;
    try {
        const res = await getPublicCampaign(params.id);
        campaign = res.campaign;
    } catch {
        notFound();
    }

    const now = new Date();
    const endsAt = campaign.ends_at ? new Date(campaign.ends_at) : null;
    const daysLeft =
        endsAt && endsAt.getTime() > now.getTime()
            ? Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

    return (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto px-4 py-8">
            <Link href="/campaigns" className="text-ui-fg-interactive text-sm">
                ← All campaigns
            </Link>

            <div className="flex items-center gap-3">
                <Badge color="green">{campaign.type.replace("_", " ")}</Badge>
                {campaign.is_featured && (
                    <Badge color="orange">★ Featured</Badge>
                )}
            </div>

            <Heading level="h1">{campaign.name}</Heading>

            {campaign.description && (
                <Text className="text-ui-fg-subtle text-base leading-relaxed">
                    {campaign.description}
                </Text>
            )}

            <Container className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Text className="text-ui-fg-subtle text-sm">Status</Text>
                    <Badge color="green">{campaign.status}</Badge>
                </div>
                {campaign.starts_at && (
                    <div className="flex items-center justify-between">
                        <Text className="text-ui-fg-subtle text-sm">Starts</Text>
                        <Text className="text-sm">
                            {new Date(campaign.starts_at).toLocaleDateString()}
                        </Text>
                    </div>
                )}
                {campaign.ends_at && (
                    <div className="flex items-center justify-between">
                        <Text className="text-ui-fg-subtle text-sm">Ends</Text>
                        <Text className="text-sm">
                            {new Date(campaign.ends_at).toLocaleDateString()}
                        </Text>
                    </div>
                )}
                {daysLeft !== null && (
                    <div className="flex items-center justify-between">
                        <Text className="text-ui-fg-subtle text-sm">Time remaining</Text>
                        <Text className="text-sm font-medium">
                            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                        </Text>
                    </div>
                )}
                {campaign.goal_type && (
                    <div className="flex items-center justify-between">
                        <Text className="text-ui-fg-subtle text-sm">Goal</Text>
                        <Text className="text-sm">{campaign.goal_type}</Text>
                    </div>
                )}
            </Container>

            <div className="flex gap-3">
                <Link
                    href="/products"
                    className="inline-flex items-center justify-center rounded-lg bg-ui-bg-interactive px-4 py-2 text-sm font-medium text-ui-fg-on-interactive hover:bg-ui-bg-interactive-hover"
                >
                    Shop Now
                </Link>
            </div>
        </div>
    );
}
