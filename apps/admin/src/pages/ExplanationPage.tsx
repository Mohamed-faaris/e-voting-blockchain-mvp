import React from "react";
import { Compass } from "lucide-react";
import { ExaminerFlow } from "../components/ExaminerFlow";

export const ExplanationPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Compass className="h-6 w-6 text-blue-600" />
          Blockchain Voting System — Architectural Explanation
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Ten stages taking one ballot from voter identification to national ledger synchronization. Test and break safeguards on purpose to observe detection.
        </p>
      </div>

      <ExaminerFlow />
    </div>
  );
};
