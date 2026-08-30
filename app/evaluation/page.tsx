"use client"

import { useCallback, useEffect, useState } from "react"
import { api, ApiError } from "@/lib/api"
import type { EvaluationReport } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The owner's evaluation numbers, plainly.
 *
 * Deliberately unpolished: this page exists so the quality, timing and cost
 * questions are answerable from rows, not so it wins a design review. Two
 * rules it does hold to: every rate shows its denominator right beside it —
 * a 100% over three moments must read as three moments — and an empty
 * section says "no data yet" rather than a confident zero.
 *
 * The server answers 404 unless the signed-in address is named in its
 * EVAL_OWNER_EMAILS list; for everyone else this page reports itself
 * unavailable and nothing more.
 */

const BUCKETS = [
  { value: "", label: "Any length" },
  { value: "under_5m", label: "Under 5 min" },
  { value: "5m_to_20m", label: "5–20 min" },
  { value: "20m_to_60m", label: "20–60 min" },
  { value: "over_60m", label: "Over 60 min" },
]

function pct(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`
}

function seconds(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}s`
}

function usd(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(4)}`
}

/** One measured fact: label, value, and the denominator that earns it. */
function Row({ label, value, over }: { label: string; value: string; over?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="whitespace-nowrap text-[13px] font-medium tabular-nums">
        {value}
        {over && <span className="ml-1.5 font-normal text-muted-foreground/70">({over})</span>}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="mb-2 text-[15px] font-semibold tracking-tight">{title}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

export default function EvaluationPage() {
  const [report, setReport] = useState<EvaluationReport | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [provider, setProvider] = useState("")
  const [model, setModel] = useState("")
  const [promptVersion, setPromptVersion] = useState("")
  const [bucket, setBucket] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getEvaluation({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        provider: provider || undefined,
        model: model || undefined,
        promptVersion: promptVersion || undefined,
        durationBucket: bucket || undefined,
      })
      setReport(result)
      setUnavailable(false)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) setUnavailable(true)
      else setError(cause instanceof ApiError ? cause.message : "Could not load the report.")
    } finally {
      setLoading(false)
    }
  }, [from, to, provider, model, promptVersion, bucket])

  useEffect(() => {
    void load()
    // Once, on arrival; afterwards the Apply button is the refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (unavailable) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold">Not available</h1>
        <p className="text-sm text-muted-foreground">
          This page is not enabled for this account.
        </p>
      </main>
    )
  }

  const q = report?.quality
  const s = report?.searches
  const t = report?.timestamps
  const e = report?.economics

  const inputClass =
    "h-9 rounded-md border border-border bg-transparent px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring"

  return (
    <main className="mx-auto w-full max-w-[860px] px-5 py-8">
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Evaluation</h1>
        <p className="text-sm text-muted-foreground">
          Quality, timing and cost, measured from what actually happened. Small samples are shown as small samples.
        </p>
      </div>

      {/* Filters. Text inputs on purpose: provider/model/prompt values are
          discovered from the segments table below, then pasted here. */}
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Provider
          <input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="modal" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Model
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="openbmb/MiniCPM-V-4.6" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Prompt version
          <input value={promptVersion} onChange={(event) => setPromptVersion(event.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Video length
          <select value={bucket} onChange={(event) => setBucket(event.target.value)} className={inputClass}>
            {BUCKETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void load()} disabled={loading} className="h-9">
          {loading ? "Loading…" : "Apply"}
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {report && (
        <div className="flex flex-col gap-4">
          <Section title="Quality — are the moments useful?">
            <Row label="Moments returned" value={String(q!.momentsReturned)} />
            <Row label="Thumbs-up rate" value={pct(q!.thumbsUpRate)} over={`${q!.thumbsUp} of ${q!.momentsWithFeedback} rated`} />
            <Row label="Thumbs-down rate" value={pct(q!.thumbsDownRate)} over={`${q!.thumbsDown} of ${q!.momentsWithFeedback} rated`} />
            <Row label="Acceptance (moment became a kept clip)" value={pct(q!.acceptanceRate)} over={`${q!.clipsKept} of ${q!.momentsReturned}`} />
            {Object.keys(q!.reasons).length > 0 && (
              <Row
                label="Thumbs-down reasons"
                value={Object.entries(q!.reasons)
                  .map(([reason, count]) => `${reason} ×${count}`)
                  .join(" · ")}
              />
            )}
          </Section>

          <Section title="Searches — corrections and observed misses">
            <Row label="Searches completed" value={String(s!.searchesCompleted)} />
            <Row label="Correction rate (look again / are you sure)" value={pct(s!.correctionRate)} over={`${s!.searchesCorrected} of ${s!.searchesCompleted}`} />
            <Row label="Succeeded without correction" value={pct(s!.noCorrectionSuccessRate)} over={`of ${s!.searchesCompleted}`} />
            <Row
              label="Observed miss rate (said “missed what I wanted”)"
              value={pct(s!.observedMissRate)}
              over={`${s!.searchesMarkedMissed} of ${s!.searchesWithExplicitFeedback} with feedback`}
            />
          </Section>

          <Section title="Timestamps — how far off are the boundaries?">
            {t!.errors.editedClips === 0 ? (
              <p className="py-1 text-[13px] text-muted-foreground">
                No boundary edits recorded yet, so there is no ground truth to measure against. Numbers appear here
                once someone adjusts a clip&apos;s timing.
              </p>
            ) : (
              <>
                <Row label="Edited clips measured" value={String(t!.errors.editedClips)} />
                <Row label="Start MAE" value={seconds(t!.errors.startMaeSeconds)} />
                <Row label="End MAE" value={seconds(t!.errors.endMaeSeconds)} />
                <Row label="Boundary MAE" value={seconds(t!.errors.boundaryMaeSeconds)} />
                <Row label="Median boundary error" value={seconds(t!.errors.medianBoundaryErrorSeconds)} />
                <Row label="P90 boundary error" value={seconds(t!.errors.p90BoundaryErrorSeconds)} />
                <Row label="Both boundaries within ±1s" value={pct(t!.errors.withinSeconds["1"])} />
                <Row label="Within ±2s" value={pct(t!.errors.withinSeconds["2"])} />
                <Row label="Within ±3s" value={pct(t!.errors.withinSeconds["3"])} />
                <Row label="Within ±5s" value={pct(t!.errors.withinSeconds["5"])} />
                <Row label="Average start shift (signed)" value={seconds(t!.errors.averageStartShiftSeconds)} />
                <Row label="Average end shift (signed)" value={seconds(t!.errors.averageEndShiftSeconds)} />
              </>
            )}
            <div className="mt-2">
              <Row label="Accepted without edit" value={String(t!.states.acceptedWithoutEdit)} />
              <Row label="Edited and kept" value={String(t!.states.editedAndKept)} />
              <Row label="Generated, never reviewed" value={String(t!.states.generatedNeverReviewed)} />
              <Row label="Rejected" value={String(t!.states.rejected)} />
              <Row label="No-edit rate (among reviewed keeps)" value={pct(t!.noEditRate)} over={`${t!.states.acceptedWithoutEdit} of ${t!.states.acceptedWithoutEdit + t!.states.editedAndKept}`} />
            </div>
          </Section>

          <Section title="Economics — what an hour of source video costs">
            <Row label="Source video analyzed" value={`${e!.sourceVideoHoursAnalyzed.toFixed(2)} h`} over={`${e!.videosAnalyzed} videos`} />
            <Row label="Reported provider cost (actual)" value={usd(e!.actualReportedCostUsd)} />
            <Row
              label="Estimated Modal cost"
              value={usd(e!.estimatedModalCostUsd)}
              over={e!.modalRateUsdPerGpuHour === null ? "rate not configured" : `at $${e!.modalRateUsdPerGpuHour}/GPU·h`}
            />
            <Row label="Marginal cost per source hour" value={usd(e!.marginalCostPerSourceHourUsd)} />
            <Row label="Effective cost per source hour" value="see Modal dashboard" over="no billing API" />
            <Row label="Modal inference per source hour" value={e!.inferenceSecondsPerSourceHour === null ? "—" : `${e!.inferenceSecondsPerSourceHour.toFixed(1)}s`} />
            <Row label="Analysis time per source hour" value={e!.analysisMsPerSourceHour === null ? "—" : `${Math.round(e!.analysisMsPerSourceHour / 1000)}s`} />

            {e!.segments.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Provider</th>
                      <th className="py-1.5 pr-3 font-medium">Model</th>
                      <th className="py-1.5 pr-3 font-medium">Stage</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Calls</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Actual $</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Est. $</th>
                      <th className="py-1.5 text-right font-medium">GPU/latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e!.segments.map((segment) => (
                      <tr key={`${segment.provider}-${segment.model}-${segment.stage}`} className="border-b border-border/40">
                        <td className="py-1.5 pr-3">{segment.provider}</td>
                        <td className="max-w-[200px] truncate py-1.5 pr-3" title={segment.model}>{segment.model}</td>
                        <td className="py-1.5 pr-3">{segment.stage}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{segment.calls}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{segment.totalCostUsd === null ? "—" : segment.totalCostUsd.toFixed(4)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{segment.estimatedCostUsd === null ? "—" : segment.estimatedCostUsd.toFixed(4)}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {Math.round(((segment.totalGpuMsForEstimate ?? segment.totalLatencyMs) / 1000) * 10) / 10}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {report.notes.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              {report.notes.map((note) => (
                <p key={note} className="py-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
