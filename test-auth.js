import { supabase, shadowSupabase } from './safar setu/admin-web/src/lib/supabase.js';

async function test() {
  console.log("Testing shadow signup...");
  const dummyEmail = `test_${Date.now()}@test.local`;
  console.log("Email:", dummyEmail);
  const { data, error } = await shadowSupabase.auth.signUp({
    email: dummyEmail,
    password: 'password123',
  });
  console.log("Auth Data:", data);
  console.log("Auth Error:", error);
}

test();
