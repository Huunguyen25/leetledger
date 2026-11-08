[
  {
    "policyname": "Users can delete own timelines",
    "cmd": "DELETE",
    "roles": "{authenticated}",
    "using_expression": "((bucket_id = 'code-timelines'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
    "with_check_expression": null
  },
  {
    "policyname": "Users can read own timelines",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((bucket_id = 'code-timelines'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
    "with_check_expression": null
  },
  {
    "policyname": "Users can update own timelines",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "((bucket_id = 'code-timelines'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
    "with_check_expression": "((bucket_id = 'code-timelines'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
  },
  {
    "policyname": "Users can upload own timelines",
    "cmd": "INSERT",
    "roles": "{authenticated}",
    "using_expression": null,
    "with_check_expression": "((bucket_id = 'code-timelines'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
  }
]