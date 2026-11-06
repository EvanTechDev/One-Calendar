'use client'

import { useEffect, useState } from 'react'
import { ArrowDownAZ, History } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { isListSort, type ListSort } from '#calendar/lib/list-sort'

type LabelKey = keyof (typeof translations)['en']

/**
 * A handful of keys are lists in some locales (the weekday and month names), so
 * `t[key]` widens to `string | string[]` even for a plain label key. The sort
 * labels are never one of those; flatten rather than cast, so the DOM props keep
 * their real types.
 */
const asText = (value: string | string[]) =>
  Array.isArray(value) ? value.join(' ') : value

export interface ListSortOption {
  value: ListSort
  /** Per-panel: a countdown's title sort is "Name A–Z", a bookmark's "Title A–Z". */
  labelKey: LabelKey
  Icon: typeof ArrowDownAZ
}

/**
 * Read the persisted choice once, on mount. Deliberately NOT a `useState`
 * initializer: both panels are SSR'd, and reading the browser's storage during
 * render would make the trigger's icon and the list order differ between the
 * server's markup and the first client paint — a hydration mismatch. An
 * unrecognised stored value keeps `defaultSort`, which is also what a first
 * visit gets, so no write is needed here.
 */
export function useStoredListSort(
  storageKey: string,
  defaultSort: ListSort,
): [ListSort, (sort: ListSort) => void] {
  const [sort, setSort] = useState<ListSort>(defaultSort)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (isListSort(stored)) setSort(stored)
    } catch {}
  }, [storageKey])

  const update = (next: ListSort) => {
    setSort(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {}
  }

  return [sort, update]
}

export function ListSortMenu({
  ariaLabelKey,
  options,
  sort,
  onSortChange,
}: {
  ariaLabelKey: LabelKey
  options: readonly ListSortOption[]
  sort: ListSort
  onSortChange: (sort: ListSort) => void
}) {
  const [language] = useLanguage()
  const t = translations[language]

  return (
    // `size="icon"` is `size-8`, matching InputGroup's `h-8`, so the button
    // does not change the row's height.
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={asText(t[ariaLabelKey])}
          title={asText(t[ariaLabelKey])}
        >
          {(() => {
            const Icon = options.find((o) => o.value === sort)?.Icon ?? History
            return <Icon className="h-4 w-4" />
          })()}
        </Button>
      </DropdownMenuTrigger>
      {/* `w-auto`: the shared default is the trigger's width (32px here),
          which is what locked event-preview's menu shut. */}
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuRadioGroup
          value={sort}
          onValueChange={(value) => onSortChange(value as ListSort)}
        >
          {options.map(({ value, labelKey, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="h-4 w-4 text-muted-foreground" />
              {asText(t[labelKey])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One call per panel. Keeping the storage key, the default, the options table
 * and the rendered dropdown together is the point: the bookmark version of this
 * was a private hook and a private dropdown inside `bookmark-panel.tsx`, and the
 * second panel to want the same behaviour would have copy-pasted it.
 */
export function useListSort(
  options: readonly ListSortOption[],
  ariaLabelKey: LabelKey,
  storageKey: string,
  defaultSort: ListSort,
) {
  const [sort, setSort] = useStoredListSort(storageKey, defaultSort)
  const menu = (
    <ListSortMenu
      ariaLabelKey={ariaLabelKey}
      options={options}
      sort={sort}
      onSortChange={setSort}
    />
  )
  return { sort, menu }
}
