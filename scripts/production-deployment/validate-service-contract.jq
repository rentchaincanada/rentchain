def env_by_name:
  [.spec.template.spec.containers[0].env[]?] | map({key:.name, value:.}) | from_entries;

env_by_name as $env
| [
    "GOOGLE_CLOUD_PROJECT",
    "JWT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "INTERNAL_JOB_TOKEN",
    "FIREBASE_API_KEY",
    "STRIPE_PRICE_STARTER_MONTHLY_LIVE",
    "STRIPE_PRICE_PRO_MONTHLY_LIVE"
  ] as $required
| ["JWT_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "INTERNAL_JOB_TOKEN", "FIREBASE_API_KEY"] as $requiredSecrets
| {
    missingNames: [$required[] | select($env[.] == null)],
    missingSecretRefs: [$requiredSecrets[] | select(($env[.].valueFrom.secretKeyRef // null) == null)],
    projectConfigured: (($env.GOOGLE_CLOUD_PROJECT.value // "") == "project-0d9658de-af29-4dc0-a99"),
    baseUrlConfigured: (($env.APP_BASE_URL // $env.FRONTEND_URL // $env.PUBLIC_APP_URL // null) != null),
    elitePriceConfigured: (($env.STRIPE_PRICE_ELITE_MONTHLY_LIVE // $env.STRIPE_PRICE_BUSINESS_MONTHLY_LIVE // null) != null),
    emailProvider: ($env.EMAIL_PROVIDER.value // "sendgrid"),
    mailgunConfigured: (($env.MAILGUN_API_KEY.valueFrom.secretKeyRef // null) != null and $env.MAILGUN_DOMAIN != null and $env.EMAIL_FROM != null),
    sendgridConfigured: (($env.SENDGRID_API_KEY.valueFrom.secretKeyRef // null) != null and $env.SENDGRID_FROM_EMAIL != null),
    startupReadyProbe: ((.spec.template.spec.containers[0].startupProbe.httpGet.path // "") == "/health/ready"),
    livenessHealthProbe: ((.spec.template.spec.containers[0].livenessProbe.httpGet.path // "") == "/health")
  }
| .emailConfigured = (if .emailProvider == "mailgun" then .mailgunConfigured else .sendgridConfigured end)
| .ok = (
    (.missingNames | length) == 0 and
    (.missingSecretRefs | length) == 0 and
    .projectConfigured and
    .baseUrlConfigured and
    .elitePriceConfigured and
    .emailConfigured and
    .startupReadyProbe and
    .livenessHealthProbe
  )
