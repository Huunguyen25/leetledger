import { Suspense } from "react";
import { ProblemsWorkspace } from "@/components/dashboard/problems-workspace";

export const metadata = { title: "Problems" };

export default function ProblemsPage() {
  return (
    <Suspense fallback={<ProblemsFallback />}>
      <ProblemsWorkspace />
    </Suspense>
  );
}

function ProblemsFallback() {
  return (
    <div className="content">
      <div className="page-heading skeleton-heading" aria-hidden="true" />
      <div className="panel route-skeleton" aria-label="Loading problems" />
    </div>
  );
}
