import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing ${name}. Use disposable password-based test users.`);
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const bucket = "code-timelines";
const options = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const anonymous = createClient(url, key, options);
const accountA = createClient(url, key, options);
const accountB = createClient(url, key, options);

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    throw new Error(`Test account sign-in failed: ${error?.message ?? "no user"}`);
  }
  return data.user;
}

function assertNoRows(label, data, error) {
  if (!error && (data?.length ?? 0) > 0) {
    throw new Error(`${label}: unexpectedly returned protected rows`);
  }
  console.log(`PASS ${label}`);
}

async function firstObject(client, prefix, depth = 0) {
  if (depth > 5) return null;
  const { data, error } = await client.storage
    .from(bucket)
    .list(prefix, { limit: 100 });
  if (error) throw error;

  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) return path;
    const nested = await firstObject(client, path, depth + 1);
    if (nested) return nested;
  }
  return null;
}

const userA = await signIn(
  accountA,
  process.env.TEST_USER_A_EMAIL,
  process.env.TEST_USER_A_PASSWORD,
);
const userB = await signIn(
  accountB,
  process.env.TEST_USER_B_EMAIL,
  process.env.TEST_USER_B_PASSWORD,
);

if (userA.id === userB.id) {
  throw new Error("Isolation checks require two different user accounts.");
}

const anonymousReviews = await anonymous.from("reviews").select("user_id").limit(1);
assertNoRows(
  "anonymous review access denied",
  anonymousReviews.data,
  anonymousReviews.error,
);

const crossAccountReviews = await accountA
  .from("reviews")
  .select("user_id")
  .eq("user_id", userB.id);
assertNoRows(
  "account A cannot read account B reviews",
  crossAccountReviews.data,
  crossAccountReviews.error,
);

const anonymousList = await anonymous.storage.from(bucket).list(userB.id);
assertNoRows(
  "anonymous archive listing denied",
  anonymousList.data,
  anonymousList.error,
);

const crossAccountList = await accountA.storage.from(bucket).list(userB.id);
assertNoRows(
  "account A cannot list account B archives",
  crossAccountList.data,
  crossAccountList.error,
);

const accountBObject = await firstObject(accountB, userB.id);
if (!accountBObject) {
  throw new Error(
    "Account B needs at least one code-timelines object to test downloads.",
  );
}

const anonymousDownload = await anonymous.storage
  .from(bucket)
  .download(accountBObject);
if (anonymousDownload.data && !anonymousDownload.error) {
  throw new Error("anonymous archive download unexpectedly succeeded");
}
console.log("PASS anonymous archive download denied");

const crossAccountDownload = await accountA.storage
  .from(bucket)
  .download(accountBObject);
if (crossAccountDownload.data && !crossAccountDownload.error) {
  throw new Error("account A downloaded account B archive");
}
console.log("PASS account A cannot download account B archive");

await Promise.all([accountA.auth.signOut(), accountB.auth.signOut()]);
console.log("Supabase isolation checks passed.");
