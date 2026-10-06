import { AppShell } from "@/components/app/app-shell";
import { requireStaff } from "@/lib/auth/staff";

/** Every restaurant screen requires an active membership; non-members get a 404. */
export default async function RestaurantLayout({ children, params }: LayoutProps<"/app/[restaurant]">) {
  const { restaurant } = await params;
  const ctx = await requireStaff(restaurant);
  return (
    <AppShell
      restaurantSlug={restaurant}
      restaurantId={ctx.restaurant.id}
      restaurantName={ctx.restaurant.name}
      role={ctx.role}
    >
      {children}
    </AppShell>
  );
}
