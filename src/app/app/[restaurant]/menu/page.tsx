import { getLocale } from "next-intl/server";
import { menuMessages } from "@/components/menu/menu-messages";
import { MenuEditor } from "@/components/menu-editor/menu-editor";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadMenu } from "@/lib/menu/load";

export default async function MenuPage({ params }: PageProps<"/app/[restaurant]/menu">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "menu");
  const menu = await loadMenu(await createClient(), ctx.restaurant.id);
  const locale = (await getLocale()) === "en" ? "en" : "es";
  return (
    <MenuEditor
      slug={restaurant}
      menu={menu}
      groups={menu.groups}
      menuMessages={await menuMessages()}
      locale={locale}
    />
  );
}
