curl -X POST https://prlivcmqjqjypclkcovl.supabase.co/functions/v1/invite-generate ^
  -H "Content-Type: application/json" ^
  -d "{\"role\":\"admin\",\"expiresInHours\":24}"

pause