# User Manual

## Account Access

Students and employers can register using the public registration form. Public registration does not create admin accounts. Sign in through the Login page; the browser uses a server-set HttpOnly session cookie. Sign out from the account navigation.

The forgot-password form accepts a request, but email delivery is not configured. The API does not return a raw reset token, so users currently cannot complete password recovery through the UI. Contact the system administrator for account recovery until a delivery provider is configured.

## Student

1. Register as a student and sign in.
2. Open Profile to update personal, education, contact, and portfolio details. The server validates updates.
3. Open Skills to add skills from the catalogue and specify proficiency. Skills can be edited or removed.
4. Browse Internships to search active postings and open a posting for details.
5. Open Matches to see active postings ranked by the current skill-match calculation. A posting's match-score endpoint returns matched, partial, missing, and bonus skill details.
6. Open Skill Gap to review missing/weak skills and generated learning recommendations.
7. Apply to an active internship. A student may have one application per internship. Submitted applications begin as `PENDING`.
8. Open Applications to track status or withdraw an application while its status permits.
9. Upload an avatar from Profile. Accepted files are JPEG, PNG, and WebP up to 5 MB.

There is no resume upload workflow in the current client/API, even though an optional resume URL field exists in the database schema.

## Employer

1. Register as an employer and sign in.
2. Complete the company profile and optionally upload a JPEG/PNG/WebP logo up to 5 MB.
3. Create an internship with title, description, duration, application deadline, and at least one required skill. Location may be omitted for remote postings.
4. Manage your own postings from My Internships. Postings and applicant operations are checked against the signed-in employer's profile.
5. Open applicants for a posting. Applicants are returned in descending match-score order.
6. Update an applicant's status using the allowed hiring statuses. Students see status changes in their application list.

## Administrator

Admin users are provisioned outside public registration, for example through the explicit local seed command in a disposable development SQLite database. Seeding requires unique credentials supplied in the ignored local `server/.env`, and those credentials are never displayed by the script. Never enable demo seeding against a shared or production database; see the [Installation Guide](./installation.md) for the guarded setup.

1. Sign in using an administrator account.
2. Use the admin navigation to manage students, employers, internships, applications, and the skills catalogue.
3. Open Analytics to view application trends, top internships, and popular skills.
4. The API also exposes administrator-only JSON/PDF report endpoints. The current client does not contain a dedicated Reports page.