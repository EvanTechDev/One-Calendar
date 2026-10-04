import { AudioLines, Mic, Video } from 'lucide-react'

/** A decorative call composition, never presented as a live room or attendees. */
export function MeetingIllustration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative hidden min-h-72 select-none lg:flex lg:items-center lg:justify-center"
    >
      <div className="absolute size-72 rounded-full border border-meet-accent/10" />
      <div className="absolute size-96 rounded-full border border-meet-accent/5" />
      <div className="relative -rotate-6 rounded-2xl border border-white/60 bg-background/80 p-2 shadow-[0_16px_48px_-16px_rgb(52_76_124_/_25%)]">
        <div className="relative flex h-40 w-48 items-center justify-center overflow-hidden rounded-xl bg-[#dce7f5]">
          <div className="absolute -bottom-10 h-36 w-36 rounded-t-full bg-[#819bc2]" />
          <div className="relative -translate-y-3">
            <div className="size-16 rounded-full bg-[#f2d7be]" />
            <div className="absolute -left-1 -top-2 h-9 w-[4.5rem] rounded-t-full rounded-br-3xl bg-[#344c7c]" />
          </div>
          <span className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-lg bg-white/70 text-[#344c7c]">
            <Mic className="size-3" />
          </span>
        </div>
        <div className="flex h-7 items-center gap-1.5 px-1">
          <div className="h-1.5 w-12 rounded-full bg-meet-accent/15" />
          <div className="ml-auto size-1.5 rounded-full bg-meet-accent/30" />
          <div className="size-1.5 rounded-full bg-meet-accent/15" />
        </div>
      </div>
      <div className="relative -ml-7 mt-20 rotate-6 rounded-2xl border border-white/60 bg-background/90 p-2 shadow-[0_16px_48px_-16px_rgb(52_76_124_/_25%)]">
        <div className="relative flex h-32 w-36 items-center justify-center overflow-hidden rounded-xl bg-[#e0e9e3]">
          <div className="absolute -bottom-10 h-28 w-28 rounded-t-full bg-[#7e9c90]" />
          <div className="relative -translate-y-3">
            <div className="absolute -inset-2 rounded-t-full rounded-b-xl bg-[#455d56]" />
            <div className="relative size-12 rounded-full bg-[#d7ad90]" />
            <div className="absolute -left-1 -top-1 h-5 w-14 rounded-t-full rounded-br-2xl bg-[#455d56]" />
          </div>
          <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-lg bg-white/70 text-[#455d56]">
            <AudioLines className="size-3" />
          </span>
        </div>
      </div>
      <div className="absolute bottom-9 left-[18%] flex items-center gap-2 rounded-full border border-meet-accent/10 bg-background px-3 py-2 text-meet-accent shadow-sm">
        <Video className="size-4" />
        <span className="h-1 w-8 rounded-full bg-meet-accent/20" />
      </div>
    </div>
  )
}
