# xkeep feature map

## Status

All mapped workflows are `graduated-to-e2e` in `tests/e2e/xkeep.spec.ts`. Run `nub run test:e2e` for the build plus browser suite, or `nub run test:e2e:built` after an unchanged successful build.

Start with these user-facing canvas flows:

- [Canvas navigation](canvas-navigation.md)
- [Import and status](import-status.md)
- [Search and filters](search-filters.md)
- [Selection and inspector](selection-inspector.md)
- [Deletion](deletion.md)

Use the isolated fixture for destructive flows. Store screenshots and API responses in `$XKEEP_VERIFY_EVIDENCE`.
