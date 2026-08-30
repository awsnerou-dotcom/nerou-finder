/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "./ui/EmptyState.js";

export interface DashboardChartDatum {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface DashboardChartProps {
  data: DashboardChartDatum[];
  type?: "line" | "bar";
  height?: number;
  valueLabel: string;
  secondaryValueLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  isRtl?: boolean;
}

// Thin recharts wrapper shared by every dashboard's trend charts. Colors are read from the
// same runtime CSS custom properties src/index.css redefines per-theme (--gold, --border,
// --ink-muted, --info, --surface, --ink) rather than hardcoded hex, so a chart dropped into
// either light or dark mode - or the always-dark "chrome" hero panels - picks up the right
// palette automatically with no theme-aware prop plumbing needed.
export default function DashboardChart({
  data,
  type = "line",
  height = 220,
  valueLabel,
  secondaryValueLabel,
  emptyTitle,
  emptyDescription,
  isRtl = false,
}: DashboardChartProps) {
  const hasData = data.length > 0 && data.some(d => d.value > 0 || (d.secondaryValue || 0) > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={<BarChart3 size={20} />}
        title={emptyTitle || (isRtl ? "لا توجد بيانات كافية بعد" : "Not enough data yet")}
        description={
          emptyDescription ||
          (isRtl ? "ستظهر الاتجاهات هنا بمجرد تسجيل نشاط حقيقي." : "Trends will appear here once there's real activity to chart.")
        }
      />
    );
  }

  const tooltipStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 11,
    color: "var(--ink)",
  };
  const tickStyle = { fill: "var(--ink-muted)", fontSize: 10 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "line" ? (
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--ink-muted)" }} cursor={{ stroke: "var(--border)" }} />
          {secondaryValueLabel && <Legend wrapperStyle={{ fontSize: 11, color: "var(--ink-muted)" }} />}
          <Line type="monotone" dataKey="value" name={valueLabel} stroke="var(--gold)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          {secondaryValueLabel && (
            <Line
              type="monotone"
              dataKey="secondaryValue"
              name={secondaryValueLabel}
              stroke="var(--info)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--ink-muted)" }} cursor={{ fill: "var(--surface-2)" }} />
          {secondaryValueLabel && <Legend wrapperStyle={{ fontSize: 11, color: "var(--ink-muted)" }} />}
          <Bar dataKey="value" name={valueLabel} fill="var(--gold)" radius={[4, 4, 0, 0]} />
          {secondaryValueLabel && <Bar dataKey="secondaryValue" name={secondaryValueLabel} fill="var(--info)" radius={[4, 4, 0, 0]} />}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
