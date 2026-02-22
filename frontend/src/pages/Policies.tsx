import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, ShieldCheck, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { usePolicies, useDeletePolicy, useEvaluatePolicy } from '../hooks/usePolicies';
import { HelpBanner } from '../components/HelpTip';
import ConfirmDialog from '../components/ConfirmDialog';
import type { PolicyEvaluationResponse } from '../api/types';

export default function Policies() {
  const { data, isLoading } = usePolicies();
  const deletePolicy = useDeletePolicy();
  const evaluatePolicy = useEvaluatePolicy();
  const policies = data?.policies ?? [];
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [evaluationResults, setEvaluationResults] = useState<Record<string, PolicyEvaluationResponse>>({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [expandedViolations, setExpandedViolations] = useState<Record<string, boolean>>({});

  const handleEvaluate = (policyId: string) => {
    setEvaluatingId(policyId);
    evaluatePolicy.mutate(policyId, {
      onSuccess: (result) => {
        setEvaluationResults((prev) => ({ ...prev, [policyId]: result }));
        setEvaluatingId(null);
      },
      onError: () => {
        setEvaluatingId(null);
      },
    });
  };

  const toggleViolation = (entityId: string) => {
    setExpandedViolations((prev) => ({ ...prev, [entityId]: !prev[entityId] }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metadata Policies</h1>
          <p className="text-gray-500 text-sm mt-1">Define and manage metadata policy constraints</p>
        </div>
        <Link to="/policies/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Policy
        </Link>
      </div>

      <HelpBanner className="mb-6">
        <strong>Metadata policies</strong> let a federation operator constrain or normalise the metadata that subordinate entities can publish.
        When a trust chain is resolved, policies are applied top-down — each authority in the chain can tighten (but not relax) the constraints set by its parent.
        Policies use <strong>operators</strong> like <code className="bg-blue-100 px-1 rounded">subset_of</code>, <code className="bg-blue-100 px-1 rounded">superset_of</code>, <code className="bg-blue-100 px-1 rounded">one_of</code>, <code className="bg-blue-100 px-1 rounded">default</code>, and <code className="bg-blue-100 px-1 rounded">essential</code> to control which values are allowed for each metadata claim.
        Each policy targets a specific <strong>entity type</strong> (e.g., OpenID Provider) and is applied only to entities of that type during chain resolution.
      </HelpBanner>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No policies defined yet</p>
          <Link to="/policies/new" className="text-indigo-600 text-sm hover:underline mt-1 inline-block">
            Create your first policy
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map(policy => {
            const evalResult = evaluationResults[policy.id];
            const isEvaluating = evaluatingId === policy.id;

            return (
              <div key={policy.id} className="bg-white rounded-lg shadow p-5 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 whitespace-nowrap ml-2">
                    {policy.entity_type.replace(/_/g, ' ')}
                  </span>
                </div>
                {policy.description && (
                  <p className="text-sm text-gray-500 mb-3">{policy.description}</p>
                )}
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32 mb-3">
                  {JSON.stringify(policy.policy, null, 2)}
                </pre>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>Updated {new Date(policy.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <Link to={`/policies/${policy.id}`} className="text-indigo-600 hover:underline">Edit</Link>
                    <button
                      onClick={() => setDeleteTarget({ id: policy.id, name: policy.name })}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Compliance check button */}
                <div className="border-t pt-3 mt-auto">
                  {!evalResult && !isEvaluating && (
                    <button
                      onClick={() => handleEvaluate(policy.id)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Check Compliance
                    </button>
                  )}

                  {isEvaluating && (
                    <div className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                      Evaluating...
                    </div>
                  )}

                  {evalResult && !isEvaluating && (
                    <div>
                      {/* Summary */}
                      {evalResult.total_entities === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-1">
                          No entities of type <span className="font-medium">{policy.entity_type.replace(/_/g, ' ')}</span> found
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {evalResult.compliant}/{evalResult.total_entities} entities compliant
                            </span>
                            <button
                              onClick={() => handleEvaluate(policy.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Re-check
                            </button>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                            <div
                              className={`h-2 rounded-full transition-all ${evalResult.non_compliant === 0 ? 'bg-green-500' : 'bg-green-500'}`}
                              style={{ width: `${(evalResult.compliant / evalResult.total_entities) * 100}%` }}
                            />
                            {evalResult.non_compliant > 0 && (
                              <div
                                className="h-2 rounded-r-full bg-red-400 -mt-2"
                                style={{
                                  width: `${(evalResult.non_compliant / evalResult.total_entities) * 100}%`,
                                  marginLeft: `${(evalResult.compliant / evalResult.total_entities) * 100}%`,
                                }}
                              />
                            )}
                          </div>

                          {/* Results list */}
                          <div className="space-y-1.5 max-h-60 overflow-auto">
                            {evalResult.results.map((result) => (
                              <div key={result.entity_id}>
                                <div
                                  className={`flex items-center justify-between text-sm px-2 py-1.5 rounded ${
                                    result.status === 'compliant'
                                      ? 'bg-green-50'
                                      : result.status === 'non_compliant'
                                        ? 'bg-red-50'
                                        : 'bg-yellow-50'
                                  }`}
                                >
                                  <span className="text-gray-800 truncate mr-2">{result.entity_name}</span>
                                  {result.status === 'compliant' ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : result.status === 'non_compliant' ? (
                                    <button
                                      onClick={() => toggleViolation(result.entity_id)}
                                      className="flex items-center gap-1 text-red-600 flex-shrink-0"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      {expandedViolations[result.entity_id]
                                        ? <ChevronUp className="w-3 h-3" />
                                        : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                  )}
                                </div>
                                {result.violations.length > 0 && expandedViolations[result.entity_id] && (
                                  <div className="ml-2 mt-1 space-y-0.5">
                                    {result.violations.map((v, i) => (
                                      <p key={i} className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                                        {v}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePolicy.mutate(deleteTarget.id);
        }}
        title="Delete Policy"
        description={deleteTarget
          ? `Delete the policy "${deleteTarget.name}"? This will permanently remove the metadata constraints defined in this policy. Any subordinate statements that were using this policy will no longer have these constraints applied during trust chain resolution.`
          : ''}
        confirmText="Delete Policy"
        variant="danger"
      />
    </div>
  );
}
