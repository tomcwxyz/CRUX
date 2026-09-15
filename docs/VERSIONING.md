# CRUX versioning and migration policy

CRUX separates **software/package versions**, **record schema versions** and the **portable bundle format**. They must not be treated as the same thing.

## Current versions

- record schema: `0.1`
- portable bundle: `crux-bundle/0.1`
- disclosure projection: `crux-disclosure/0.1`
- package/application releases: independent semantic versions such as `0.1.0-alpha.5`

## Compatibility rules

During the `0.x` specification period, CRUX still treats published interchange contracts deliberately.

A change may remain within schema/bundle `0.1` when it is backwards-compatible for existing valid records, for example:

- adding an optional field;
- adding a new derived view that does not change canonical records;
- fixing validation that only rejects records already outside the documented contract.

A change requires a new schema/bundle version when it changes the meaning of an existing field or makes an existing conformant record invalid, for example:

- renaming or removing a field;
- changing an enum value or its semantics;
- changing required relationships;
- changing disclosure semantics;
- changing how stable identifiers are interpreted.

## Stable identifiers

Stable IDs identify domain objects, not display labels. Renaming a system, use, claim or role must not silently create a new identity.

Published `SystemVersion` records and records that point to them are intended to remain historically addressable.

## Strict canonical records

Canonical Zod schemas are strict. Unknown fields are rejected instead of silently retained. This makes version mismatches visible and prevents an older implementation from pretending it understood newer semantics.

## Migrations

Migrations must be explicit and inspectable.

A future migration command may transform a canonical bundle from one supported version to another, but CRUX must not silently rewrite a user's source bundle during `validate`, `inspect` or `redact`.

Migration functions should be:

- deterministic;
- source-version specific;
- non-destructive to the original file;
- covered by fixtures showing before and after states;
- explicit about information that cannot be represented losslessly.

Until a migration exists, an unsupported format should fail clearly rather than being guessed into the current model.

## Disclosure projections are not migrations

`crux redact` produces a derived `crux-disclosure/0.1` artefact. It is not a canonical bundle and is not expected to round-trip back into one.

This is intentional: disclosure may omit internal records, technical attributes and causal steps while preserving an explicit indication that context has been withheld.
