import { createFileRoute } from "@tanstack/react-router";
import { CampaignIntelligence } from "@/components/social/CampaignIntelligence";

export const Route = createFileRoute("/intelligence")({
  component: CampaignIntelligence,
});
