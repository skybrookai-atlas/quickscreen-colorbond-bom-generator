// seed-auth.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "local"}`, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL");
}
if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: goOrg } = await supabase
    .from("organisations")
    .select("id")
    .eq("slug", "glass-outlet")
    .single();

  if (!goOrg) throw new Error("glass-outlet org not found");

  const { data: afOrg } = await supabase
    .from("organisations")
    .select("id")
    .eq("slug", "amazing-fencing")
    .single();

  if (!afOrg) {
    console.warn("amazing-fencing org not found, skipping amazing-fencing users");
  }

  // ── Glass Outlet Users ────────────────────────────────────────────────────────
  await supabase.auth.admin.createUser({
    email: "test@glass-outlet.com",
    password: "123456",
    email_confirm: true,
    app_metadata: { org_id: goOrg.id },
  });

  const { data: goAdminUserData } = await supabase.auth.admin.createUser({
    email: "admin@glass-outlet.com",
    password: "123456",
    email_confirm: true,
    app_metadata: { org_id: goOrg.id },
  });

  // ── Amazing Fencing Users ─────────────────────────────────────────────────────
  let afTestUserData = null;
  let afAdminUserData = null;
  if (afOrg) {
    const { data: testData } = await supabase.auth.admin.createUser({
      email: "test@amazing-fencing.com",
      password: "123456",
      email_confirm: true,
      app_metadata: { org_id: afOrg.id },
    });
    afTestUserData = testData;

    const { data: adminData } = await supabase.auth.admin.createUser({
      email: "admin@amazing-fencing.com",
      password: "123456",
      email_confirm: true,
      app_metadata: { org_id: afOrg.id },
    });
    afAdminUserData = adminData;
  }

  // Wait for the signup trigger to create the profile rows
  await new Promise((r) => setTimeout(r, 1000));

  // Promote admin@glass-outlet.com to role = 'admin'
  const goAdminId = goAdminUserData?.user?.id;
  if (goAdminId) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", goAdminId);
    if (error) {
      console.warn("Warning: could not promote Glass Outlet admin user:", error.message);
    } else {
      console.log("admin@glass-outlet.com promoted to role=admin");
    }
  }

  // Update profiles.org_id and promote for amazing-fencing users to override the trigger default
  if (afOrg) {
    const { error: testErr } = await supabase
      .from("profiles")
      .update({ org_id: afOrg.id })
      .eq("email", "test@amazing-fencing.com");
    if (testErr) {
      console.warn("Warning: could not set org_id for Amazing Fencing test user:", testErr.message);
    } else {
      console.log("test@amazing-fencing.com linked to amazing-fencing org");
    }

    const { error: adminErr } = await supabase
      .from("profiles")
      .update({ org_id: afOrg.id, role: "admin" })
      .eq("email", "admin@amazing-fencing.com");
    if (adminErr) {
      console.warn("Warning: could not promote Amazing Fencing admin user:", adminErr.message);
    } else {
      console.log("admin@amazing-fencing.com promoted to role=admin and linked to amazing-fencing org");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
