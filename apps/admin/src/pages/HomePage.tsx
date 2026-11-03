import React from "react";
import {
  Vote,
  Users,
  Shield,
  Activity,
  Boxes,
  GitFork,
  Search,
  Compass,
  ArrowRight,
  Fingerprint,
  FileCheck2,
  Lock,
  Layers
} from "lucide-react";

interface HomePageProps {
  onNavigate: (route: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const portalCards = [
    {
      title: "Voter Check-in Booth",
      subtitle: "Stage 1: Identification & Token Dispenser",
      description:
        "Authenticate eligible voters via RPIC contactless smart cards and live real-time neural face detection to issue cryptographic single-use voting tokens.",
      icon: Fingerprint,
      route: "booth-checkin",
      badge: "Voter Terminal",
      color: "border-blue-200 hover:border-blue-400 bg-blue-50/30 text-blue-700"
    },
    {
      title: "Secret Ballot Casting",
      subtitle: "Stage 2: Choice Encryption & Signing",
      description:
        "Select candidate choices, compute salted cryptographic commitments, and sign ballots with single-use voter ephemeral Ed25519 keys.",
      icon: Vote,
      route: "booth-ballot",
      badge: "Voting Booth",
      color: "border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 text-indigo-700"
    },
    {
      title: "Ballot Certificate & Receipt",
      subtitle: "Stage 3: Cryptographic Audit Certificate",
      description:
        "View and download signed vote proof certificates containing Block Hash, Merkle Leaf Hash, and Transaction UUID for voter self-verification.",
      icon: FileCheck2,
      route: "booth-receipt",
      badge: "Receipt",
      color: "border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 text-emerald-700"
    },
    {
      title: "Candidate Scrutineer Portal",
      subtitle: "Statutory Observer & Audit Rights",
      description:
        "Official observer interface with Level 3 cryptographic verification rights, live ledger inspection, dispute filing, and inclusion proof checkers.",
      icon: Users,
      route: "candidate",
      badge: "Candidate Auditor",
      color: "border-amber-200 hover:border-amber-400 bg-amber-50/30 text-amber-700"
    },
    {
      title: "Presiding Officer Admin",
      subtitle: "District Level Ledger Controls",
      description:
        "District administrative portal for election officers. Monitor voter turnout, seal district batches, and inspect validator consensus quorum.",
      icon: Lock,
      route: "admin",
      badge: "Admin Officer",
      color: "border-slate-300 hover:border-slate-500 bg-slate-50 text-slate-800"
    },
    {
      title: "Live System Diagnostics",
      subtitle: "Hardware & Consensus Telemetry",
      description:
        "Real-time diagnostic metrics: microsecond database query latency, browser-to-server ping, connected camera sensors, and memory allocation.",
      icon: Activity,
      route: "system-check",
      badge: "Live Telemetry",
      color: "border-teal-200 hover:border-teal-400 bg-teal-50/30 text-teal-700"
    },
    {
      title: "Blockchain Block Explorer",
      subtitle: "Immutable Ledger Inspector",
      description:
        "Browse blocks in the national election chain. Inspect previous block hashes, Merkle root hashes, transaction counts, and validator signatures.",
      icon: Boxes,
      route: "blocks",
      badge: "Ledger",
      color: "border-sky-200 hover:border-sky-400 bg-sky-50/30 text-sky-700"
    },
    {
      title: "Merkle Tree Tree Visualizer",
      subtitle: "Cryptographic Inclusion Proofs",
      description:
        "Inspect hierarchical SHA-256 Merkle trees for each block, tracing leaf transaction hashes up to the immutable root state.",
      icon: GitFork,
      route: "merkle-tree",
      badge: "Cryptography",
      color: "border-purple-200 hover:border-purple-400 bg-purple-50/30 text-purple-700"
    },
    {
      title: "Public Receipt Verifier",
      subtitle: "Zero-Knowledge Inclusion Check",
      description:
        "Verify any ballot receipt independently using its Transaction UUID and Block Hash against the live published blockchain.",
      icon: Search,
      route: "verifier",
      badge: "Verification",
      color: "border-blue-200 hover:border-blue-400 bg-blue-50/30 text-blue-700"
    },
    {
      title: "10-Stage Protocol Architecture",
      subtitle: "Interactive Architecture Simulator",
      description:
        "Hands-on interactive simulator of the 10 protocol stages—from biometric verification to multi-party validator synchronization with safeguard disruption tests.",
      icon: Compass,
      route: "explanation",
      badge: "Technical Specs",
      color: "border-violet-200 hover:border-violet-400 bg-violet-50/30 text-violet-700"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
            <Shield className="h-3.5 w-3.5" />
            National Election Cryptographic Consensus System
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Election Operations & Verification Portal
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Welcome to the secure election operational gateway. Select a dedicated terminal below to enter your operational role, inspect live ledger blocks, or run cryptographic checks. Each portal operates on its own dedicated URL and keeps you on that page without unexpected redirects.
          </p>
        </div>
      </div>

      {/* Grid of Dedicated Services */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
            Available Terminals & Protocols
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            10 Dedicated Modules
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {portalCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.route}
                onClick={() => onNavigate(card.route)}
                className="group relative bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-5 shadow-2xs hover:shadow-sm transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center border ${card.color}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {card.title}
                  </h3>
                  <div className="text-2xs font-semibold text-slate-400 mb-2">
                    {card.subtitle}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {card.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition">
                  <span>Open Terminal</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
