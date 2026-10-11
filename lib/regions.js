export const REGIONS = {
  karnataka: {
    id: "karnataka",
    label: "Karnataka",
    geo: "IN-KA",
    keys: {
      latest: "search-intent-monitor:latest",
      history: "search-intent-monitor:history",
      dailyPrefix: "search-intent-monitor:daily:",
      dailyMigration: "search-intent-monitor:daily-migration-v1",
      cumulative: "search-intent-monitor:cumulative",
      cumulativeMigration: "search-intent-monitor:cumulative-migration-v1"
    }
  },
  india: {
    id: "india",
    label: "India",
    geo: "IN",
    keys: {
      latest: "search-intent-monitor:india:latest",
      history: "search-intent-monitor:india:history",
      dailyPrefix: "search-intent-monitor:india:daily:",
      dailyMigration: "search-intent-monitor:india:daily-migration-v1",
      cumulative: "search-intent-monitor:india:cumulative",
      cumulativeMigration: "search-intent-monitor:india:cumulative-migration-v1"
    }
  }
};

export function getRegion(regionId = "karnataka") {
  return REGIONS[regionId] || REGIONS.karnataka;
}
