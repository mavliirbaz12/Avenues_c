import { AdminPageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { getStoreSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const settings = await getStoreSettings();

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Store settings">
        <p className="mt-2 font-sans text-xs text-stone">
          Everything here changes the live store without a deploy.
        </p>
      </AdminPageHeader>

      <div className="mt-8">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
