


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_srs_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    prev_interval INT := 0;
    prev_count INT := 0;
    assistance_cap INT;
    effective_mastery INT;
    easiness_factor NUMERIC;
    next_int INT;
BEGIN
    NEW.last_solved_at := NOW();

    SELECT previous_interval, repetition_count
    INTO prev_interval, prev_count
    FROM reviews
    WHERE user_id = NEW.user_id AND problem_slug = NEW.problem_slug
    LIMIT 1;

    IF prev_interval IS NULL THEN prev_interval := 0; END IF;
    IF prev_count IS NULL THEN prev_count := 0; END IF;

    -- Hard reset only for very low slider (failed / no real retention)
    IF NEW.mastery < 3 THEN
        NEW.previous_interval := 0;
        NEW.repetition_count := 0;
        NEW.next_review_date := NOW() + INTERVAL '1 day';
        RETURN NEW;
    END IF;

    assistance_cap := CASE NEW.assistance
        WHEN 'NONE'           THEN 10
        WHEN 'HINT'           THEN 7
        WHEN 'SOLUTION_PEEK'  THEN 4
        WHEN 'SOLUTION_COPIED' THEN 1
        ELSE 10
    END;

    -- Level cap: assistance tier limits how much slider mastery counts
    effective_mastery := LEAST(NEW.mastery, assistance_cap);

    IF prev_count = 0 THEN
        next_int := 1;
        prev_count := 1;
    ELSIF prev_count = 1 THEN
        next_int := 3;
        prev_count := 2;
    ELSE
        easiness_factor := 1.0 + (effective_mastery * 0.15);
        next_int := ROUND(prev_interval * easiness_factor);
        prev_count := prev_count + 1;
    END IF;

    IF next_int > 180 THEN next_int := 180; END IF;

    NEW.previous_interval := next_int;
    NEW.repetition_count := prev_count;
    NEW.next_review_date := NOW() + (next_int || ' days')::INTERVAL;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_srs_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_slug" "text" NOT NULL,
    "problem_title" "text" NOT NULL,
    "leetcode_difficulty" "text" NOT NULL,
    "mastery" integer NOT NULL,
    "assistance" "text" NOT NULL,
    "time_complexity" "text",
    "space_complexity" "text",
    "notes" "text",
    "topic_tags" "text"[],
    "question_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_solved_at" timestamp with time zone DEFAULT "now"(),
    "repetition_count" integer DEFAULT 0,
    "previous_interval" integer DEFAULT 0,
    "next_review_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_assistance_check" CHECK (("assistance" = ANY (ARRAY['NONE'::"text", 'HINT'::"text", 'SOLUTION_PEEK'::"text", 'SOLUTION_COPIED'::"text"]))),
    CONSTRAINT "reviews_mastery_check" CHECK ((("mastery" >= 1) AND ("mastery" <= 10)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_reviews_topic_tags" ON "public"."reviews" USING "gin" ("topic_tags");



CREATE UNIQUE INDEX "idx_user_problem_slug" ON "public"."reviews" USING "btree" ("user_id", "problem_slug");



CREATE OR REPLACE TRIGGER "trigger_process_srs" BEFORE INSERT OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_srs_metrics"();



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users see own reviews" ON "public"."reviews" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."calculate_srs_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_srs_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_srs_metrics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































