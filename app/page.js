"use client";

import { useEffect, useMemo, useState } from "react";

const fallback = {
  generatedAt: null,
  source: "fallback",
  terms: [
    { id: "gst-registration", label: "GST Registration", keyword: "gst registration", score: 0, delta: 0, estimatedDaily: null },
    { id: "gst-registration-bangalore", label: "GST Registration Bangalore", keyword: "gst registration bangalore", score: 0, delta: 0, estimatedDaily: null },
    { id: "company-registration", label: "Company Registration", keyword: "company registration", score: 0, delta: 0, estimatedDaily: null },
    { id: "company-registration-bangalore", label: "Company Registration Bangalore", keyword: "company registration bangalore", score: 0, delta: 0, estimatedDaily: null },
    { id: "private-limited-company-registration", label: "Private Limited Company Registration", keyword: "private limited company registration", score: 0, delta: 0, estimatedDaily: null },
    { id: "llp-registration-bangalore", label: "LLP Registration Bangalore", keyword: "llp registration bangalore", score: 0, delta: 0, estimatedDaily: null }
  ]
};

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

function formatDate(value) {
  if (!value) return "waiting for first collection";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function Home() {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setError("");
      const res = await fetch("/api/monitor", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load monitor");
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);

  const totalActivity = useMemo(() => {
    if (!data.terms?.length) return 0;
    return Math.round(data.terms.reduce((sum, term) => sum + (term.score || 0), 0) / data.terms.length);
  }, [data]);

  const rising = useMemo(() => {
    return [...(data.terms || [])].sort((a, b) => (b.delta || 0) - (a.delta || 0))[0];
  }, [data]);

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="eyebrow">24/7 Search Intent Monitor</div>
            <h1>GST + Company Registration</h1>
            <p className="subtitle">
              India-wide aggregated Google search-interest monitoring. The agent refreshes automatically and keeps the last collection history when a Redis store is connected.
            </p>
          </div>

          <div className="status">
            <div className="status-label">Collector</div>
            <div className="status-value"><span className="dot" /> Live polling</div>
            <div className="status-label" style={{ marginTop: 10 }}>
              Last sample: {formatDate(data.generatedAt)}
            </div>
          </div>
        </header>

        <section className="grid">
          <div className="card hero">
            <div className="kicker">Current aggregate activity</div>
            <div className="big-number">{totalActivity}/100</div>
            <div className="big-label">Relative search-interest index across monitored terms</div>
            {rising ? (
              <div className={"delta " + (rising.delta > 2 ? "up" : rising.delta < -2 ? "down" : "flat")}>
                {rising.delta > 0 ? "↑" : rising.delta < 0 ? "↓" : "→"} {Math.abs(rising.delta)}% vs previous sample — {rising.label}
              </div>
            ) : null}
            <div className="notice">
              Google Trends is anonymised and aggregated. This dashboard does not identify individual searchers and does not provide an exact number of people searching in real time.
            </div>
          </div>

          <div className="card summary">
            <div className="kicker">Monitored signals</div>
            {(data.terms || []).slice(0, 4).map((term) => (
              <div className="stat-row" key={term.id}>
                <div className="stat-name">{term.label}</div>
                <div className="stat-value">{Math.round(term.score || 0)}</div>
              </div>
            ))}
          </div>

          <div className="card table-card">
            <div className="table-head">
              <div>Keyword</div>
              <div>Interest</div>
              <div>Momentum</div>
              <div>Optional estimate</div>
            </div>

            {(data.terms || []).map((term) => (
              <div className="table-row" key={term.id}>
                <div>
                  <div className="keyword">{term.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{term.keyword}</div>
                  <div className="meter" style={{ marginTop: 10 }}>
                    <span style={{ width: Math.max(0, Math.min(100, term.score || 0)) + "%" }} />
                  </div>
                </div>

                <div><span className="badge">{Math.round(term.score || 0)}/100</span></div>

                <div className={(term.delta || 0) > 2 ? "delta up" : (term.delta || 0) < -2 ? "delta down" : "delta flat"}>
                  {(term.delta || 0) > 0 ? "↑" : (term.delta || 0) < 0 ? "↓" : "→"} {Math.abs(Math.round(term.delta || 0))}%
                </div>

                <div>{term.estimatedDaily ? formatNumber(term.estimatedDaily) + "/day*" : "Configure baseline"}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="footer">
          <div>
            Source: Google Trends interest-over-time signal for India. Refresh cadence: 10 minutes through Vercel Cron; browser refresh: 60 seconds.
          </div>
          <div>
            {loading ? "Loading…" : error ? <span className="error">{error}</span> : "Ready"}
          </div>
        </footer>
      </div>
    </main>
  );
}
