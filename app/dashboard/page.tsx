import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">
        Parent Dashboard
      </h1>

      <p className="mt-4">
        Welcome {session?.user?.email}
      </p>
    </main>
  );
}