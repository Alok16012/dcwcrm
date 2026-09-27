import { defineRailway, project, service, volume, preserve } from "railway/iac";

export const partial = "dcwcrm";

export default defineRailway(() => {
  // Every variable a service uses is declared here with preserve(). Railway's
  // IaC treats this file as the whole truth: a variable missing from it is
  // DELETED on apply — which once came within one command of wiping the CRM's
  // Supabase keys and the biometric secret. preserve() declares a variable
  // without putting its value in git, and keeps whatever is set on Railway.
  // Add a new variable here the moment you add it on Railway.

  // The Next.js CRM. Nixpacks detects Next.js; only the start command needs
  // spelling out, because it must bind the port Railway injects.
  const dcwcrm = service("dcwcrm", {
    build: "npm run build",
    start: "npm run start -- -p ${PORT:-3000}",
    healthcheck: "/login",
    healthcheckTimeout: 120,
    variables: {
      NEXT_PUBLIC_SUPABASE_URL: preserve(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      NEXT_PUBLIC_META_PIXEL_ID: preserve(),
      CRON_SECRET: preserve(),
      IVR_WEBHOOK_SECRET: preserve(),
      BIOMETRIC_WEBHOOK_SECRET: preserve(),
      BIOMETRIC_MIN_SPAN_SECONDS: preserve(),
      BIOMETRIC_FULL_DAY_MINUTES: preserve(),
      TZ: preserve(),
    },
  });

  // The WhatsApp admission bot. Separate service because it holds a socket
  // open around the clock, which the web app never does.
  //
  // Exactly one replica: two copies sharing one WhatsApp session knock each
  // other off in a loop. The volume keeps the linked-device credentials, so a
  // redeploy does not force the phone to be paired again.
  // Region pinned to where Railway placed it. Left unset, the next apply
  // "changes" it — and moving a volume destroys it, taking the paired
  // WhatsApp session with it.
  const waAuth = volume("wa-auth", { sizeMB: 500, region: "sfo" });
  const whatsappBot = service("whatsapp-bot", {
    // Matches what Railway recorded. Deploys go through `railway up` from the
    // repo root; no repo is linked, so pushing CRM changes does not restart
    // the bot and drop its WhatsApp connection.
    source: { type: "github", rootDirectory: "whatsapp-bot" },
    start: "npm start",
    healthcheck: "/health",
    healthcheckTimeout: 60,
    replicas: 1,
    volumeMounts: { "/data": waAuth },
    variables: {
      SUPABASE_URL: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      CRM_BASE_URL: preserve(),
      WHATSAPP_BOT_SECRET: preserve(),
      AI_PROVIDER: preserve(),
      TZ: preserve(),
    },
  });

  return project("dcwcrm", {
    resources: [dcwcrm, whatsappBot, waAuth],
  });
});
