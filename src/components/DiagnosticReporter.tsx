import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordWebsiteDiagnostic } from "@/lib/diagnostics.functions";

type DiagnosticPayload = {
  severity: "info" | "warning" | "error";
  eventType: string;
  pageUrl?: string | undefined;
  routePath?: string | undefined;
  message?: string | undefined;
  stack?: string | undefined;
  element?: string | undefined;
  metadata?: Record<string, any> | undefined;
  userAgent?: string | undefined;
};

function describeElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return undefined;
  const el = target.closest("button,a,[role='button'],input,select,textarea") ?? target;
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160);
  return `${tag}${id}${text ? ` "${text}"` : ""}`;
}

export function DiagnosticReporter() {
  const reportFn = useServerFn(recordWebsiteDiagnostic) as unknown as (args: { data: DiagnosticPayload }) => Promise<unknown>;
  const lastSent = useRef(new Map<string, number>());

  useEffect(() => {
    const send = (payload: DiagnosticPayload) => {
      const key = `${payload.eventType}|${payload.routePath}|${payload.message}|${payload.element}`;
      const now = Date.now();
      const previous = lastSent.current.get(key) ?? 0;
      if (now - previous < 5000) return;
      lastSent.current.set(key, now);
      void reportFn({ data: payload }).catch(() => undefined);
    };

    const base = () => ({
      pageUrl: window.location.href.slice(0, 2000),
      routePath: window.location.pathname.slice(0, 500),
      userAgent: navigator.userAgent.slice(0, 1000),
    });

    const onError = (event: ErrorEvent) => {
      send({ ...base(), severity: "error", eventType: "window_error", message: event.message || "Unhandled browser error", stack: event.error instanceof Error ? event.error.stack : undefined });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      send({ ...base(), severity: "error", eventType: "unhandled_rejection", message: reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection"), stack: reason instanceof Error ? reason.stack : undefined });
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const started = performance.now();
      try {
        const response = await originalFetch(...args);
        const durationMs = Math.round(performance.now() - started);
        if (!response.ok) {
          const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "unknown";
          send({ ...base(), severity: response.status >= 500 ? "error" : "warning", eventType: "http_error", message: `HTTP ${response.status} ${response.statusText}`, metadata: { requestUrl: String(url).slice(0, 1500), durationMs, status: response.status } });
        } else if (durationMs >= 8000) {
          send({ ...base(), severity: "warning", eventType: "slow_request", message: `Request took ${durationMs}ms`, metadata: { durationMs } });
        }
        return response;
      } catch (error) {
        const durationMs = Math.round(performance.now() - started);
        send({ ...base(), severity: "error", eventType: "network_failure", message: error instanceof Error ? error.message : "Network request failed", stack: error instanceof Error ? error.stack : undefined, metadata: { durationMs } });
        throw error;
      }
    };

    let mutationVersion = 0;
    const observer = new MutationObserver(() => { mutationVersion += 1; });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button,a,[role='button']") : null;
      if (!target) return;
      if (target.closest("[data-diagnostic-ignore='true']")) return;
      if (target instanceof HTMLButtonElement && target.disabled) return;
      const beforeMutation = mutationVersion;
      const beforePath = window.location.href;
      const element = describeElement(target);
      window.setTimeout(() => {
        if (window.location.href !== beforePath) return;
        if (mutationVersion !== beforeMutation) return;
        send({ ...base(), severity: "warning", eventType: "dead_click", message: "Interactive control was clicked but no visible page change was detected within 1800ms.", element, metadata: { tag: target.tagName.toLowerCase() } });
      }, 1800);
    };

    const slowPageTimer = window.setTimeout(() => {
      if (document.readyState !== "complete") {
        send({ ...base(), severity: "warning", eventType: "slow_page", message: "Page was still not fully loaded after 10 seconds." });
      }
    }, 10000);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("click", onClick, true);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
      window.clearTimeout(slowPageTimer);
    };
  }, [reportFn]);

  return null;
}
