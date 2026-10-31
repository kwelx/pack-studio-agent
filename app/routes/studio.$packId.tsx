import { useParams } from "react-router";

import { PackDesk } from "@/components/studio/PackDesk";

export default function StudioPackRoute() {
  const { packId } = useParams();
  if (!packId) return null;
  return <PackDesk packId={packId} />;
}
