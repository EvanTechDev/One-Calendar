'use client'

import { useState } from 'react'
import { Check, ChevronDown, Copy, ExternalLink, FileText } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'fumadocs-ui/components/ui/popover'

export function PageActions({
  markdownUrl,
  githubUrl,
}: {
  markdownUrl: string
  githubUrl: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>(
    'idle',
  )

  async function copyPage() {
    setStatus('loading')
    try {
      const content = fetch(markdownUrl).then(async (response) => {
        if (!response.ok) throw new Error('Could not load Markdown')
        return response.text()
      })
      // Start the clipboard operation during the user gesture (Safari).
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await Promise.all([
          navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': content.then(
                (text) => new Blob([text], { type: 'text/plain' }),
              ),
            }),
          ]),
          content,
        ])
      } else {
        await navigator.clipboard.writeText(await content)
      }
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="page-actions relative shrink-0 text-sm">
      <Popover>
        <div className="inline-flex items-center rounded-full border border-fd-border [&_svg]:size-4">
          <button
            type="button"
            disabled={status === 'loading'}
            onClick={copyPage}
            className="inline-flex h-9 items-center gap-2 rounded-l-full px-3 hover:bg-fd-accent disabled:opacity-50"
          >
            {status === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
            <span aria-live="polite" className="page-copy-label">
              {status === 'copied'
                ? 'Copied'
                : status === 'loading'
                  ? 'Copying…'
                  : 'Copy page'}
            </span>
          </button>
          <PopoverTrigger
            aria-label="More page actions"
            className="self-stretch rounded-r-full border-l px-2.5 hover:bg-fd-accent"
          >
            <ChevronDown aria-hidden />
          </PopoverTrigger>
        </div>
        <PopoverContent className="flex flex-col gap-1">
          <a
            className="flex items-center gap-2 rounded-md p-2 hover:bg-fd-accent"
            href={markdownUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="size-4" aria-hidden />
            View Markdown
          </a>
          <a
            className="flex items-center gap-2 rounded-md p-2 hover:bg-fd-accent"
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4" aria-hidden />
            View page source
          </a>
        </PopoverContent>
      </Popover>
      {status === 'error' && (
        <p
          role="status"
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-fd-background p-3 text-xs shadow-sm"
        >
          Could not copy. Open Markdown from the menu instead.
        </p>
      )}
    </div>
  )
}
