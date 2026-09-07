import { afterAll, afterEach, beforeAll } from "vitest";
import { ADMIN_CLIENT, cleanup } from "./setup";

beforeAll(() => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.test",
    );
  }
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await ADMIN_CLIENT.auth.signOut();
});
