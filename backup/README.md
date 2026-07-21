# DB Backup (Ticket 111)

Manual, on-demand backup of the Supabase Postgres database via native
`pg_dump`.

(Supabase CLI's own `db dump` was tried first, but v2.x runs `pg_dump` inside
a Docker container to match the server's Postgres version exactly, which
needs Docker Desktop running and pulls a large image on first use. Native
`pg_dump` avoids that dependency entirely.)

## Setup (once)

PostgreSQL 17 client tools (`pg_dump`/`psql`, no server, no service) are
installed at `C:\pgclient17\bin` via:

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --override "--mode unattended --unattendedmodeui minimal --extract-only 1 --installdir C:\pgclient17"
```

`--extract-only 1` only extracts the binaries — no Postgres service is
installed or started on this machine.

Copy the credentials template and fill in the real password:

```bash
cp backup/.env.local.example backup/.env.local
# edit backup/.env.local, set DATABASE_URL to the direct connection string
# (Supabase Dashboard -> "Connect" button -> Direct connection, port 5432;
# use Session pooler instead if Direct connection isn't reachable on your
# network)
```

`backup/.env.local` is gitignored and never committed.

## Running a backup

```powershell
./backup/backup-database.ps1
```

or, without saving credentials to disk:

```powershell
./backup/backup-database.ps1 -DbUrl "postgresql://postgres:PASSWORD@HOST:5432/postgres"
```

Produces, under `backup/database/`:

| File | Contents | In git? |
|---|---|---|
| `schema.sql` | tables, indexes, constraints, views, functions, triggers, RLS policies | yes |
| `data.sql` | table rows (INSERT statements) | **no** — contains real children's names/ages |
| `full_backup.sql` | `schema.sql` + `data.sql` concatenated, for one-file restore | **no** |

## Restoring

```powershell
C:\pgclient17\bin\psql.exe "postgresql://postgres:PASSWORD@HOST:5432/postgres" -f backup/database/full_backup.sql
```

## Scope

This covers the Postgres database only (schema + data). Not covered by this
script, per the wider Ticket 111 scope: Storage buckets, Edge Functions,
Auth settings, project environment variables. Add those later if needed —
out of scope for the current backup automation.

No scheduled/automatic run is configured; run the script manually when you
want a fresh backup.

RLS note: `pg_dump` connecting as the `postgres` superuser bypasses Row
Level Security automatically, so `data.sql` contains all rows regardless of
RLS policies (that's what you want for a full backup).
