/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Spinner } from "./ui/Spinner.js";
// type-only imports: erased at build time, they only give the wrappers below the real prop types
import type DirectorySearchT from "./DirectorySearch.js";
import type PropertyDetailViewT from "./PropertyDetailView.js";
import type PropertyCompareViewT from "./PropertyCompareView.js";
import type InteractiveMapT from "./InteractiveMap.js";
import type ProfileReviewsSectionT from "./ProfileReviewsSection.js";
import type MarketPriceIndexT from "./MarketPriceIndex.js";
import type AreaGuidesViewT from "./AreaGuidesView.js";
import type AreaGuideViewT from "./AreaGuideView.js";
import type ProjectsViewT from "./ProjectsView.js";
import type HelpCenterViewT from "./HelpCenterView.js";
import type CareersViewT from "./CareersView.js";
import type SupportTicketsViewT from "./SupportTicketsView.js";
import type PressViewT from "./PressView.js";
import type PartnershipsViewT from "./PartnershipsView.js";
import type PlansPricingViewT from "./PlansPricingView.js";
import type AiChatT from "./AiChat.js";

// Screens a visitor does not see when the home page first opens (a listing's detail page, the map,
// the compare table, the plans page, help, careers...) are loaded only when they are opened. They
// used to be part of the one big first download, so the home page waited for code it did not show.
// Each wrapper keeps the component's own name and props, so the code that uses them is unchanged.
// Every wrapper has its OWN loading placeholder: a single shared one would blank the whole page
// while one screen loads.

const Loading = () => (
  <div className="py-16 flex justify-center" role="status" aria-live="polite"><Spinner /></div>
);

function lazyView<C extends React.ComponentType<any>>(
  loader: () => Promise<{ default: C }>,
  fallback: React.ReactNode = <Loading />
) {
  const Inner = lazy(loader) as unknown as React.ComponentType<any>;
  return function LazyView(props: React.ComponentProps<C>) {
    return (
      <Suspense fallback={fallback}>
        <Inner {...props} />
      </Suspense>
    );
  };
}

// For something far down the page: do not even start downloading it until the visitor scrolls near.
// The placeholder keeps the room, so nothing jumps when it arrives.
function lazyWhenVisible<C extends React.ComponentType<any>>(loader: () => Promise<{ default: C }>, minHeight: number) {
  const View = lazyView<C>(loader, <div style={{ minHeight }} aria-hidden="true" />);
  return function VisibleView(props: React.ComponentProps<C>) {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      if (typeof IntersectionObserver === "undefined") { setShow(true); return; }
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { setShow(true); io.disconnect(); }
      }, { rootMargin: "500px" });
      io.observe(el);
      return () => io.disconnect();
    }, []);
    return show ? <View {...props} /> : <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
  };
}

// A full-page overlay opens on top of the page: its placeholder must not push the page around.
const overlayLoading = (
  <div className="fixed inset-0 z-[150] flex items-center justify-center bg-canvas/80" role="status" aria-live="polite"><Spinner /></div>
);

export const DirectorySearch = lazyView<typeof DirectorySearchT>(() => import("./DirectorySearch.js"));
export const PropertyDetailView = lazyView<typeof PropertyDetailViewT>(() => import("./PropertyDetailView.js"), overlayLoading);
export const PropertyCompareView = lazyView<typeof PropertyCompareViewT>(() => import("./PropertyCompareView.js"), overlayLoading);
export const InteractiveMap = lazyView<typeof InteractiveMapT>(() => import("./InteractiveMap.js"), <div className="min-h-[420px] flex items-center justify-center"><Spinner /></div>);
export const ProfileReviewsSection = lazyView<typeof ProfileReviewsSectionT>(() => import("./ProfileReviewsSection.js"));
// far down the home page (it carries the charts library): loaded only when scrolled near
export const MarketPriceIndex = lazyWhenVisible<typeof MarketPriceIndexT>(() => import("./MarketPriceIndex.js"), 300);
export const AreaGuidesView = lazyView<typeof AreaGuidesViewT>(() => import("./AreaGuidesView.js"));
export const AreaGuideView = lazyView<typeof AreaGuideViewT>(() => import("./AreaGuideView.js"), overlayLoading);
export const ProjectsView = lazyView<typeof ProjectsViewT>(() => import("./ProjectsView.js"));
export const HelpCenterView = lazyView<typeof HelpCenterViewT>(() => import("./HelpCenterView.js"));
export const CareersView = lazyView<typeof CareersViewT>(() => import("./CareersView.js"));
export const SupportTicketsView = lazyView<typeof SupportTicketsViewT>(() => import("./SupportTicketsView.js"));
export const PressView = lazyView<typeof PressViewT>(() => import("./PressView.js"));
export const PartnershipsView = lazyView<typeof PartnershipsViewT>(() => import("./PartnershipsView.js"));
export const PlansPricingView = lazyView<typeof PlansPricingViewT>(() => import("./PlansPricingView.js"));
// the assistant opens full-screen on a click, so nothing of it is downloaded until then
export const AiChat = lazyView<typeof AiChatT>(() => import("./AiChat.js"), overlayLoading);
// Agents / Agencies / Developers: start the download early so choosing one shows it at once (no loading spinner)
export const preloadDirectorySearch = () => { void import("./DirectorySearch.js"); };
