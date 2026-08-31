/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Eye, Users, TrendingUp, MessageSquareText } from "lucide-react";
import { Property, Lead } from "../types.js";
import { Modal } from "./ui/Modal.js";
import StatCard from "./StatCard.js";
import DashboardChart from "./DashboardChart.js";
import { buildDailySumSeries, datesToDayRecord } from "../lib/dashboardMetrics.js";

interface ListingPerformanceModalProps {
  open: boolean;
  onClose: () => void;
  property: Property | null;
  // Full leads list already scoped to the caller's workspace (own leads for an agent, org-wide
  // for an agency/developer admin) - this component does the propertyId cross-reference itself
  // rather than requiring a new server endpoint, per GET /api/leads already returning every
  // lead's propertyId.
  leads: Lead[];
  isRtl: boolean;
}

// Per-listing analytics drill-down, distinct from the dashboard-level aggregate StatCards
// (which sum across every listing). Opened from a "Performance" button on a listing card in
// AgentWorkspace/AgencyWorkspace/DeveloperWorkspace. Uses the same Property.viewsByDay data
// Part 1's public view counts read from - no new tracking, no new endpoint.
export default function ListingPerformanceModal({ open, onClose, property, leads, isRtl }: ListingPerformanceModalProps) {
  if (!property) return null;

  const totalViews = property.views || 0;
  const uniqueViews = property.uniqueViews || 0;
  const propertyLeads = leads.filter(l => l.propertyId === property.id);
  const leadsGenerated = propertyLeads.length;
  const conversionRate = totalViews > 0 ? (leadsGenerated / totalViews) * 100 : 0;

  const trendSeries = buildDailySumSeries(
    [property.viewsByDay || {}],
    30,
    isRtl,
    [datesToDayRecord(propertyLeads.map(l => l.createdDate))]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      isRtl={isRtl}
      title={
        <span className="flex items-center gap-2">
          <TrendingUp size={17} className="text-gold" />
          <span>{isRtl ? "تقرير أداء العقار" : "Listing Performance Report"}</span>
        </span>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-bold text-ink truncate">{isRtl ? property.titleAr || property.title : property.title}</p>
          <p className="text-[11px] text-ink-muted">{property.listingId} • {property.district}, {property.city}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Eye} label={isRtl ? "إجمالي المشاهدات" : "Total Views"} value={totalViews} />
          <StatCard icon={Users} label={isRtl ? "مشاهدات فريدة" : "Unique Views"} value={uniqueViews} />
          <StatCard icon={MessageSquareText} label={isRtl ? "عملاء محتملون" : "Leads Generated"} value={leadsGenerated} />
          <StatCard
            icon={TrendingUp}
            label={isRtl ? "معدل التحويل" : "View → Lead Rate"}
            value={`${conversionRate.toFixed(1)}%`}
            subtitle={
              totalViews === 0
                ? (isRtl ? "لا توجد مشاهدات بعد" : "No views yet")
                : undefined
            }
          />
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border">
          <h4 className="text-xs font-bold text-ink mb-3">{isRtl ? "المشاهدات والعملاء المحتملون خلال ٣٠ يوماً" : "Views & Leads — Last 30 Days"}</h4>
          <DashboardChart
            data={trendSeries}
            valueLabel={isRtl ? "مشاهدات" : "Views"}
            secondaryValueLabel={isRtl ? "عملاء محتملون" : "Leads"}
            isRtl={isRtl}
            emptyTitle={isRtl ? "لا توجد بيانات مشاهدة بعد" : "No view activity yet"}
            emptyDescription={isRtl ? "ستظهر الاتجاهات هنا بمجرد أن يزور الجمهور صفحة هذا العقار." : "Trends will appear here once visitors start viewing this listing."}
          />
        </div>
      </div>
    </Modal>
  );
}
