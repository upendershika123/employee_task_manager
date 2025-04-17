# Load environment variables
$envContent = Get-Content .env
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^([^=]+)=(.*)$') {
        $envVars[$matches[1]] = $matches[2]
    }
}

$SUPABASE_PROJECT_ID = $envVars['SUPABASE_PROJECT_ID']
$SUPABASE_SERVICE_KEY = $envVars['SUPABASE_SERVICE_KEY']

# Read SQL content
$sqlContent = Get-Content -Path "supabase/migrations/20240101000000_create_notifications_table.sql" -Raw

# Run the SQL migration
Write-Host "Setting up notifications table in Supabase..."
$body = @{
    sql = $sqlContent
} | ConvertTo-Json

$headers = @{
    "apikey" = $SUPABASE_SERVICE_KEY
    "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "https://$SUPABASE_PROJECT_ID.supabase.co/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body

Write-Host "Notifications table setup complete!" 