export const dynamic = "force-dynamic";

import { Ambient } from "@/components/Ambient";
import { Header } from "@/components/Header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Ambient />
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
