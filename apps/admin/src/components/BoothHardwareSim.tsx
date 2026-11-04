import React, { useEffect, useState } from "react";
import { Radio, Scan } from "lucide-react";
import { api } from "@evoting/api-client";
import type { Voter } from "@evoting/contracts";
import { FaceVerificationPanel } from "./FaceVerificationPanel";

interface BoothHardwareSimProps {
  onCardTapped: (voterId: string) => void;
  onLivenessVerified: () => void;
  onFaceModeChange?: (enabled: boolean) => void;
}

export const BoothHardwareSim: React.FC<BoothHardwareSimProps> = ({
  onCardTapped,
  onLivenessVerified,
  onFaceModeChange
}) => {
  const [rfidActive, setRfidActive] = useState(false);
  const [faceCheckEnabled, setFaceCheckEnabled] = useState(false);
  const [pendingVoterId, setPendingVoterId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [demoCards, setDemoCards] = useState<Voter[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [cardLoadError, setCardLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.voters()
      .then(({ voters }) => {
        const unvotedDemoVoters = voters
          .filter((voter) => voter.voterId.startsWith("DEMO-") && !voter.hasVoted)
          .sort((a, b) => a.voterId.localeCompare(b.voterId, undefined, { numeric: true }));
        setDemoCards(unvotedDemoVoters);
      })
      .catch((err) => {
        setCardLoadError(err instanceof Error ? err.message : "Could not load demo voter cards.");
      })
      .finally(() => setLoadingCards(false));
  }, []);

  const handleTap = (card: Voter) => {
    setRfidActive(true);
    setActiveCard(card.voterId);
    window.setTimeout(() => {
      setRfidActive(false);
      if (faceCheckEnabled) setPendingVoterId(card.voterId);
      else onCardTapped(card.voterId);
    }, 400);
  };

  const handleFaceVerified = () => {
    if (!pendingVoterId) return;
    onLivenessVerified();
    onCardTapped(pendingVoterId);
    setPendingVoterId(null);
  };

  const handleFaceModeChange = (enabled: boolean) => {
    setFaceCheckEnabled(enabled);
    onFaceModeChange?.(enabled);
    if (!enabled && pendingVoterId) {
      onCardTapped(pendingVoterId);
      setPendingVoterId(null);
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Scan className="h-5 w-5 text-indigo-600" />
            Booth Peripheral Terminal
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Simulated 13.56 MHz contactless smartcard reader with optional local face verification.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800">RPIC Contactless Smartcard</span>
          </div>
          <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${rfidActive ? "animate-pulse bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
            {rfidActive ? "READING CARD..." : "POLLING 13.56 MHz"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">Tap an unvoted demo smartcard to simulate the physical booth reader:</p>
          <span className="shrink-0 font-mono text-[10px] text-slate-500">{demoCards.length.toLocaleString()} AVAILABLE</span>
        </div>

        {cardLoadError && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{cardLoadError}</p>}

        <div className="grid gap-2 sm:grid-cols-2">
          {loadingCards ? (
            <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">Loading demo smartcards…</p>
          ) : demoCards.length > 0 ? demoCards.slice(0, 6).map((card) => (
            <button
              key={card.voterId}
              type="button"
              onClick={() => handleTap(card)}
              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-xs transition ${activeCard === card.voterId ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
            >
              <span>
                <strong className="block">{card.name}</strong>
                <small className="font-mono text-[10px] text-slate-400">ID: {card.voterId}</small>
              </span>
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                {`RPIC-${card.voterId.replace(/^DEMO-/, "")}`}
              </span>
            </button>
          )) : (
            <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">No unvoted demo voters available. Run the database seed command to restore the demo roster.</p>
          )}
        </div>
      </div>

      {pendingVoterId && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          Smartcard read for <strong>{pendingVoterId}</strong>. Verify the enrolled face below to continue, or use the explicit fallback if the camera/service is unavailable.
        </p>
      )}
      <FaceVerificationPanel
        onVerified={handleFaceVerified}
        onEnabledChange={handleFaceModeChange}
      />
    </div>
  );
};
