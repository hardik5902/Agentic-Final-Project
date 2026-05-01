import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatInterface, { ChatMessage } from "../components/ChatInterface";
import CriteriaBuilder, { getDefaultCriteria } from "../components/CriteriaBuilder";
import PortalShell from "../components/PortalShell";
import RFQPreview from "../components/RFQPreview";
import SupplierTable from "../components/SupplierTable";
import { useApproveRFQ, useSendRFQMessage, useStartRFQ } from "../hooks/useRFQ";
import { useSuppliers } from "../hooks/useSuppliers";
import { Criterion } from "../types";

export default function NewRFQ() {
  const navigate = useNavigate();
  const [draftMessage, setDraftMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rfqId, setRfqId] = useState<string | undefined>();
  const [rfqDocument, setRfqDocument] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>(getDefaultCriteria());
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: suppliers } = useSuppliers();
  const startRFQ = useStartRFQ();
  const sendMessage = useSendRFQMessage(rfqId);
  const approveRFQ = useApproveRFQ(rfqId);

  const canApprove = Boolean(rfqDocument && rfqId && selectedSuppliers.length);
  const totalWeight = useMemo(
    () => criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    [criteria],
  );

  const pushBuyerMessage = (text: string) => {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "buyer", text }]);
  };

  const pushAssistantMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "assistant", text },
    ]);
  };

  const handleSend = async () => {
    const text = draftMessage.trim();
    if (!text) return;

    setNotice(null);
    pushBuyerMessage(text);
    setDraftMessage("");

    try {
      if (!rfqId) {
        const response = await startRFQ.mutateAsync(text);
        setRfqId(response.rfq_id);
        pushAssistantMessage(response.question);
        return;
      }

      const response = await sendMessage.mutateAsync(text);
      if (response.question) pushAssistantMessage(response.question);
      if (response.rfq_document) {
        setRfqDocument(response.rfq_document);
        pushAssistantMessage("The RFQ document is ready for review on the right.");
      }
    } catch {
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
      navigate(`/rfq/${rfqId}`);
    } catch {
      setNotice("Approval failed. Check the supplier list and try again.");
    }
  };

  return (
    <PortalShell
      title="Create a new RFQ"
      eyebrow="Capture the sourcing need through a guided conversation, review the generated document, then invite the right suppliers."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <ChatInterface
            messages={messages}
            value={draftMessage}
            onChange={setDraftMessage}
            onSubmit={handleSend}
            disabled={startRFQ.isPending || sendMessage.isPending}
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
          <RFQPreview title="Draft RFQ" document={rfqDocument} />
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
