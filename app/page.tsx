import OrderApp from "@/components/order-app";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<main className="h-dvh bg-[#1d332c]" />}>
      <OrderApp />
    </Suspense>
  );
}
