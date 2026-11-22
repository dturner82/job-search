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
3. Select **Shortlisted** in the status filter and apply it. Verify the title, company, salary, location, source, discovered date and Shortlisted status. Resize the browser to a narrow viewport and check that the details stay readable.
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

## Collect job alerts

Rebuild Phase 2 locally before the first collection. Keep the working Zoho settings used by `test-imap.js` in your existing private configuration.

```powershell
docker compose --env-file .env.example up --build -d web
```

Once the dashboard loads at [localhost:3000](http://localhost:3000), run the collector from the project directory.

```powershell
docker compose --env-file .env run --rm --build collector
```

The collector opens the configured mailbox read-only. The first run searches back 60 days using the mailbox receipt date. Later runs process newer UIDs. A new UIDVALIDITY starts a new 60-day search. The collector writes jobs and message metadata in one transaction per message, so retrying after an error can resume at the last saved message. It logs counts by outcome and records metadata for messages larger than 8 MiB. The dashboard opens at [localhost:3000](http://localhost:3000).

Indeed links with vacancy IDs are recognised directly. The extractor also supports individual vacancy links in generic HTML and plain-text alerts. Formats that hide vacancies behind opaque tracking links may need a source-specific extractor. The summary counts emails from which no vacancies were extracted, including alerts without a supported title. After updating an extractor, you can revisit recent alerts without duplicating vacancies.

```powershell
docker compose --env-file .env run --rm collector sh -c 'npm run db:migrate && npm run collect -- --rescan'
```

The Best match sort favours relevant development and design titles, listed skills, hands-on work and known UK remote or West Midlands locations. The default salary filter hides jobs with a recognised advertised maximum below £30,000. It leaves uncertain salaries visible. Office attendance and advertised travel appear when extracted from the alert.

## Test Phase 2

Run the synthetic test in a temporary database inside a disposable development container.

```powershell
docker compose --env-file .env.example run --rm web sh -c 'export DATABASE_URL=file:/tmp/job-search-verify-$$.db; npm run db:migrate && npm exec -- tsx scripts/verify-alerts.ts'
```

For a live check, run the collector twice against the Zoho folder. Confirm the first run adds supported vacancies and the second adds zero unless new mail arrived. On the dashboard check that **Best match** shows reasons, that **Show jobs below minimum** restores filtered vacancies, and that office attendance stays unspecified where the alert only says hybrid.

## Track vacancies

The dashboard opens on **New**. Use the status menu on a vacancy and select **Save status** to move it to another view. **Unsuitable** means you ruled it out. **Rejected** means the employer declined your application. Use **All statuses** or choose a specific status to find marked vacancies again. The salary filter still applies, so tick **Show jobs below minimum** to include every vacancy in the selected view.

To verify status tracking, move a test vacancy from New to Applied and confirm it appears in the Applied view and disappears from New. Repeat for Expired, Unsuitable and Rejected. Change the vacancy back to New from **All statuses**. A repeat alert should preserve your saved status. Rebuild the Docker images when changing statuses so the Prisma clients use the updated enum. SQLite already stores each status as text, so adding these values requires no database migration.

## Later phases

Phase 3 can extend extractor coverage as alerts arrive. Phase 4 adds AI matching. Phase 5 adds production authentication, the separate production database, scheduled collection and the NGINX deployment configuration.
