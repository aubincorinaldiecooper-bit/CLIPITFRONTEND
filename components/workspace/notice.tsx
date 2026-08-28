"use client"

/**
 * A framed sentence with a title — what Astryx's Banner did, restated on the
 * app's light look. For news that has to sit still while someone reads it
 * (failures, warnings); passing news belongs in a toast instead.
 */
export function Notice({
  tone,
  title,
  description,
}: {
  tone: "warning" | "error" | "success"
  title: string
  description: string
}) {
  return (
    <div
      role="status"
      className={
        "flex flex-col gap-1 rounded-lg border px-4 py-3 " +
        (tone === "error"
          ? "border-destructive/30 bg-destructive/10"
          : tone === "warning"
            ? "border-shborder bg-shmuted"
            : "border-shborder bg-shcard")
      }
    >
      <p className={"text-sm font-medium " + (tone === "error" ? "text-destructive" : "")}>{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
