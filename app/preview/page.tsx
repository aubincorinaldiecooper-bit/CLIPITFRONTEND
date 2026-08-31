"use client"
/* Temporary screenshot harness — deleted after capture. */
import { VerticalFrame } from "@/components/media/vertical-frame"

const g = (a: string, b: string, w = 600, h = 800) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><linearGradient id='x' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(#x)'/></svg>`)}`

export default function Preview() {
  return (
    <main className="shadcn-scope min-h-dvh bg-background p-10 font-sans text-foreground">
      <p className="pb-4 text-sm text-muted-foreground">Astryx AspectRatio · ratio 9/16 · cover vs contain</p>
      <div className="grid max-w-3xl grid-cols-3 gap-4">
        <VerticalFrame isVertical className="overflow-hidden rounded-2xl ring-1 ring-shborder">
          <img src={g("#2b3f63", "#e07020")} alt="" className="h-full w-full object-cover" />
        </VerticalFrame>
        <VerticalFrame isVertical className="overflow-hidden rounded-2xl bg-[#101013] ring-1 ring-shborder">
          <img src={g("#0d4d2e", "#67c23a")} alt="" className="h-full w-full object-cover" />
        </VerticalFrame>
        <VerticalFrame isVertical={false} className="overflow-hidden rounded-2xl bg-[#101013] ring-1 ring-shborder">
          <img src={g("#151528", "#c9a227", 1600, 900)} alt="" className="h-full w-full" />
        </VerticalFrame>
      </div>
      <p className="pt-3 text-xs text-muted-foreground">Third box is a 16:9 source in a 9:16 frame — contained, not cropped.</p>
    </main>
  )
}
