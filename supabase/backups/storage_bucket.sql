-- LeetLedger Storage bucket configuration
-- For recreating the bucket in a fresh Supabase project.

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'code-timelines',
    'code-timelines',
    false,
    5242880,
    ARRAY['application/gzip']
);