"use client";

import { useEffect, useMemo, useState } from "react";

const fallback = {
  generatedAt: null,
  source: "fallback",
  region: "Karnataka",
  geo: "IN-KA",
  dailyHistory: [],
  terms: []
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
      const res = await fetch("/api/monitor?days=30", { cache: "no-store" });
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
          <div className="brand-block">
            <div className="brand-name">B Tax Advisors India Pvt Ltd</div>
            <div className="brand-location">bangalore India</div>
            <div className="brand-credit">Made for Ashwat CA from Ashish Janghel</div>
            <div className="eyebrow">24/7 Search Intent Monitor</div>
            <h1>Karnataka Search Intent</h1>
            <p className="subtitle">
              Karnataka-only aggregated Google search-interest monitoring across the configured business-service keywords.
            </p>
          </div>

          <div className="status">
            <div className="status-label">Region</div>
            <div className="status-value"><span className="dot" /> Karnataka only</div>
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
          <div className="card history-card">
            <div className="history-header">
              <div>
                <div className="kicker">Daily keyword history</div>
                <h2>Day-by-day search-interest index</h2>
                <p>
                  Each value is the average Google Trends index collected throughout that Karnataka day. It is a relative 0–100 signal, not the number of individual people or searches.
                </p>
              </div>
              <div className="history-meta">
                {data.dailyHistory?.length || 0} days recorded
              </div>
            </div>

            {data.dailyHistory?.length ? (
              <div className="history-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {(data.terms || []).map((term) => (
                        <th key={term.id}>{term.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyHistory.map((day) => (
                      <tr key={day.date}>
                        <td className="history-date">{day.date}</td>
                        {(data.terms || []).map((term) => (
                          <td key={term.id}>
                            <span className="history-value">
                              {day.terms?.[term.id]?.average ?? "—"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="history-empty">
                Daily history will appear after the collector records its first samples.
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          <div>
            Source: Google Trends interest-over-time signal restricted to Karnataka (IN-KA). Collector cadence: approximately 1 minute; daily summaries are retained for up to 365 days.
          </div>
          <div>
            {loading ? "Loading…" : error ? <span className="error">{error}</span> : "Ready"}
          </div>
        </footer>
      </div>
    </main>
  );
}
