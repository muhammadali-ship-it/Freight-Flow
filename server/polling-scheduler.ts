/**
 * Polling Scheduler - Stub implementation
 * This can be expanded later if needed
 */

export function getPollingStatus() {
  return {
    enabled: false,
    interval: 0,
    lastRun: null,
    nextRun: null,
    status: "disabled"
  };
}

export function startPolling() {
  console.log("Polling not implemented yet");
}

export function stopPolling() {
  console.log("Polling not implemented yet");
}
