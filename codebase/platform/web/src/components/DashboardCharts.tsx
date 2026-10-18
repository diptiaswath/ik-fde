"use client";

import { AreaChart, DonutChart, BarList } from "@tremor/react";
import type {
  DayPoint,
  TypeSplit,
  StatusSplit,
  MerchantVolume,
} from "@/lib/queries";

const moneyOrInt = (n: number) => n.toLocaleString("en-US");

export function OpenedPerDayChart({ data }: { data: DayPoint[] }) {
  return (
    <AreaChart
      data={data}
      index="day"
      categories={["opened"]}
      colors={["teal"]}
      valueFormatter={moneyOrInt}
      showLegend={false}
      showGridLines={false}
      startEndOnly
      curveType="monotone"
      className="h-44"
    />
  );
}

export function TypeDonut({ data }: { data: TypeSplit[] }) {
  return (
    <DonutChart
      data={data}
      category="value"
      index="name"
      colors={["amber", "teal"]}
      valueFormatter={moneyOrInt}
      className="h-40"
      showLabel
    />
  );
}

const STATUS_ORDER = [
  "intake",
  "investigating",
  "provisional_credit",
  "resolved",
  "denied",
];

export function StatusBars({ data }: { data: StatusSplit[] }) {
  const sorted = [...data].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );
  const items = sorted.map((d) => ({
    name: d.status.replace(/_/g, " "),
    value: d.value,
  }));
  return (
    <BarList
      data={items}
      color="teal"
      valueFormatter={moneyOrInt}
      className="mt-1"
    />
  );
}

export function MerchantBars({ data }: { data: MerchantVolume[] }) {
  const items = data.map((d) => ({
    name: d.name,
    value: d.value,
    // color watch/bad merchants
    color: d.risk === "bad" ? "rose" : d.risk === "watch" ? "amber" : "teal",
  }));
  return (
    <BarList data={items} valueFormatter={moneyOrInt} className="mt-1" />
  );
}

export function SpendArea({
  data,
}: {
  data: { label: string; spend: number }[];
}) {
  return (
    <AreaChart
      data={data}
      index="label"
      categories={["spend"]}
      colors={["teal"]}
      valueFormatter={(n) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(n)
      }
      showLegend={false}
      showGridLines={false}
      startEndOnly
      curveType="monotone"
      className="h-28"
    />
  );
}
