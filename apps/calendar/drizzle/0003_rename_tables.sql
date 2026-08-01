-- Lowercase Better Auth table names + rename settings -> calendar_settings
ALTER TABLE "public"."User" RENAME TO "user";
ALTER TABLE "public"."Session" RENAME TO "session";
ALTER TABLE "public"."Account" RENAME TO "account";
ALTER TABLE "public"."Verification" RENAME TO "verification";
ALTER TABLE "public"."twoFactor" RENAME TO "two_factor";
ALTER TABLE "public"."settings" RENAME TO "calendar_settings";
