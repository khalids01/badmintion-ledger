import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
const env = import.meta.env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient<Database>(
        env.VITE_SUPABASE_URL,
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      )
    : null;
