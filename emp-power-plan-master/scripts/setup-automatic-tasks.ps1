# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        Set-Item -Path "env:$name" -Value $value
    }
}

Write-Host "Setting up automatic task table in Supabase..."

# Read the SQL file content
$sqlContent = Get-Content "supabase/migrations/20240415000000_create_automatic_task_table.sql" -Raw

# Execute the SQL
$headers = @{
    "apikey" = $env:SUPABASE_SERVICE_KEY
    "Authorization" = "Bearer $env:SUPABASE_SERVICE_KEY"
    "Content-Type" = "application/json"
}

$body = @{
    "sql" = $sqlContent
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://$env:SUPABASE_PROJECT_ID.supabase.co/rest/v1/rpc/exec_sql" `
        -Method Post `
        -Headers $headers `
        -Body $body

    Write-Host "Automatic task table setup complete!"
} catch {
    Write-Host "Error setting up automatic task table:"
    Write-Host $_.Exception.Message
    exit 1
} 