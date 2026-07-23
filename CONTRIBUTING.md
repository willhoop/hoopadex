# Contributing to HoopaDex

Thanks for your interest. This project follows one fixed standard so anything here can be
picked up without a conversation.

## Before you change anything
1. Read `README.md` and the technical documentation in `docs/`.
2. Run the tests and confirm they pass.

## The rule for every change
A change is not finished until all of these are done in the **same pass**:
1. The code is changed.
2. The white paper, the deck, and the technical documentation are updated to match.
3. A `CHANGELOG.md` entry is added, the version is bumped, and the date is set.
4. The tests pass.

## Style
- Documentation is written in ASD-STE100 Simplified Technical English, organised by the
  Diátaxis model.
- Anything that changes over time lives in one configuration block, so a new version is a
  single edit.
- Tests derive expected values by hand and, where possible, read the shipped file rather
  than copying it, so they cannot drift.

## Reporting problems
Open an issue with steps to reproduce, or email willjhooper@msn.com.
