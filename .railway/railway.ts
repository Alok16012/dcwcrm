import { defineRailway, project, service } from "railway/iac";

// Single-service repo: the Next.js CRM. Railway's Nixpacks builder detects
// Next.js on its own, so only the start command needs spelling out (it must
// bind the port Railway injects).
export const partial = "dcwcrm";

export default defineRailway(() => {
  const dcwcrm = service("dcwcrm", {
    build: "npm run build",
    start: "npm run start -- -p ${PORT:-3000}",
    healthcheck: "/login",
    healthcheckTimeout: 120,
  });
  return project("dcwcrm", {
    resources: [dcwcrm],
  });
});
