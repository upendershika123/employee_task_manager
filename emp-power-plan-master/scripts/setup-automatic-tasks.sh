#!/bin/bash

# Load environment variables
source .env

# Run the SQL migration
echo "Setting up automatic task table in Supabase..."
curl -X POST "https://$SUPABASE_PROJECT_ID.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": \"$(cat supabase/migrations/20240415000000_create_automatic_task_table.sql)\"}"

echo "Automatic task table setup complete!" 