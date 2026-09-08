# Teacher Studio backups

Teacher Studio saves activities in the current browser. Use **Download backup**
to keep a separate copy of every activity, including questions, settings, picture
selections, notes, and the latest edits. This also works when browser storage is
full or blocked, provided the activities are still open in the editor.

Use **Import backup** in Teacher Studio to restore the file on this or another
device. Imports add new copies and preserve existing activities. Files must be
valid Teacher Studio backups no larger than 5 MB. An unreadable, incompatible,
or oversized file changes nothing; a browser storage failure also leaves the
existing activities intact.

Backups contain the activity notes and should be shared only with people who
should receive those notes. Picture selections refer to the built-in library;
the backup does not contain picture files, gameplay progress, or accounts.

The version 1 JSON envelope is `sal0mander-studio-backup`, with `version`,
`exportedAt`, and `drafts`. Every draft is checked against `ActivityDraftSchema`
before import. This is a local recovery/transfer feature; class publishing and
playing web-authored activities remain separate work.
