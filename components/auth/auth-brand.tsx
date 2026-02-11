import { Calendar } from "lucide-react"

export function AuthBrand() {
  return (
    <a href="https://xyehr.cn" className="flex items-center gap-2 self-center font-medium text-foreground">
      <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Calendar className="size-4" />
      </span>
      <span>Tech-Art</span>
    </a>
  )
}
