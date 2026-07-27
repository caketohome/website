import { getReferralsInfo, getReferralsHistory } from "@frontend/lib/data";
import { Heading, Text, Container, Badge } from "@medusajs/ui";

export default async function AccountReferralsPage() {
  const info = await getReferralsInfo();
  const historyData = await getReferralsHistory();

  if (!info) {
    return (
      <div className="flex flex-col gap-4">
        <Heading level="h2">Referrals</Heading>
        <Text className="text-ui-fg-subtle">
          Unable to retrieve your referral campaign info. Please try again later.
        </Text>
      </div>
    );
  }

  const { referral_code, campaign } = info;
  const history = historyData?.history || [];

  const inviteUrl = `https://cakes2home.com/register?ref=${referral_code.code}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center border-b border-ui-border-base pb-4">
        <div>
          <Heading level="h2">Refer & Earn</Heading>
          <Text className="text-ui-fg-subtle">
            Invite your friends to Cakes2Home and get rewarded when they place their first order.
          </Text>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-4">
          <Container className="p-6 flex flex-col gap-4 border border-ui-border-base rounded-lg bg-ui-bg-subtle">
            <Heading level="h3">Your Invitation Code</Heading>
            <div className="flex items-center justify-between bg-ui-bg-field border border-ui-border-base p-4 rounded-lg font-mono text-2xl font-bold tracking-widest text-ui-fg-base select-all">
              {referral_code.code}
            </div>

            <Heading level="h3">Share Invite Link</Heading>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3 py-2 border border-ui-border-base rounded bg-ui-bg-field text-sm text-ui-fg-subtle"
              />
            </div>

            {campaign && (
              <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-1">
                <span className="text-xs text-green-800 uppercase tracking-wider font-semibold">Active Campaign</span>
                <Text className="text-sm font-semibold text-green-900">{campaign.name}</Text>
                <Text className="text-xs text-green-700">
                  Friends get started, and you receive <span className="font-bold">{campaign.reward_value} Credits</span>.
                </Text>
              </div>
            )}
          </Container>
        </div>

        <div className="md:col-span-1">
          <Container className="p-6 flex flex-col items-center justify-center gap-4 text-center border border-ui-border-base rounded-lg">
            <Heading level="h3">QR Invitation Code</Heading>
            <svg
              width="150"
              height="150"
              viewBox="0 0 29 29"
              shapeRendering="crispEdges"
              className="border border-ui-border-base p-2 bg-white"
              aria-label="Referral QR Code invitation"
            >
              <path fill="#000" d="M0 0h7v7H0zm22 0h7v7h-7zM0 22h7v7H0zm9 0h2v2H9zm2 2h2v2h-2zm-2 2h2v3H9zm6 1h2v2h-2zm2-4h2v2h-2zm2 2h2v2h-2zm2 2h3v1h-3zm3-3h2v2h-2zm-5-3h3v2h-3zm-3-3h2v2h-2zm2 2h2v2h-2zm3-2h3v2h-3zm3 2h2v2h-2z" />
              <path fill="#000" d="M2 2h3v3H2zm20 0h3v3h-3zM2 24h3v3H2zm8-15h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm6-6h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm6-6h3v3h-3zm0 6h2v2h-2z" />
            </svg>
            <Text className="text-xs text-ui-fg-subtle">
              Let your friends scan this QR code to sign up and inherit rewards.
            </Text>
          </Container>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Heading level="h3">Invited Friends History</Heading>
        {history.length === 0 ? (
          <Container className="p-8 text-center text-ui-fg-subtle border border-ui-border-base rounded-lg">
            No referrals registered yet. Share your code to start earning!
          </Container>
        ) : (
          <div className="overflow-x-auto border border-ui-border-base rounded-lg">
            <table className="min-w-full divide-y divide-ui-border-base text-left text-sm">
              <thead className="bg-ui-bg-subtle text-ui-fg-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Friend ID</th>
                  <th className="px-4 py-3 font-semibold">Event Status</th>
                  <th className="px-4 py-3 font-semibold">Eligibility</th>
                  <th className="px-4 py-3 font-semibold">Invite Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base bg-ui-bg-base">
                {history.map((item: any) => (
                  <tr key={item.id} className="hover:bg-ui-bg-subtle-hover transition">
                    <td className="px-4 py-3 font-mono text-xs text-ui-fg-subtle">
                      {item.referee_id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={item.status === "reviewed" ? "green" : item.status === "rejected" ? "red" : "orange"}>
                        {item.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ui-fg-subtle">
                      {item.qualified ? (
                        <span className="text-green-600 font-semibold">Qualified</span>
                      ) : (
                        <span className="text-ui-fg-subtle">{item.qualification_reason || "Pending activity"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ui-fg-subtle text-xs">
                      {new Date(item.created_at).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
