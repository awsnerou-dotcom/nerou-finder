/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { User, Organization, ApplicationStatus, SubscriptionPlan, UserRole } from "../types.js";
import { CheckCircle2, Circle, Clock, ShieldCheck, CreditCard, FileText } from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";

interface OnboardingStatusViewProps {
  user: User;
  org: Organization | null;
  isRtl: boolean;
}

const STEPS: { en: string; ar: string }[] = [
  { en: "Account Created", ar: "تم إنشاء الحساب" },
  { en: "Plan Selected", ar: "تم اختيار الخطة" },
  { en: "Payment Confirmed", ar: "تم تأكيد الدفع" },
  { en: "Documents Submitted", ar: "تم تقديم المستندات" },
  { en: "Verified", ar: "تم التوثيق" },
  { en: "Active", ar: "الحساب نشط" }
];

// Maps the current applicationStatus to how many of the 6 onboarding steps are complete.
function completedStepsFor(status?: ApplicationStatus): number {
  switch (status) {
    case ApplicationStatus.PENDING_APPROVAL:
      return 1;
    case ApplicationStatus.AWAITING_PAYMENT:
      return 2;
    case ApplicationStatus.AWAITING_DOCUMENTS:
      return 3;
    case ApplicationStatus.UNDER_VERIFICATION:
      return 4;
    case ApplicationStatus.ACTIVE:
      return 6;
    default:
      return 6;
  }
}

export default function OnboardingStatusView({ user, org, isRtl }: OnboardingStatusViewProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    fetch("/api/plans")
      .then(res => res.json())
      .then(data => setPlans(data || []))
      .catch(err => console.error("Error loading subscription plans:", err));
  }, []);

  const status = user.applicationStatus;
  const completedSteps = completedStepsFor(status);

  // For AGENCY_ADMIN/DEVELOPER_ADMIN the subscription lives on the Organization; for an
  // INDEPENDENT_AGENT it lives directly on the User record.
  const isOrgContext = user.role === UserRole.AGENCY_ADMIN || user.role === UserRole.DEVELOPER_ADMIN;
  const subscriptionPlanId = isOrgContext ? org?.subscriptionPlanId : user.subscriptionPlanId;
  const plan = plans.find(p => p.id === subscriptionPlanId);

  const nextAction = (() => {
    switch (status) {
      case ApplicationStatus.PENDING_APPROVAL:
        return {
          en: "Thank you for signing up! Our team is currently reviewing your application. We'll be in touch shortly to arrange your subscription plan and payment.",
          ar: "شكراً لتسجيلك! فريقنا يقوم حالياً بمراجعة طلبك. سنتواصل معك قريباً لترتيب خطة الاشتراك والدفع."
        };
      case ApplicationStatus.AWAITING_PAYMENT:
        return {
          en: "Our team is reviewing your application. Once your subscription payment is confirmed, you'll be able to upload your verification documents.",
          ar: "فريقنا يقوم بمراجعة طلبك. بمجرد تأكيد دفع الاشتراك، ستتمكن من رفع مستندات التوثيق الخاصة بك."
        };
      case ApplicationStatus.AWAITING_DOCUMENTS:
        return {
          en: "Your subscription payment has been confirmed. Please upload your required verification documents below to continue.",
          ar: "تم تأكيد دفع الاشتراك الخاص بك. يرجى رفع مستندات التوثيق المطلوبة أدناه للمتابعة."
        };
      case ApplicationStatus.UNDER_VERIFICATION:
        return {
          en: "Your documents are under review by our compliance team. We'll notify you as soon as verification is complete.",
          ar: "مستنداتك قيد المراجعة من قبل فريق الامتثال لدينا. سنقوم بإعلامك فور اكتمال عملية التوثيق."
        };
      default:
        return {
          en: "Your account is fully active.",
          ar: "حسابك مفعّل بالكامل."
        };
    }
  })();

  const showDocumentsPanel =
    status === ApplicationStatus.AWAITING_DOCUMENTS || status === ApplicationStatus.UNDER_VERIFICATION;

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-center space-y-2 border-b border-[#e6e2de] pb-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#1a1918] flex items-center justify-center">
          <ShieldCheck className="text-[#bf9b30]" size={26} />
        </div>
        <h2 className="text-2xl font-serif text-[#1a1918] font-medium">
          {isRtl ? "حالة تفعيل حسابك" : "Your Account Activation Status"}
        </h2>
        <p className="text-xs text-[#6e6b66]">
          {isRtl
            ? `مرحباً ${user.fullName}، تابع تقدم طلبك أدناه.`
            : `Welcome, ${user.fullName}. Track your onboarding progress below.`}
        </p>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white p-6 rounded-xl border border-[#e6e2de]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-0">
          {STEPS.map((step, idx) => {
            const stepNumber = idx + 1;
            const isDone = stepNumber <= completedSteps;
            const isCurrent = stepNumber === completedSteps + 1;
            return (
              <React.Fragment key={step.en}>
                <div className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2 sm:text-center">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border-2 ${
                      isDone
                        ? "bg-[#bf9b30] border-[#bf9b30] text-black"
                        : isCurrent
                        ? "border-[#bf9b30] text-[#bf9b30] bg-white"
                        : "border-[#e6e2de] text-[#6e6b66] bg-white"
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={16} /> : isCurrent ? <Clock size={16} /> : <Circle size={14} />}
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      isDone || isCurrent ? "text-[#1a1918]" : "text-[#6e6b66]"
                    }`}
                  >
                    {isRtl ? step.ar : step.en}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`hidden sm:block flex-1 h-0.5 mt-4 ${
                      stepNumber < completedSteps ? "bg-[#bf9b30]" : "bg-[#e6e2de]"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Plan + Next Action Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-white p-5 rounded-xl border border-[#e6e2de] space-y-2">
          <div className="flex items-center gap-2 text-[#6e6b66]">
            <CreditCard size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? "الخطة المختارة" : "Selected Plan"}</span>
          </div>
          <h4 className="text-sm font-serif font-bold text-[#1a1918]">
            {plan?.name || (isRtl ? "لم يتم تحديد خطة بعد" : "No plan selected yet")}
          </h4>
          {plan && (
            <p className="text-[10px] text-[#6e6b66]">{plan.priceMonthly} QAR/mo</p>
          )}
        </div>

        <div className="md:col-span-2 bg-[#fbfaf8] p-5 rounded-xl border border-[#e6e2de] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6e6b66]">
            {isRtl ? "الإجراء التالي المطلوب" : "Next Required Action"}
          </span>
          <p className="text-xs text-[#1a1918] leading-relaxed">{isRtl ? nextAction.ar : nextAction.en}</p>
        </div>
      </div>

      {/* Embedded Verification Documents Panel once payment is confirmed */}
      {showDocumentsPanel && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <FileText size={14} className="text-[#bf9b30]" />
            <h3 className="text-sm font-serif font-semibold text-[#1a1918]">
              {isRtl ? "مستندات التوثيق المطلوبة" : "Required Verification Documents"}
            </h3>
          </div>
          <VerificationDocumentsPanel isRtl={isRtl} agent={user.role === UserRole.AGENT ? user : undefined} />
        </div>
      )}
    </div>
  );
}
