import * as Sentry from "@sentry/react";
import React from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: typeof __SENTRY_RELEASE__ === "string" ? __SENTRY_RELEASE__ : undefined,
    integrations: [
      Sentry.browserTracingIntegration({
        routingInstrumentation: Sentry.reactRouterV6BrowserTracingIntegration(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
        tracePropagationTargets: ["localhost", /^wails:\/\//],
      }),
    ],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false
  });
}
