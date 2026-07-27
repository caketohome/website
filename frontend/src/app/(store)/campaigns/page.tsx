import { listPublicCampaigns } from "@frontend/lib/data/marketing";
import { Heading, Text, Container, Badge } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Offers & Campaigns — CakeToHome",
    description:
        "Browse active promotions, seasonal campaigns, and limited-time offers at CakeToHome.",
};

export default async function CampaignsPage() {
    const { campaigns } = await listPublicCampaigns({ limit: 30 }).catch(() => ({
        campaigns: [],
        count: 0,
        limit: 30,
        offset: 0,
    }));

    const featured = campaigns.filter((c) => c.is_featured);
    const rest = campaigns.filter((c) => !c.is_featured);

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto px-4 py-8">
            <div className="flex flex-col gap-2">
                <Heading level="h1">Offers & Campaigns</Heading>
                <Text className="text-ui-fg-subtle">
                    Discover active promotions, seasonal specials, and limited-time offers.
                </Text>
            </div>

            {campaigns.length === 0 ? (
                <Container className="p-8 flex flex-col items-center gap-2">
                    <Text className="text-ui-fg-subtle">
                        No active campaigns right now. Check back soon!
                    </Text>
                </Container>
            ) : (
                <>
                    {featured.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <Heading level="h2">Featured</Heading>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {featured.map((c) => (
                                    <CampaignCard key={c.id} campaign={c} featured />
                                ))}
                            </div>
                        </div>
                    )}

                    {rest.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <Heading level="h2">All Campaigns</Heading>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {rest.map((c) => (
                                    <CampaignCard key={c.id} campaign={c} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function CampaignCard({
    campaign,
    featured = false,
}: {
    campaign: any;
    featured?: boolean;
}) {
    const now = new Date();
    const endsAt = campaign.ends_at ? new Date(campaign.ends_at) : null;
    const daysLeft =
        endsAt && endsAt.getTime() > now.getTime()
            ? Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

    return (
        <Link href={`/campaigns/${campaign.id}`}>
            <Container
                className={`p-5 flex flex-col gap-3 h-full transition-shadow hover:shadow-md ${featured ? "border-ui-border-interactive" : ""
                    }`}
            >
                <div className="flex items-center justify-between">
                    <Badge color="green" size="small">
                        {campaign.type.replace("_", " ")}
                    </Badge>
                    {featured && (
                        <Badge color="orange" size="small">
                            ★ Featured
                        </Badge>
                    )}
                </div>

                <Heading level="h3" className="text-lg">
                    {campaign.name}
                </Heading>

                {campaign.description && (
                    <Text className="text-ui-fg-subtle text-sm line-clamp-2">
                        {campaign.description}
                    </Text>
                )}

                <div className="flex items-center justify-between mt-auto pt-2">
                    {daysLeft !== null ? (
                        <Text className="text-ui-fg-subtle text-xs">
                            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                        </Text>
                    ) : (
                        <Text className="text-ui-fg-subtle text-xs">Ongoing</Text>
                    )}
                    <Text className="text-ui-fg-interactive text-sm font-medium">
                        View →
                    </Text>
                </div>
            </Container>
        </Link>
    );
}
