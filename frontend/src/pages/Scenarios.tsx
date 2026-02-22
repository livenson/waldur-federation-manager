import { useState } from 'react';
import { Play, CheckCircle, XCircle, AlertTriangle, Server, Loader2 } from 'lucide-react';
import { useScenarios, useRunScenario } from '../hooks/useScenarios';
import type { ScenarioMeta, ScenarioRunResponse, ScenarioStepStatus } from '../api/types';

function StepIcon({ status }: { status: ScenarioStepStatus }) {
  switch (status) {
    case 'passed':
      return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'skipped':
      return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  }
}

function OverallBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    passed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    partial: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function ScenarioCard({
  scenario,
  result,
  isRunning,
  onRun,
}: {
  scenario: ScenarioMeta;
  result?: ScenarioRunResponse;
  isRunning: boolean;
  onRun: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{scenario.name}</h3>
            {scenario.requires_mock_instances && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                <Server className="w-3 h-3" />
                mock instances
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Run
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <OverallBadge status={result.status} />
            <span className="text-[11px] text-gray-400">{result.duration_ms.toFixed(1)} ms</span>
          </div>
          <div className="space-y-1.5">
            {result.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <StepIcon status={step.status} />
                <div className="min-w-0">
                  <span className="font-medium text-gray-700">{step.name}</span>
                  <span className="text-gray-400 ml-1.5">{step.detail}</span>
                  <span className="text-gray-300 ml-1">({step.duration_ms.toFixed(1)} ms)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scenarios() {
  const { data, isLoading } = useScenarios();
  const runScenario = useRunScenario();
  const [results, setResults] = useState<Record<string, ScenarioRunResponse>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const result = await runScenario.mutateAsync(id);
      setResults((prev) => ({ ...prev, [id]: result }));
    } finally {
      setRunningId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const scenarios = data?.scenarios ?? [];
  const categories = [...new Set(scenarios.map((s) => s.category))];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scenarios</h1>
        <p className="text-gray-500 text-sm mt-1">
          Run predefined federation scenarios to test workflows and security
        </p>
      </div>

      {/* Debug warning banner */}
      <div className="rounded-lg p-4 mb-6 bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Debug mode</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Scenarios create test data prefixed with [Scenario]. Federation and security
              scenarios require running mock Waldur instances.
            </p>
          </div>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {scenarios
              .filter((s) => s.category === category)
              .map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  result={results[scenario.id]}
                  isRunning={runningId === scenario.id}
                  onRun={() => handleRun(scenario.id)}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
