"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import PullToRefresh from "@/components/ui/PullToRefresh";
import {
  agreementLeadPrefill,
  parseAgreementPageQuery,
} from "@/lib/leads/admin-agreement-ui";
import type { LeadDetail } from "@/lib/leads/projection";

type Tier = "LANDING" | "BASIC" | "ADVANCED" | "PREMIUM";
type Status = "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
type PaymentStatus = "PENDING" | "SENT" | "COMPLETED" | "FAILED" | "CANCELLED";

interface Agreement {
  id: string;
  leadId?: string | null;
  tier: Tier | null;
  monthlyPrice: number;
  oneTimeFee: number | null;
  customerName: string;
  businessName: string | null;
  idNumber: string | null;
  phone: string;
  email: string;
  status: Status;
  signedAt: string | null;
  signToken: string;
  content: string;
  createdAt: string;
  client?: { id: string; name: string } | null;
  paymentStatus: PaymentStatus;
  paymentUrl: string | null;
  paidAmount: number | null;
  paidAt: string | null;
  invoiceNumber: string | null;
  cardcomRecurringId: number | null;
}

const TIER_LABEL: Record<Tier, string> = {
  LANDING: "דף נחיתה",
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

const TIER_VARIANT: Record<Tier, "cyan" | "pink" | "yellow" | "green"> = {
  LANDING: "green",
  BASIC: "cyan",
  ADVANCED: "pink",
  PREMIUM: "yellow",
};

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  SIGNED: "נחתם",
  CANCELLED: "בוטל",
};

const STATUS_VARIANT: Record<Status, "gray" | "cyan" | "green" | "red"> = {
  DRAFT: "gray",
  SENT: "cyan",
  SIGNED: "green",
  CANCELLED: "red",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "טרם נשלח",
  SENT: "נשלח לתשלום",
  COMPLETED: "שולם",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

const PAYMENT_VARIANT: Record<PaymentStatus, "gray" | "cyan" | "green" | "red" | "yellow"> = {
  PENDING: "gray",
  SENT: "cyan",
  COMPLETED: "green",
  FAILED: "red",
  CANCELLED: "gray",
};

const TIER_PRICE: Record<Tier, number> = {
  LANDING: 59,
  BASIC: 99,
  ADVANCED: 199,
  PREMIUM: 599,
};

type TierChoice = Tier | "CUSTOM";

interface ProductLite {
  id: string;
  name: string;
  monthlyAmount: number | null;
  agreementId: string | null;
}

// A distinct contact identity under one paying client — each past agreement
// carries the company/person it was signed with (מקורות pays for Aquatis,
// PEONY LION and טיסר, each with its own signer and email).
interface ContactProfile {
  key: string;
  customerName: string;
  businessName: string | null;
  idNumber: string | null;
  phone: string;
  email: string;
}

interface ClientLite {
  id: string;
  number: number;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  idNumber: string | null;
  products?: ProductLite[];
}

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Agreement | null>(null);
  const [creating, setCreating] = useState(false);

  const [tierChoice, setTierChoice] = useState<TierChoice>("ADVANCED");
  const [monthlyPrice, setMonthlyPrice] = useState<string>(String(TIER_PRICE.ADVANCED));
  const [oneTimeFee, setOneTimeFee] = useState<string>("");
  const [additionalServices, setAdditionalServices] = useState<string[]>([]);
  const [newClause, setNewClause] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agreementLeadId, setAgreementLeadId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  // Product coverage: "" = none, "new" = create a product, else a product id.
  const [productChoice, setProductChoice] = useState<string>("");
  const [newProductName, setNewProductName] = useState("");
  // Which contact identity fills the form ("" = manual / none picked yet).
  const [contactKey, setContactKey] = useState<string>("");
  // Foreign client: English contract + English Cardcom page + zero-rate VAT.
  const [isForeign, setIsForeign] = useState(false);

  // Client list (for create-time picker + inline relink action)
  const [clientsList, setClientsList] = useState<ClientLite[]>([]);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [savingLinkFor, setSavingLinkFor] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Agreement | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // Modal that shows a generated link (signing or payment) so the user can
  // copy it via a fresh click — `navigator.clipboard.writeText` fails when
  // called after `await fetch(...)` because the original user gesture is gone.
  const [linkModal, setLinkModal] = useState<{ url: string; title: string } | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/agreements");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAgreements(json.data || []);
    } catch {
      toast.error("שגיאה בטעינת הסכמים");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) return;
      const json = await res.json();
      setClientsList(
        ((json.data ?? []) as ClientLite[]).slice().sort((a, b) => a.number - b.number)
      );
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchClients();
  }, [fetchList, fetchClients]);

  // Canonical deep-links carry only the lead id. Contact details are read from
  // the server projection so URL values cannot silently become contract data.
  const searchParams = useSearchParams();
  const router = useRouter();
  const createHandledRef = useRef<string | null>(null);
  const focusHandledRef = useRef<string | null>(null);
  const {
    leadId: queryLeadId,
    focusAgreementId,
  } = parseAgreementPageQuery(searchParams);
  const createRequested = searchParams.get("new") === "1";
  const legacyCreateValues = {
    name: searchParams.get("name") ?? "",
    phone: searchParams.get("phone") ?? "",
    email: searchParams.get("email") ?? "",
    business: searchParams.get("business") ?? "",
  };
  const createRequestKey = createRequested
    ? JSON.stringify({
        leadId: queryLeadId,
        ...legacyCreateValues,
      })
    : null;

  useEffect(() => {
    if (!createRequestKey) {
      createHandledRef.current = null;
      return;
    }

    if (createHandledRef.current === createRequestKey) return;
    createHandledRef.current = createRequestKey;
    setCreateOpen(true);
    setAgreementLeadId(queryLeadId);

    const stripCreateQuery = () => {
      const next = new URLSearchParams(window.location.search);
      ["new", "leadId", "name", "phone", "email", "business"].forEach(
        (key) => next.delete(key),
      );
      const suffix = next.toString();
      router.replace(
        suffix ? `/admin/agreements?${suffix}` : "/admin/agreements",
        { scroll: false },
      );
    };

    if (!queryLeadId) {
      // Compatibility for legacy lead links while the feature flag is off.
      setCustomerName(legacyCreateValues.name);
      setPhone(legacyCreateValues.phone);
      setEmail(legacyCreateValues.email);
      setBusinessName(legacyCreateValues.business);
      stripCreateQuery();
      return;
    }

    let active = true;
    void fetch(`/api/leads/${encodeURIComponent(queryLeadId)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("לא ניתן לטעון את פרטי הליד");
        return (await response.json()) as LeadDetail;
      })
      .then((lead) => {
        if (!active) return;
        const prefill = agreementLeadPrefill(lead);
        setCustomerName(prefill.customerName);
        setBusinessName(prefill.businessName);
        setEmail(prefill.email);
        setPhone(prefill.phone);
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof Error ? error.message : "טעינת הליד נכשלה",
          );
        }
      })
      .finally(() => {
        if (active) stripCreateQuery();
      });

    return () => {
      active = false;
    };
  }, [
    createRequestKey,
    legacyCreateValues.business,
    legacyCreateValues.email,
    legacyCreateValues.name,
    legacyCreateValues.phone,
    queryLeadId,
    router,
  ]);

  useEffect(() => {
    if (!focusAgreementId) {
      focusHandledRef.current = null;
      return;
    }
    if (
      loading ||
      focusHandledRef.current === focusAgreementId
    ) {
      return;
    }

    focusHandledRef.current = focusAgreementId;
    const agreement = agreements.find(
      (candidate) => candidate.id === focusAgreementId,
    );

    const next = new URLSearchParams(window.location.search);
    next.delete("focus");
    const suffix = next.toString();
    router.replace(
      suffix ? `/admin/agreements?${suffix}` : "/admin/agreements",
      { scroll: false },
    );

    if (!agreement) {
      toast.error("ההסכם המבוקש לא נמצא");
      return;
    }

    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const element = document.getElementById(
      `${mobile ? "agreement-card" : "agreement-row"}-${focusAgreementId}`,
    );
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
    setViewing(agreement);
  }, [agreements, focusAgreementId, loading, router]);

  const resetForm = () => {
    setTierChoice("ADVANCED");
    setMonthlyPrice(String(TIER_PRICE.ADVANCED));
    setOneTimeFee("");
    setAdditionalServices([]);
    setNewClause("");
    setCustomerName("");
    setBusinessName("");
    setIdNumber("");
    setPhone("");
    setEmail("");
    setAgreementLeadId(null);
    setClientId("");
    setProductChoice("");
    setNewProductName("");
    setContactKey("");
    setIsForeign(false);
  };

  // Every contact identity known for a client: one per distinct signer on its
  // past agreements (newest first) plus the client card itself. This is where
  // "which company/department is this agreement for" gets answered.
  const contactProfilesFor = (id: string): ContactProfile[] => {
    const profiles: ContactProfile[] = [];
    const seen = new Set<string>();
    const push = (p: Omit<ContactProfile, "key">) => {
      if (!p.customerName && !p.email) return;
      const key = [p.customerName, p.businessName ?? "", p.email]
        .join("|")
        .toLowerCase()
        .trim();
      if (seen.has(key)) return;
      seen.add(key);
      profiles.push({ ...p, key });
    };
    for (const a of agreements) {
      if (a.client?.id !== id) continue;
      push({
        customerName: a.customerName,
        businessName: a.businessName,
        idNumber: a.idNumber,
        phone: a.phone,
        email: a.email,
      });
    }
    const c = clientsList.find((x) => x.id === id);
    // The client card is a fallback identity, not another signer — adding it
    // when its email already appears above would just show the same person
    // twice under two names (מקורות's card carries Aquatis's email).
    const covered = new Set(profiles.map((x) => x.email.toLowerCase().trim()).filter(Boolean));
    if (c && !(c.email && covered.has(c.email.toLowerCase().trim()))) {
      push({
        customerName: c.name,
        businessName: c.businessName,
        idNumber: c.idNumber,
        phone: c.phone ?? "",
        email: c.email ?? "",
      });
    }
    return profiles;
  };

  const applyContactProfile = (id: string, key: string) => {
    setContactKey(key);
    const p = contactProfilesFor(id).find((x) => x.key === key);
    if (!p) return;
    // An explicit pick overwrites — that is the point of picking.
    setCustomerName(p.customerName);
    setBusinessName(p.businessName ?? "");
    setIdNumber(p.idNumber ?? "");
    setPhone(p.phone);
    setEmail(p.email);
  };

  const onPickClient = (id: string) => {
    setClientId(id);
    setNewProductName("");
    setContactKey("");
    if (!id) {
      setProductChoice("");
      return;
    }
    const c = clientsList.find((x) => x.id === id);
    if (!c) return;
    // Sensible default for the product link: a single-product client almost
    // always means "this agreement re-papers that product"; several products
    // almost always mean a NEW project is being sold. Both stay overridable.
    const prods = c.products ?? [];
    setProductChoice(prods.length === 1 ? prods[0].id : "new");

    const profiles = contactProfilesFor(id);
    if (profiles.length > 1) {
      // Several known identities (different companies/departments under one
      // paying client) — auto-filling any one of them would quietly put the
      // wrong company on a contract. Leave the fields for an explicit pick.
      return;
    }
    if (profiles.length === 1) {
      applyContactProfile(id, profiles[0].key);
      return;
    }
    // No known profiles — fall back to the client card, empty fields only.
    if (!customerName.trim()) setCustomerName(c.name);
    if (!businessName.trim() && c.businessName) setBusinessName(c.businessName);
    if (!idNumber.trim() && c.idNumber) setIdNumber(c.idNumber);
    if (!phone.trim() && c.phone) setPhone(c.phone);
    if (!email.trim() && c.email) setEmail(c.email);
  };

  const updateAgreementClient = async (agreementId: string, newClientId: string | null) => {
    setSavingLinkFor(agreementId);
    try {
      const res = await fetch(`/api/agreements/${agreementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: newClientId }),
      });
      if (!res.ok) throw new Error();
      toast.success("הקישור עודכן", { duration: 1500, style: { fontSize: "13px" } });
      setRelinkingId(null);
      fetchList();
    } catch {
      toast.error("שגיאה בעדכון הקישור");
    } finally {
      setSavingLinkFor(null);
    }
  };

  const pickTier = (next: TierChoice) => {
    setTierChoice(next);
    if (next === "CUSTOM") {
      setMonthlyPrice("");
    } else {
      setMonthlyPrice(String(TIER_PRICE[next]));
    }
  };

  const addClause = () => {
    const trimmed = newClause.trim();
    if (!trimmed) return;
    if (additionalServices.length >= 30) {
      toast.error("ניתן להוסיף עד 30 סעיפים");
      return;
    }
    setAdditionalServices([...additionalServices, trimmed]);
    setNewClause("");
  };

  const removeClause = (index: number) => {
    setAdditionalServices(additionalServices.filter((_, i) => i !== index));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const monthly = parseFloat(monthlyPrice);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        toast.error("הזן מחיר חודשי תקין");
        setCreating(false);
        return;
      }
      const setup = oneTimeFee.trim() ? parseFloat(oneTimeFee) : null;
      if (setup !== null && (!Number.isFinite(setup) || setup <= 0)) {
        toast.error("סכום הקמה לא תקין");
        setCreating(false);
        return;
      }
      if (clientId && productChoice === "new" && !newProductName.trim()) {
        toast.error("תן שם למוצר החדש (או בחר מוצר קיים)");
        setCreating(false);
        return;
      }

      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tierChoice === "CUSTOM" ? null : tierChoice,
          additionalServices,
          monthlyPrice: monthly,
          oneTimeFee: setup,
          customerName: customerName.trim(),
          businessName: businessName.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          phone: phone.trim(),
          email: email.trim(),
          locale: isForeign ? "en" : "he",
          vatExempt: isForeign,
          ...(agreementLeadId ? { leadId: agreementLeadId } : {}),
          ...(clientId ? { clientId } : {}),
          ...(clientId && productChoice && productChoice !== "new"
            ? { productId: productChoice }
            : {}),
          ...(clientId && productChoice === "new" && newProductName.trim()
            ? { newProductName: newProductName.trim() }
            : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const fieldErrors = json?.details?.fieldErrors as
          | Record<string, string[] | undefined>
          | undefined;
        if (fieldErrors) {
          const FIELD_LABEL: Record<string, string> = {
            customerName: "שם מלא",
            phone: "טלפון",
            email: "אימייל",
            monthlyPrice: "תשלום חודשי",
            oneTimeFee: "סכום הקמה",
            businessName: "שם עסק",
            idNumber: "ח.פ. / ע.מ.",
            tier: "מסלול",
            additionalServices: "סעיפים נוספים",
            clientId: "קישור ללקוח",
          };
          const messages = Object.entries(fieldErrors)
            .flatMap(([field, msgs]) =>
              (msgs ?? []).map((m) => `${FIELD_LABEL[field] ?? field}: ${m}`)
            );
          if (messages.length > 0) throw new Error(messages.join(" • "));
        }
        throw new Error(json.error || "שגיאה");
      }
      toast.success("ההסכם נוצר");
      setCreateOpen(false);
      resetForm();
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת הסכם");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/agreement/${token}`;
    // No async work before clipboard — gesture is still alive, try direct copy.
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הקישור הועתק");
    } catch {
      // Fallback: show the link in a modal so the user can copy manually.
      setLinkModal({ url, title: "קישור לחתימה" });
    }
  };

  const copyPaymentLink = async (a: Agreement) => {
    try {
      // Reuse the cached URL ONLY when paymentStatus is SENT (URL fresh,
      // not yet attempted). For FAILED, the previous Cardcom session is
      // locked and reusing the URL just lands the customer in the same
      // failure — so we always regenerate. For PENDING with no URL we
      // generate too.
      let url = a.paymentStatus === "SENT" ? a.paymentUrl : null;
      if (!url) {
        const res = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agreementId: a.id }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "שגיאה ביצירת לינק תשלום");
        }
        const json = (await res.json()) as { url: string };
        url = json.url;
        fetchList();
      }
      if (!url) throw new Error("לא נוצר לינק תשלום");
      // After an await the browser drops the user-gesture flag and
      // navigator.clipboard.writeText throws NotAllowedError. Show a modal
      // with a manual copy button (fresh gesture) instead of trying directly.
      setLinkModal({
        url,
        title: a.paymentStatus === "FAILED" ? "לינק תשלום חדש" : "לינק תשלום",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  };

  const copyFromModal = async () => {
    if (!linkModal) return;
    try {
      await navigator.clipboard.writeText(linkModal.url);
      toast.success("הועתק");
      setLinkModal(null);
    } catch {
      toast.error("ההעתקה נחסמה — סמן ידנית והעתק");
    }
  };

  const retryRecurring = async (a: Agreement) => {
    setRetryingId(a.id);
    try {
      const res = await fetch("/api/agreements/retry-recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId: a.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה");
      const result = json.results?.[0];
      if (result?.ok) {
        toast.success("הוראת קבע הוקמה בהצלחה");
        fetchList();
      } else {
        throw new Error(result?.error || json.message || "לא ניתן להקים הוראת קבע");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהקמת הוראת קבע");
    } finally {
      setRetryingId(null);
    }
  };

  const openCancellation = (agreement: Agreement) => {
    setCancelTarget(agreement);
    setCancelReason("");
  };

  const closeCancellation = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason("");
  };

  const handleCancellation = async () => {
    if (!cancelTarget || cancelReason.trim().length < 3) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/agreements/${cancelTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: cancelReason.trim(),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "שגיאה");
      }
      toast.success("ההסכם בוטל ונשמר בהיסטוריה");
      setCancelTarget(null);
      setCancelReason("");
      await fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בביטול ההסכם");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchList}>
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">הסכמים</h1>
        <button
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-pink hover:bg-pink-light text-white rounded-xl text-sm font-bold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          הסכם חדש
        </button>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {agreements.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center text-sm text-gray-500">
            עוד לא יצרת הסכמים
          </div>
        ) : (
          agreements.map((a) => (
            <div
              key={a.id}
              id={`agreement-card-${a.id}`}
              tabIndex={-1}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white truncate">{a.customerName}</div>
                  {a.businessName && (
                    <div className="text-xs text-gray-400 truncate">{a.businessName}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {a.tier ? (
                    <Badge variant={TIER_VARIANT[a.tier]}>{TIER_LABEL[a.tier]}</Badge>
                  ) : (
                    <Badge variant="gray">מותאם</Badge>
                  )}
                  <span className="text-sm font-mono text-white">{a.monthlyPrice} ₪</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                <Badge variant={PAYMENT_VARIANT[a.paymentStatus]}>
                  {PAYMENT_LABEL[a.paymentStatus]}
                </Badge>
                {a.paymentStatus === "COMPLETED" && a.paidAmount != null && (
                  <span className="text-[11px] text-green-400 font-mono">
                    {a.paidAmount} ₪{a.invoiceNumber ? ` · #${a.invoiceNumber}` : ""}
                  </span>
                )}
                {a.client && (
                  <Link
                    href={`/admin/clients/${a.client.id}`}
                    className="text-[11px] text-cyan hover:underline truncate max-w-[40%]"
                    title={`כרטיס לקוח: ${a.client.name}`}
                  >
                    🔗 {a.client.name}
                  </Link>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                <span>נוצר: {new Date(a.createdAt).toLocaleDateString("he-IL")}</span>
                {a.signedAt && (
                  <span>נחתם: {new Date(a.signedAt).toLocaleDateString("he-IL")}</span>
                )}
                {a.oneTimeFee != null && (
                  <span>הקמה: {a.oneTimeFee} ₪</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-800">
                <button
                  onClick={() => copyLink(a.signToken)}
                  className="text-cyan hover:text-cyan/80 text-xs font-medium"
                >
                  קישור חתימה
                </button>
                <button
                  onClick={() => setViewing(a)}
                  className="text-gray-300 hover:text-white text-xs font-medium"
                >
                  צפה
                </button>
                <a
                  href={`/api/agreements/${a.id}/download`}
                  className="text-pink hover:text-pink/80 text-xs font-medium"
                >
                  הורד
                </a>
                {a.paymentStatus !== "COMPLETED" && (
                  <button
                    onClick={() => copyPaymentLink(a)}
                    className={`text-xs font-medium ${
                      a.paymentStatus === "FAILED"
                        ? "text-yellow-400 hover:text-yellow-300"
                        : "text-green-400 hover:text-green-300"
                    }`}
                  >
                    {a.paymentStatus === "FAILED"
                      ? "🔄 צור לינק חדש"
                      : a.paymentUrl
                      ? "לינק תשלום"
                      : "צור לינק תשלום"}
                  </button>
                )}
                {a.paymentStatus === "COMPLETED" && a.cardcomRecurringId == null && (
                  <button
                    onClick={() => retryRecurring(a)}
                    disabled={retryingId === a.id}
                    className="text-yellow-400 hover:text-yellow-300 disabled:opacity-50 text-xs font-medium"
                  >
                    {retryingId === a.id ? "מקים..." : "הקם הו״ק"}
                  </button>
                )}
                {(a.status === "DRAFT" || a.status === "SENT") &&
                  a.paymentStatus !== "COMPLETED" && (
                    <button
                      onClick={() => openCancellation(a)}
                      className="ml-auto text-red-400 hover:text-red-300 text-xs font-medium"
                    >
                      בטל הסכם
                    </button>
                  )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[160px]">שם הלקוח</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[140px]">שם עסק</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">מסלול</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">מחיר/חודש</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">הקמה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">סטטוס</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">תשלום</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-44">לקוח מקושר</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך יצירה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך חתימה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-44 sticky left-0 bg-gray-800 z-10 border-l border-gray-700 md:static md:border-l-0">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {agreements.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center text-gray-500 py-12">
                  עוד לא יצרת הסכמים
                </td>
              </tr>
            ) : (
              agreements.map((a) => (
                <tr
                  key={a.id}
                  id={`agreement-row-${a.id}`}
                  tabIndex={-1}
                  className="border-b border-gray-800 hover:bg-gray-800/50 group/row"
                >
                  <td className="px-3 py-2.5 text-white">{a.customerName}</td>
                  <td className="px-3 py-2.5 text-gray-300">{a.businessName || "—"}</td>
                  <td className="px-3 py-2.5">
                    {a.tier ? (
                      <Badge variant={TIER_VARIANT[a.tier]}>{TIER_LABEL[a.tier]}</Badge>
                    ) : (
                      <Badge variant="gray">מותאם</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-white">{a.monthlyPrice} ₪</td>
                  <td className="px-3 py-2.5 font-mono text-gray-300">{a.oneTimeFee ? `${a.oneTimeFee} ₪` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-start gap-0.5">
                      <Badge variant={PAYMENT_VARIANT[a.paymentStatus]}>
                        {PAYMENT_LABEL[a.paymentStatus]}
                      </Badge>
                      {a.paymentStatus === "COMPLETED" && a.paidAmount != null && (
                        <span className="text-[10px] text-green-400 font-mono">
                          {a.paidAmount} ₪
                          {a.invoiceNumber ? ` · #${a.invoiceNumber}` : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {relinkingId === a.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          autoFocus
                          defaultValue={a.client?.id ?? ""}
                          disabled={savingLinkFor === a.id}
                          onChange={(e) => updateAgreementClient(a.id, e.target.value || null)}
                          onBlur={() => setRelinkingId(null)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-pink"
                        >
                          <option value="">— ללא קישור —</option>
                          {clientsList.map((c) => (
                            <option key={c.id} value={c.id}>
                              #{c.number} {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : a.client ? (
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/clients/${a.client.id}`}
                          className="text-cyan hover:underline truncate"
                          title={`פתח כרטיס לקוח: ${a.client.name}`}
                        >
                          {a.client.name}
                        </Link>
                        <button
                          onClick={() => setRelinkingId(a.id)}
                          className="text-gray-500 hover:text-pink text-[10px]"
                          title="שנה קישור"
                          aria-label="שנה קישור"
                        >
                          ✎
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRelinkingId(a.id)}
                        className="text-gray-500 hover:text-pink underline-offset-2 hover:underline"
                      >
                        + קשר ללקוח
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">
                    {new Date(a.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">
                    {a.signedAt ? new Date(a.signedAt).toLocaleDateString("he-IL") : "—"}
                  </td>
                  <td className="px-3 py-2.5 sticky left-0 bg-gray-950 group-hover/row:bg-gray-800 z-10 border-l border-gray-800 md:static md:border-l-0 md:bg-transparent">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyLink(a.signToken)}
                        className="text-cyan hover:text-cyan/80 text-xs underline-offset-2 hover:underline"
                      >
                        העתק קישור
                      </button>
                      <button
                        onClick={() => setViewing(a)}
                        className="text-gray-300 hover:text-white text-xs underline-offset-2 hover:underline"
                      >
                        צפה
                      </button>
                      <a
                        href={`/api/agreements/${a.id}/download`}
                        className="text-pink hover:text-pink/80 text-xs underline-offset-2 hover:underline"
                      >
                        הורד
                      </a>
                      {a.paymentStatus !== "COMPLETED" && (
                        <button
                          onClick={() => copyPaymentLink(a)}
                          className={`text-xs underline-offset-2 hover:underline ${
                            a.paymentStatus === "FAILED"
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-green-400 hover:text-green-300"
                          }`}
                          title={
                            a.paymentStatus === "FAILED"
                              ? "התשלום הקודם נכשל — צור לינק חדש לשליחה ללקוח"
                              : a.paymentUrl
                              ? "העתק לינק תשלום קיים"
                              : "צור לינק תשלום"
                          }
                        >
                          {a.paymentStatus === "FAILED"
                            ? "🔄 צור לינק חדש"
                            : a.paymentUrl
                            ? "העתק לינק תשלום"
                            : "צור לינק תשלום"}
                        </button>
                      )}
                      {a.paymentStatus === "COMPLETED" && a.cardcomRecurringId == null && (
                        <button
                          onClick={() => retryRecurring(a)}
                          disabled={retryingId === a.id}
                          className="text-yellow-400 hover:text-yellow-300 disabled:opacity-50 text-xs underline-offset-2 hover:underline"
                          title="הסכם שולם אך לא נוצרה הוראת קבע — נסה שוב"
                        >
                          {retryingId === a.id ? "מקים..." : "הקם הו״ק"}
                        </button>
                      )}
                      {(a.status === "DRAFT" || a.status === "SENT") &&
                        a.paymentStatus !== "COMPLETED" && (
                          <button
                            onClick={() => openCancellation(a)}
                            className="text-red-400 hover:text-red-300 text-xs underline-offset-2 hover:underline"
                          >
                            בטל הסכם
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="הסכם חדש">
        <form onSubmit={handleCreate} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm text-gray-400 mb-2">סוג ההסכם *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {(["LANDING", "BASIC", "ADVANCED", "PREMIUM", "CUSTOM"] as TierChoice[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickTier(t)}
                  className={`px-3 py-3 rounded-xl border text-sm font-bold transition-colors ${
                    tierChoice === t
                      ? "border-pink bg-pink/15 text-white"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div>{t === "CUSTOM" ? "מותאם" : TIER_LABEL[t]}</div>
                  <div className="text-xs font-normal mt-0.5 opacity-80">
                    {t === "CUSTOM" ? "הזן מחיר" : `${TIER_PRICE[t]} ₪`}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              {tierChoice === "CUSTOM"
                ? "מסלול מותאם — מחיר וסעיפים נקבעים על-ידך. הוסף סעיפים למטה לתיאור השירות."
                : "המסלול קובע את רשימת השירותים הסטנדרטית. ניתן להוסיף סעיפים נוספים מתחת."}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">סעיפים נוספים בהסכם</label>
            <div className="flex gap-2">
              <input
                value={newClause}
                onChange={(e) => setNewClause(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addClause();
                  }
                }}
                placeholder="לדוגמה: אינטגרציה עם מערכת CRM של הלקוח"
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
              <button
                type="button"
                onClick={addClause}
                className="shrink-0 px-3 py-2 bg-cyan/20 hover:bg-cyan/30 text-cyan text-sm font-bold rounded-xl transition-colors"
              >
                + הוסף
              </button>
            </div>
            {additionalServices.length > 0 && (
              <ul className="mt-2 space-y-1">
                {additionalServices.map((clause, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-xl text-sm text-white"
                  >
                    <span className="flex-1">• {clause}</span>
                    <button
                      type="button"
                      onClick={() => removeClause(i)}
                      className="shrink-0 text-gray-500 hover:text-red-400 text-xs"
                      aria-label="הסר סעיף"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">תשלום חודשי לפני מע״מ (₪) *</label>
              <input
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                required
                inputMode="numeric"
                placeholder="1500"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">סכום הקמה חד-פעמי לפני מע״מ (₪)</label>
              <input
                value={oneTimeFee}
                onChange={(e) => setOneTimeFee(e.target.value)}
                inputMode="numeric"
                placeholder="אופציונלי"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 -mt-1">
            {isForeign
              ? "לקוח חו״ל: המחירים נרשמים בש״ח ללא מע״מ (עסקה בשיעור מע״מ אפס). החוזה והחיוב ב-Cardcom יהיו ללא מע״מ."
              : "המחירים נרשמים לפני מע״מ. החוזה והחיוב ב-Cardcom יוסיפו מע״מ אוטומטית."}
          </p>

          {/* Foreign client toggle — English contract + English Cardcom page + zero-rate VAT */}
          <button
            type="button"
            onClick={() => setIsForeign((v) => !v)}
            aria-pressed={isForeign}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors text-right ${
              isForeign
                ? "border-cyan bg-cyan/10"
                : "border-gray-700 bg-gray-800/40 hover:border-gray-600"
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-white">לקוח חו״ל 🌍</span>
              <span className="block text-[11px] text-gray-400 mt-0.5">
                חוזה ודף תשלום באנגלית + ללא מע״מ (יצוא שירות, מע״מ אפס). חיוב נשאר בש״ח.
              </span>
            </span>
            <span
              className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${
                isForeign ? "bg-cyan" : "bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  isForeign ? "right-0.5" : "right-5"
                }`}
              />
            </span>
          </button>
          {isForeign && (
            <p className="text-[11px] text-amber-500/90 -mt-1 leading-relaxed">
              ⚠️ מע״מ אפס תקף רק אם הלקוח באמת תושב חוץ והשירות אינו ניתן בפועל גם
              לישראלי. יש לאמת זכאות מול רו״ח ולתעד (סעיף 30(א)(5) לחוק מע״מ).
              שים לב: &quot;סעיפים נוספים&quot; שתוסיף ייכנסו לחוזה כפי שהם — כתוב
              אותם <span className="font-bold">באנגלית</span>.
            </p>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">קישור ללקוח קיים (אופציונלי)</label>
            <select
              value={clientId}
              onChange={(e) => onPickClient(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
            >
              <option value="">— ללא קישור (יווצר/יקושר אוטומטית בעת חתימה) —</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.number} {c.name}{c.businessName ? ` · ${c.businessName}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              בחירה תמלא אוטומטית פרטים ריקים מהלקוח. אם תשאיר ריק, בעת חתימה הלקוח ייווצר/יקושר אוטומטית לפי האימייל/טלפון.
            </p>
          </div>

          {clientId && contactProfilesFor(clientId).length > 1 ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">איש קשר / חברה</label>
              <select
                value={contactKey}
                onChange={(e) => applyContactProfile(clientId, e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              >
                <option value="">— בחר את מי שההסכם נחתם מולו —</option>
                {contactProfilesFor(clientId).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.customerName}
                    {p.businessName ? ` · ${p.businessName}` : ""}
                    {p.email ? ` · ${p.email}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                ללקוח הזה יש כמה זהויות חתימה (מהסכמים קודמים). בחירה ממלאת שם,
                עסק, ח.פ., טלפון ואימייל — אפשר לערוך אחרי המילוי.
              </p>
            </div>
          ) : null}

          {clientId ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">שיוך למוצר</label>
              <select
                value={productChoice}
                onChange={(e) => setProductChoice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              >
                <option value="new">➕ מוצר חדש</option>
                {(clientsList.find((c) => c.id === clientId)?.products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.monthlyAmount != null ? ` · ₪${p.monthlyAmount}` : ""}
                    {p.agreementId ? " · כבר מקושר להסכם" : ""}
                  </option>
                ))}
                <option value="">— ללא שיוך —</option>
              </select>
              {productChoice === "new" ? (
                <input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="שם המוצר החדש (למשל: חנות, מערכת ניהול)"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
                />
              ) : null}
              <p className="text-[11px] text-gray-500 mt-1">
                כשהתשלום הראשון ייקלט, המוצר המשויך יסומן &quot;בוצע&quot; אוטומטית, יקבל
                חודש כניסה, וה-MRR יתעדכן. בלי שיוך — תצטרך לסמן ידנית.
              </p>
            </div>
          ) : null}

          <div>
            <label className="block text-sm text-gray-400 mb-1">שם מלא *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              minLength={1}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">שם העסק</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ח.פ. / ע.מ.</label>
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">טלפון *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                minLength={9}
                inputMode="tel"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">אימייל *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white outline-none focus:border-pink"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2 sticky bottom-0 -mx-1 px-1 pb-1 bg-gray-900/95 backdrop-blur-sm">
            <button
              type="submit"
              disabled={creating || !customerName.trim() || !phone.trim() || !email.trim() || !monthlyPrice.trim()}
              className="flex-1 bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold py-3 sm:py-2.5 rounded-xl transition-colors text-base sm:text-sm"
            >
              {creating ? "יוצר..." : "צור הסכם"}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-5 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl text-base sm:text-sm"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={cancelTarget !== null}
        onClose={closeCancellation}
        title={cancelTarget ? `ביטול הסכם — ${cancelTarget.customerName}` : ""}
      >
        {cancelTarget && (
          <div className="space-y-4" dir="rtl">
            <p className="text-sm text-gray-300">
              ההסכם יסומן כמבוטל, אך יישאר בהיסטוריית המכירה יחד עם כל האירועים
              שכבר נרשמו.
            </p>
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                סיבת הביטול *
              </label>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                autoFocus
                placeholder="לדוגמה: הלקוח החליט שלא להתקדם"
                className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-base text-white outline-none focus:border-pink sm:text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancellation}
                disabled={cancelling || cancelReason.trim().length < 3}
                className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {cancelling ? "מבטל..." : "אשר ביטול"}
              </button>
              <button
                type="button"
                onClick={closeCancellation}
                disabled={cancelling}
                className="rounded-xl border border-gray-700 px-4 text-gray-300 hover:border-gray-600 disabled:opacity-50"
              >
                חזרה
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View modal */}
      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `הסכם — ${viewing.customerName}` : ""}
      >
        {viewing && (
          <iframe
            srcDoc={viewing.content}
            sandbox=""
            title="תצוגת הסכם"
            className="w-full bg-white rounded-xl border border-gray-700"
            style={{ height: "60vh" }}
          />
        )}
      </Modal>

      {/* Link share modal — used when clipboard write requires a fresh gesture */}
      <Modal
        isOpen={linkModal !== null}
        onClose={() => setLinkModal(null)}
        title={linkModal?.title ?? ""}
      >
        {linkModal && (
          <div className="space-y-4" dir="rtl">
            <p className="text-sm text-gray-400">
              לחץ על &quot;העתק&quot; או סמן ידנית והעתק.
            </p>
            <input
              type="text"
              value={linkModal.url}
              readOnly
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-pink"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyFromModal}
                className="flex-1 bg-pink hover:bg-pink-light text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                העתק
              </button>
              <button
                type="button"
                onClick={() => setLinkModal(null)}
                className="px-4 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl"
              >
                סגור
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </PullToRefresh>
  );
}
