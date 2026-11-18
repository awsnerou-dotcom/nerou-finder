// What the platform says by email at every step of an applicant's journey, in English and Arabic in the same message, so nobody is
// ever left wondering what happens next:
//   registered -> application approved -> plan confirmed -> documents uploaded -> documents approved = verified -> trial ending.
// These are pure functions (text in, text out); server.ts decides when each one is sent and to whom. Every dynamic value is escaped here.

import { TRIAL_DAYS, type SubscriptionReminder } from "./onboarding.js";
import { esc } from "./seoHtml.js";

export interface EmailParts {
  /** the subject line, without the "[Nerou Finder]" prefix the sender adds */
  subject: string;
  /** a short heading (escaped by the template wrapper) */
  title: string;
  /** the message body as HTML, already escaped */
  body: string;
}

/** An English paragraph followed by its Arabic twin. Both arguments are HTML that is already safe. */
const bi = (en: string, ar: string) => `<p>${en}</p><p dir="rtl" style="text-align:right">${ar}</p>`;
const list = (items: { en: string; ar: string }[]) =>
  `<ol>${items.map(i => `<li>${i.en}</li>`).join("")}</ol><ol dir="rtl" style="text-align:right">${items.map(i => `<li>${i.ar}</li>`).join("")}</ol>`;

export type ApplicantKind = "AGENCY" | "DEVELOPER" | "AGENT" | "OTHER";

const kindWords = (kind: ApplicantKind) =>
  kind === "AGENCY" ? { en: "your company", ar: "شركتك" }
  : kind === "DEVELOPER" ? { en: "your company", ar: "شركتك" }
  : { en: "your account", ar: "حسابك" };

const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : "");

// ---------------------------------------------------------------------------------------------
// The applicant
// ---------------------------------------------------------------------------------------------

/** After the email code is confirmed. A professional's application goes through review; a buyer's account is simply ready. */
export function welcomeEmail(o: { gated: boolean; trial?: boolean }): EmailParts {
  if (!o.gated) {
    return {
      subject: "Welcome to Nerou Finder / أهلاً بك في نيرو فايندر",
      title: "Welcome to Nerou Finder / أهلاً بك في نيرو فايندر",
      body: bi("Your account has been created successfully. You can now sign in to your dashboard.", "تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول إلى لوحتك.")
    };
  }
  return {
    subject: "We received your application / استلمنا طلبك",
    title: "We received your application / استلمنا طلبك",
    body:
      bi("Thank you for registering with Nerou Finder. Your application is now with our team. This is what happens next, and we will email you at every step:",
         "شكراً لتسجيلك في نيرو فايندر. طلبك الآن لدى فريقنا. هذه هي الخطوات القادمة، وسنراسلك عند كل خطوة:") +
      list([
        { en: "We review your application.", ar: "نراجع طلبك." },
        { en: o.trial ? `We confirm your plan and start your ${TRIAL_DAYS}-day free trial.` : "We confirm your plan and activate your subscription.", ar: o.trial ? `نؤكد باقتك ونبدأ تجربتك المجانية لمدة ${TRIAL_DAYS} يوماً.` : "نؤكد باقتك ونفعّل اشتراكك." },
        { en: "You upload your documents from the Verification section of your dashboard.", ar: "ترفع مستنداتك من قسم التوثيق في لوحتك." },
        { en: "When your documents are approved, your account is verified and the verified badge appears.", ar: "عند اعتماد مستنداتك يتوثق حسابك وتظهر شارة التوثيق." }
      ]) +
      bi("You can sign in and look around in the meantime.", "يمكنك تسجيل الدخول والتعرف على المنصة في الأثناء.")
  };
}

/** The application moved to a new step (an admin moved it, or the platform did when a step was completed). */
export function applicationStatusEmail(status: string, o: { kind: ApplicantKind; trial?: boolean }): EmailParts | null {
  const who = kindWords(o.kind);
  switch (status) {
    case "PENDING_APPROVAL":
      return {
        subject: "Your application is under review / طلبك قيد المراجعة",
        title: "Your application is under review / طلبك قيد المراجعة",
        body: bi(`Our team is reviewing ${who.en}. We will email you as soon as there is a decision.`, `يراجع فريقنا ${who.ar}. سنراسلك فور صدور القرار.`)
      };
    case "AWAITING_PAYMENT":
      return {
        subject: "Your application was approved: next, your plan / تمت الموافقة على طلبك: الخطوة التالية باقتك",
        title: "Your application was approved / تمت الموافقة على طلبك",
        body: bi(
          o.trial
            ? `Good news: our team approved your application. Next we confirm your plan and start your ${TRIAL_DAYS}-day free trial. Nothing is charged for the trial, and we will contact you to complete it.`
            : "Good news: our team approved your application. Next we confirm your plan and activate your subscription. We will contact you to complete it.",
          o.trial
            ? `خبر سار: وافق فريقنا على طلبك. الخطوة التالية تأكيد باقتك وبدء تجربتك المجانية لمدة ${TRIAL_DAYS} يوماً. لا يُحتسب على التجربة أي رسوم، وسنتواصل معك لإتمامها.`
            : "خبر سار: وافق فريقنا على طلبك. الخطوة التالية تأكيد باقتك وتفعيل اشتراكك. وسنتواصل معك لإتمام ذلك."
        )
      };
    case "AWAITING_DOCUMENTS":
      return {
        subject: "Next step: upload your documents / الخطوة التالية: ارفع مستنداتك",
        title: "Upload your documents / ارفع مستنداتك",
        body: bi("Your plan is confirmed. The next step is to upload the documents listed in the Verification section of your dashboard. When they are approved, your account is verified.",
                 "تم تأكيد باقتك. الخطوة التالية رفع المستندات المذكورة في قسم التوثيق في لوحتك. وعند اعتمادها يتوثق حسابك.")
      };
    case "UNDER_VERIFICATION":
      return {
        subject: "We have all your documents / استلمنا كل مستنداتك",
        title: "Your documents are under review / مستنداتك قيد المراجعة",
        body: bi("We have received all the documents we need and our compliance team is reviewing them. You will get an email when each one is approved or if we need a correction.",
                 "استلمنا كل المستندات المطلوبة ويراجعها فريق الامتثال لدينا. ستصلك رسالة عند اعتماد كل مستند أو إن احتجنا إلى تصحيح.")
      };
    case "ACTIVE":
      return {
        subject: "Your account is active / حسابك فعّال",
        title: "Your account is active / حسابك فعّال",
        body: bi("Your application is complete and your account is active. You can use every feature of your plan.", "اكتمل طلبك وأصبح حسابك فعّالاً. يمكنك استخدام كل ميزات باقتك.")
      };
    default:
      return null;
  }
}

/** The plan was confirmed by an admin (the step after "application approved"). */
export function subscriptionActivatedEmail(o: { planName: string; expiry?: string; trial?: boolean; needsDocuments: boolean }): EmailParts {
  const until = fmtDate(o.expiry);
  return {
    subject: o.trial ? "Your free trial has started / بدأت تجربتك المجانية" : "Your subscription is active / اشتراكك فعّال",
    title: o.trial ? "Your free trial has started / بدأت تجربتك المجانية" : "Your subscription is active / اشتراكك فعّال",
    body:
      bi(`Your <strong>${esc(o.planName)}</strong> plan is active${until ? ` until <strong>${esc(until)}</strong>` : ""}.${o.trial ? ` Your free trial lasts ${TRIAL_DAYS} days.` : ""}`,
         `باقتك <strong>${esc(o.planName)}</strong> فعّالة${until ? ` حتى <strong>${esc(until)}</strong>` : ""}.${o.trial ? ` تستمر تجربتك المجانية ${TRIAL_DAYS} يوماً.` : ""}`) +
      (o.needsDocuments
        ? bi("Next step: upload your documents from the Verification section of your dashboard. Your account is verified once they are approved.",
             "الخطوة التالية: ارفع مستنداتك من قسم التوثيق في لوحتك. يتوثق حسابك عند اعتمادها.")
        : "")
  };
}

/** Every required document is approved: the account is verified (and active). */
export function accountVerifiedEmail(o: { kind: ApplicantKind }): EmailParts {
  const team = o.kind === "AGENCY" || o.kind === "DEVELOPER";
  return {
    subject: "Your account is verified / تم توثيق حسابك",
    title: "Your account is verified / تم توثيق حسابك",
    body: bi(`Our team approved all of your documents, so ${team ? "your company is" : "your account is"} now verified. The verified badge shows on your public profile and listings${team ? ", and on the profiles of the agents in your team" : ""}.`,
             `اعتمد فريقنا كل مستنداتك، فأصبح ${team ? "حساب شركتك" : "حسابك"} موثقاً. وتظهر شارة التوثيق في صفحتك العامة وإعلاناتك${team ? " وفي صفحات الوكلاء في فريقك" : ""}.`)
  };
}

/** An admin set the verification status by hand (not through the documents). */
export function verificationChangedEmail(status: string, o: { kind: ApplicantKind }): EmailParts | null {
  const who = kindWords(o.kind);
  if (status === "APPROVED") {
    return {
      subject: "Your account is verified / تم توثيق حسابك",
      title: "Your account is verified / تم توثيق حسابك",
      body: bi(`Our team verified ${who.en}. The verified badge now shows on your public profile and listings.`, `وثّق فريقنا ${who.ar}. تظهر شارة التوثيق الآن في صفحتك العامة وإعلاناتك.`)
    };
  }
  if (status === "REJECTED") {
    return {
      subject: "We could not verify your account / تعذّر توثيق حسابك",
      title: "We could not verify your account / تعذّر توثيق حسابك",
      body: bi("We were not able to verify your account with the information provided. Please contact us, or upload corrected documents from the Verification section of your dashboard.",
               "لم نتمكن من توثيق حسابك بالمعلومات المقدمة. يرجى التواصل معنا أو رفع مستندات مصححة من قسم التوثيق في لوحتك.")
    };
  }
  if (status === "SUSPENDED") {
    return {
      subject: "Your account has been suspended / تم تعليق حسابك",
      title: "Your account has been suspended / تم تعليق حسابك",
      body: bi("Your account has been suspended while our team looks into it. Please contact us so we can resolve it.", "تم تعليق حسابك أثناء مراجعة فريقنا. يرجى التواصل معنا لحل الأمر.")
    };
  }
  return null;
}

/** The trial or subscription is about to end, or has ended. */
export function subscriptionReminderEmail(kind: SubscriptionReminder, o: { planName: string; expiry: string; trial?: boolean }): EmailParts {
  const plan = esc(o.planName);
  // "free trial" needs no plan name (it would only repeat itself); a paid plan is named. The Arabic verb agrees with the noun:
  // the trial (تجربة) is feminine, the subscription (اشتراك) is masculine.
  const what = o.trial
    ? { en: "free trial", enFull: "free trial", ar: "تجربتك المجانية", arFull: "تجربتك المجانية", ends: "تنتهي", ended: "انتهت" }
    : { en: "subscription", enFull: `<strong>${plan}</strong> subscription`, ar: "اشتراكك", arFull: `اشتراكك في باقة <strong>${plan}</strong>`, ends: "ينتهي", ended: "انتهى" };
  const date = esc(fmtDate(o.expiry));
  const keep = bi("To keep going without a break, contact us to choose a plan: reply to this email or open the Plans page.",
                  "لتستمر دون انقطاع، تواصل معنا لاختيار باقة: ردّ على هذه الرسالة أو افتح صفحة الباقات.");
  if (kind === "expired") {
    const subject = `Your ${what.en} has ended / ${what.ar} ${what.ended}`;
    return {
      subject,
      title: subject,
      body: bi(`Your ${what.enFull} ended on <strong>${date}</strong>.`, `${what.arFull} ${what.ended} بتاريخ <strong>${date}</strong>.`) + keep
    };
  }
  const left = kind === "d1" ? { en: "tomorrow", ar: "غداً" } : { en: "in 7 days", ar: "خلال 7 أيام" };
  const subject = `Your ${what.en} ends ${left.en} / ${what.ar} ${what.ends} ${left.ar}`;
  return {
    subject,
    title: subject,
    body: bi(`Your ${what.enFull} ends ${left.en}, on <strong>${date}</strong>.`, `${what.arFull} ${what.ends} ${left.ar}، بتاريخ <strong>${date}</strong>.`) + keep
  };
}

// ---------------------------------------------------------------------------------------------
// The platform team
// ---------------------------------------------------------------------------------------------

export function adminNewApplicationEmail(o: { name: string; kind: ApplicantKind; email: string; phone?: string; planName?: string }): EmailParts {
  const kind = o.kind === "AGENT" ? "independent agent" : o.kind === "DEVELOPER" ? "developer" : o.kind === "AGENCY" ? "agency" : "account";
  return {
    subject: `New ${kind} application: ${o.name}`,
    title: `New ${kind} application`,
    body: `<p><strong>${esc(o.name)}</strong> registered as ${esc(kind)} and is waiting for your review.</p>` +
      `<p>Email: ${esc(o.email)}<br/>Phone: ${esc(o.phone || "Not specified")}${o.planName ? `<br/>Plan chosen: ${esc(o.planName)}` : ""}</p>` +
      `<p>Open Control Center, Verifications, to move the application to the next step.</p>`
  };
}

export function adminDocumentsReadyEmail(o: { name: string; kind: ApplicantKind; count: number }): EmailParts {
  return {
    subject: `Documents ready for review: ${o.name}`,
    title: "Documents ready for review",
    body: `<p><strong>${esc(o.name)}</strong> has uploaded all ${esc(o.count)} required document(s).</p><p>Open Control Center, Verifications, to review them: approving them all verifies the account.</p>`
  };
}
