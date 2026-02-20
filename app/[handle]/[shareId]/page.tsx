"use client";

import SharedEventView from "@/components/app/profile/shared-event";
import { useParams } from "next/navigation";

export default function AtprotoSharePage() {
  const params = useParams();
  return <SharedEventView handle={params.handle as string} shareId={params.shareId as string} />;
}
