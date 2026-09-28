import { notFound } from "next/navigation";
import { OrgTreeMockup } from "./OrgTreeMockup";

// ORG TREE MOCKUP — the owner signs off on the layout before the real org
// view is built (plan Part D). Built to design/reference/org-tree-sketch.jpg
// with static sample data. DEV-ONLY: production builds 404.
export default function OrgPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OrgTreeMockup />;
}
