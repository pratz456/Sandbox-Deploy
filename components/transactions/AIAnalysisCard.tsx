'use client';

type AI = {
  status_label?: string | null;
  score_pct?: number | null; // 0..100
  reasoning?: string | null;
  irs?: { publication?: string|null; section?: string|null } | null;
  required_docs?: string[];
  category_hint?: string | null;
  risk_flags?: string[];
  last_analyzed_at?: number | null;
};

export default function AIAnalysisCard({ ai }: { ai: AI | null | undefined }) {
  if (!ai) return null;
  const pct = typeof ai.score_pct === 'number' ? Math.max(0, Math.min(100, ai.score_pct)) : null;

  return (
    <div className="rounded-2xl border bg-white p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Analysis</h3>
        <span className="text-sm text-muted-foreground">{ai.status_label ?? '—'}</span>
      </div>

      {/* Progress */}
      {typeof pct === 'number' && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-sm">
            <span>Deduction Status</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded bg-neutral-200">
            <div
              className="h-2 rounded bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Reasoning */}
      {ai.reasoning && (
        <div className="mt-5">
          <div className="font-medium mb-1">Reasoning</div>
          <p className="text-sm text-muted-foreground">{ai.reasoning}</p>
        </div>
      )}

      {/* IRS Reference */}
      {(ai.irs?.publication || ai.irs?.section) && (
        <div className="mt-5">
          <div className="font-medium mb-1">IRS Reference</div>
          <div className="text-sm text-muted-foreground">
            {ai.irs?.publication ? `Publication: ${ai.irs.publication}` : null}
            {ai.irs?.publication && ai.irs?.section ? ' • ' : null}
            {ai.irs?.section ? `Section: ${ai.irs.section}` : null}
          </div>
        </div>
      )}

      {/* Required Docs */}
      {ai.required_docs && ai.required_docs.length > 0 && (
        <div className="mt-5">
          <div className="font-medium mb-1">Required Documentation</div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {ai.required_docs.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}

      {/* Hints / Risks */}
      {(ai.category_hint || (ai.risk_flags && ai.risk_flags.length)) && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {ai.category_hint && (
            <div>
              <div className="font-medium mb-1">Suggested Category</div>
              <div className="text-sm text-muted-foreground">{ai.category_hint}</div>
            </div>
          )}
          {ai.risk_flags && ai.risk_flags.length > 0 && (
            <div>
              <div className="font-medium mb-1">Risk Flags</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {ai.risk_flags.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {ai.last_analyzed_at && (
        <div className="mt-6 text-xs text-muted-foreground">
          Last analyzed: {new Date(ai.last_analyzed_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

