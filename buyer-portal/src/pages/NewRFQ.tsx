import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ChatInterface, { ChatMessage } from "../components/ChatInterface";
import CriteriaBuilder, { getDefaultCriteria } from "../components/CriteriaBuilder";
import PortalShell from "../components/PortalShell";
import RFQPreview from "../components/RFQPreview";
import SupplierTable from "../components/SupplierTable";
import { useApproveRFQ, useRFQConversation, useSendRFQMessage, useStartRFQ, useSuggestSuppliers } from "../hooks/useRFQ";
import { useSuppliers } from "../hooks/useSuppliers";
import { Criterion } from "../types";

const SESSION_KEY = "new-rfq-draft";

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      rfqId: string;
      messages: ChatMessage[];
      rfqDocument: string | null;
    };
  } catch {
    return null;
  }
}

function saveDraft(rfqId: string, messages: ChatMessage[], rfqDocument: string | null) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ rfqId, messages, rfqDocument }));
  } catch {
    // storage full or unavailable — silent fail
  }
}

function clearDraft() {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function NewRFQ() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get("resume") ?? undefined;

  // If resuming, discard any stale sessionStorage draft and load from API instead
  const draft = resumeId ? null : loadDraft();

  const [draftMessage, setDraftMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(draft?.messages ?? []);
  const [rfqId, setRfqId] = useState<string | undefined>(draft?.rfqId ?? resumeId);
  const [rfqDocument, setRfqDocument] = useState<string | null>(draft?.rfqDocument ?? null);
  const [criteria, setCriteria] = useState<Criterion[]>(getDefaultCriteria());
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [notice, setNotice] = useState<string | null>(null);
  const [isGeneratingRFQ, setIsGeneratingRFQ] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [resumeLoaded, setResumeLoaded] = useState(!resumeId);

  // Load existing conversation when resuming a draft
  const conversationQuery = useRFQConversation(resumeId);
  useEffect(() => {
    if (!resumeId || !conversationQuery.data || resumeLoaded) return;
    const conv = conversationQuery.data;
    // Convert DB messages [{role, content}] → ChatMessage[]
    const restored: ChatMessage[] = (conv.messages ?? []).map((m) => ({
      id: crypto.randomUUID(),
      role: m.role === "user" ? "buyer" : ("assistant" as const),
      text: m.content,
    }));
    setMessages(restored);
    setRfqId(conv.rfq_id);
    if (conv.rfq_document) {
      setRfqDocument(conv.rfq_document);
      setShowSuggestions(true);
    }
    clearDraft();
    setResumeLoaded(true);
  }, [conversationQuery.data, resumeId, resumeLoaded]);

  const { data: suppliers } = useSuppliers();
  const startRFQ = useStartRFQ();
  const sendMessage = useSendRFQMessage(rfqId);
  const approveRFQ = useApproveRFQ(rfqId);
  const suggestSuppliersQuery = useSuggestSuppliers(rfqDocument && rfqId ? rfqId : undefined);

  const canApprove = Boolean(rfqDocument && rfqId && selectedSuppliers.length);
  const totalWeight = useMemo(
    () => criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    [criteria],
  );

  const handleSend = async () => {
    const text = draftMessage.trim();
    if (!text) return;

    setNotice(null);
    setDraftMessage("");

    try {
      if (!rfqId) {
        const withBuyer = [...messages, { id: crypto.randomUUID(), role: "buyer" as const, text }];
        setMessages(withBuyer);
        const response = await startRFQ.mutateAsync(text);
        const newId = response.rfq_id;
        setRfqId(newId);
        const withAssistant = [...withBuyer, { id: crypto.randomUUID(), role: "assistant" as const, text: response.question }];
        setMessages(withAssistant);
        saveDraft(newId, withAssistant, null);
        return;
      }

      const withBuyer = [...messages, { id: crypto.randomUUID(), role: "buyer" as const, text }];
      setMessages(withBuyer);
      const response = await sendMessage.mutateAsync(text);
      setIsGeneratingRFQ(false);

      let nextMessages = withBuyer;
      let nextDoc = rfqDocument;

      if (response.rfq_document) {
        nextDoc = response.rfq_document;
        setRfqDocument(nextDoc);
        setIsGeneratingRFQ(false);
        setShowSuggestions(true);
      }

      if (response.question) {
        nextMessages = [...withBuyer, { id: crypto.randomUUID(), role: "assistant" as const, text: response.question }];
        setMessages(nextMessages);
      } else if (response.rfq_document) {
        const msg = "Your RFQ draft is ready — review it on the right.";
        nextMessages = [...withBuyer, { id: crypto.randomUUID(), role: "assistant" as const, text: msg }];
        setMessages(nextMessages);
      }
      saveDraft(rfqId, nextMessages, nextDoc);
    } catch {
      setIsGeneratingRFQ(false);
      setNotice("The AI intake call failed. Try again in a moment.");
    }
  };

  const handleApprove = async () => {
    if (!canApprove || Math.round(totalWeight * 100) !== 100) {
      setNotice("Choose at least one supplier and make sure criteria total 100%.");
      return;
    }

    try {
      await approveRFQ.mutateAsync({
        supplier_ids: selectedSuppliers,
        deadline_days: deadlineDays,
        criteria,
      });
      clearDraft();
      navigate(`/rfq/${rfqId}`);
    } catch {
      setNotice("Approval failed. Check the supplier list and try again.");
    }
  };

  const suggestions = showSuggestions ? (suggestSuppliersQuery.data ?? []) : [];
  const chatDisabled = startRFQ.isPending || sendMessage.isPending || (Boolean(resumeId) && !resumeLoaded);

  return (
    <PortalShell
      title={resumeId ? "Edit draft RFQ" : "Create a new RFQ"}
      eyebrow="Capture the sourcing need through a guided conversation, review the generated document, then invite the right suppliers."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <ChatInterface
            messages={messages}
            value={draftMessage}
            onChange={setDraftMessage}
            onSubmit={handleSend}
            disabled={chatDisabled}
          />
          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-6 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">
                  Approval setup
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Deadline and supplier selection
                </h2>
                {suggestions.length > 0 ? (
                  <p className="mt-1 text-xs text-cyan-300/70">
                    AI has ranked suppliers by fit for this RFQ — recommended suppliers are highlighted.
                  </p>
                ) : rfqDocument && suggestSuppliersQuery.isLoading ? (
                  <p className="mt-1 text-xs text-slate-500">Ranking suppliers by fit…</p>
                ) : null}
              </div>
              <label className="text-sm text-slate-200">
                Deadline in days
                <input
                  type="number"
                  min={1}
                  value={deadlineDays}
                  onChange={(event) => setDeadlineDays(Number(event.target.value))}
                  className="mt-2 block w-28 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-white outline-none focus:border-cyan-300/70"
                />
              </label>
            </div>
            <div className="mt-5">
              <SupplierTable
                suppliers={suppliers?.items ?? []}
                selectedIds={selectedSuppliers}
                suggestions={suggestions}
                onToggle={(supplierId) =>
                  setSelectedSuppliers((current) =>
                    current.includes(supplierId)
                      ? current.filter((id) => id !== supplierId)
                      : [...current, supplierId],
                  )
                }
              />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <RFQPreview title="Draft RFQ" document={rfqDocument} isGenerating={isGeneratingRFQ} />
          <CriteriaBuilder criteria={criteria} onChange={setCriteria} />
          {notice ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {notice}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleApprove}
            disabled={!canApprove || approveRFQ.isPending}
            className="w-full rounded-full bg-amber-300 px-5 py-4 text-sm font-medium text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {approveRFQ.isPending ? "Sending invitations..." : "Approve and invite suppliers"}
          </button>
        </div>
      </div>
    </PortalShell>
  );
}
