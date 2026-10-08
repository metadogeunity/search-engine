export const TERMS = [
  { id: "gst-registration", label: "GST Registration", keyword: "gst registration", baselineEnv: "BASELINE_MONTHLY_GST_REGISTRATION" },
  { id: "gst-registration-bangalore", label: "GST Registration Bangalore", keyword: "gst registration bangalore", baselineEnv: "BASELINE_MONTHLY_GST_REGISTRATION_BANGALORE" },
  { id: "company-registration", label: "Company Registration", keyword: "company registration", baselineEnv: "BASELINE_MONTHLY_COMPANY_REGISTRATION" },
  { id: "company-registration-bangalore", label: "Company Registration Bangalore", keyword: "company registration bangalore", baselineEnv: "BASELINE_MONTHLY_COMPANY_REGISTRATION_BANGALORE" },
  { id: "private-limited-company-registration", label: "Private Limited Company Registration", keyword: "private limited company registration", baselineEnv: "BASELINE_MONTHLY_PRIVATE_LIMITED_COMPANY_REGISTRATION" },
  { id: "llp-registration-bangalore", label: "LLP Registration Bangalore", keyword: "llp registration bangalore", baselineEnv: "BASELINE_MONTHLY_LLP_REGISTRATION_BANGALORE" }
];

export function configuredBaseline(term) {
  const value = Number(process.env[term.baselineEnv] || "");
  return Number.isFinite(value) && value > 0 ? value : null;
}
