export function getRuntimeModeLabel(): "simulator" | "live" {
  const raw = process.env.SIMULATOR_MODE;
  if (raw === "false") return "live";
  return "simulator";
}

export function describeSendResult(mode: "simulator" | "live" = getRuntimeModeLabel()): string {
  return mode === "simulator"
    ? "Comment sent via managed session worker (simulator mode)"
    : "Comment send accepted by live connector";
}