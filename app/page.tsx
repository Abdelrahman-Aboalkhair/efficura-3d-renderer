"use client";

import CapitalStackMock, {
  type StackTranche,
} from "@/components/CapitalStackMock";

/**
 * Default tranches used on the Asset Skyview page
 * ("The whole capital stack, at a glance.")
 * Ordered top → bottom: Equity → Mezzanine → Senior.
 */
const DEFAULT_TRANCHES: StackTranche[] = [
  { fraction: 0.25, percent: "25%", name: "Equity", color: "#d8956a" },
  { fraction: 0.15, percent: "15%", name: "Mezzanine", color: "#c2662d" },
  { fraction: 0.6, percent: "60%", name: "Senior", color: "#7f3f20" },
];

export default function Page() {
  return (
    <main
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
    >
      <CapitalStackMock tranches={DEFAULT_TRANCHES} />
    </main>
  );
}
