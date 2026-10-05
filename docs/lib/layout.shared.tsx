import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { site } from './site'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: '/docs',
      title: (
        <>
          <img src="/logo-light.svg" alt="" className="size-7 dark:hidden" />
          <img
            src="/logo-dark.svg"
            alt=""
            className="hidden size-7 dark:block"
          />
          <span>Zentra Docs</span>
        </>
      ),
    },
    githubUrl: site.repository,
  }
}
