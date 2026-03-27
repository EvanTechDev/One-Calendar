import DsMigration from "@/components/ds-migration";
import { t } from "@onecalendar/i18n";

export default function SettingsPage() {
  const text = t("zh");
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>{text.settingsTitle}</h1>
      <DsMigration />
    </main>
  );
}
