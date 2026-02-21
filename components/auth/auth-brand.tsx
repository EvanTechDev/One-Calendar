import Image from "next/image"

export function AuthBrand() {
  return (
    <a href="https://xyehr.cn" className="flex items-center gap-2 self-center font-medium text-foreground">
      <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Image src="/icon.svg" alt="One Calendar" width={16} height={16} className="size-4" />
      </span>
      <span>One Calendar</span>
    </a>
  )
}
