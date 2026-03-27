import { t } from "@onecalendar/i18n";

export default function HomePage() {
  const text = t("zh");
  return <main style={{ padding: 24 }}>{text.dsMigrationTitle} API ready.</main>;
}
