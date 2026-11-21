# Job Search

Phase 1 is a local dashboard backed by SQLite. It shows vacancy details and application status, ordered by most recently discovered. Dates are displayed in UK time.

The initial migration records an email by mailbox, UIDVALIDITY and UID. If the mailbox's UIDVALIDITY changes, a reused UID can identify a different email. Vacancies have separate unique keys for canonical URLs and for vacancy IDs within each source.

## Develop with Docker

Start Docker Desktop in Linux container mode and run the following command.

```sh
docker compose --env-file .env.example up --build -d
```

Open [localhost:3000](http://localhost:3000). The web service applies pending Prisma migrations when it starts. Compose binds the port to the host loopback interface and stores the development database in the `job-search-dev_development-db` volume. Use `docker compose --env-file .env.example up --build -d` after changing source files to rebuild the development image. Use `docker compose --env-file .env.example down` to stop the app while retaining the volume.

## Test Phase 1

1. Open the dashboard with a fresh development volume and check for “No vacancies yet”.
2. To insert a synthetic row, run the first command below from PowerShell. Reruns update the same sample vacancy.
3. Reload the dashboard and verify the title, company, salary, location, source, discovered date and Shortlisted status. Resize the browser to a narrow viewport and check that the details stay readable.
4. Run `docker compose --env-file .env.example restart web` and confirm the sample row persists. Remove the sample with the optional cleanup command below.
5. Run `docker compose --env-file .env.example run --rm web npm run lint`, `docker compose --env-file .env.example run --rm web npm run typecheck`, and `docker compose --env-file .env.example run --rm web npm run build`.

```powershell
@'
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const record = {
    title: "Senior Full Stack Developer",
    company: "Example Software",
    location: "Remote (UK)",
    salary: "£55,000",
    source: "Sample",
    sourceVacancyId: "phase-1-smoke-test",
    status: "SHORTLISTED",
};
db.job.upsert({
    where: { source_sourceVacancyId: { source: record.source, sourceVacancyId: record.sourceVacancyId } },
    create: record,
    update: record,
}).finally(() => db.$disconnect());
'@ | docker compose --env-file .env.example exec -T web node
```

```powershell
@'
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
db.job.deleteMany({ where: { source: "Sample", sourceVacancyId: "phase-1-smoke-test" } })
    .finally(() => db.$disconnect());
'@ | docker compose --env-file .env.example exec -T web node
```

## Development database backup and restore

Keep backup archives private. Use PowerShell to stop the web service and back up the volume into `.data`.

```powershell
New-Item -ItemType Directory -Force .data | Out-Null
docker compose --env-file .env.example stop web
docker run --rm --mount type=volume,source=job-search-dev_development-db,target=/data,readonly --mount "type=bind,source=$($PWD.Path)/.data,target=/backup" node:22-bookworm-slim tar -czf /backup/jobs-dev.tar.gz -C /data .
docker compose --env-file .env.example start web
```

To verify a backup or recover it, restore into a separate volume and inspect it before replacing any data.

```powershell
docker volume create job-search-dev-restored
docker run --rm --mount type=volume,source=job-search-dev-restored,target=/data --mount "type=bind,source=$($PWD.Path)/.data,target=/backup,readonly" node:22-bookworm-slim tar -xzf /backup/jobs-dev.tar.gz -C /data
docker run --rm --mount type=volume,source=job-search-dev-restored,target=/data --env DATABASE_URL=file:/data/jobs.db job-search-dev-web npm exec -- prisma migrate status
```

## Later phases

The existing `test-imap.js` is the starting point for Phase 2. Phase 3 adds vacancy extraction, filtering and status updates. Phase 4 adds AI matching. Phase 5 adds production authentication, the separate production database, scheduled collection and the NGINX deployment configuration.
