import { ZentraDocsLayout } from '@/components/docs-layout'

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return <ZentraDocsLayout>{children}</ZentraDocsLayout>
}
