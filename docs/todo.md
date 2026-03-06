- add file upload endpoint
- add file download endpoint
- block http req on large video - request timeout
- input validation


- auth
- ratelimit
- cleanup for old input output file, add like 7 days retention 

- graceful shoutdown
- test

 3. Defer cleanup, but do it in a helper.
     In the file loop at handler.go:70-85, src.Close() is manual. Uber says prefer defer for cleanup. In
     a loop, the clean version is usually: move “save one uploaded file” into a helper, then defer
     src.Close() inside that helper.
  4. Import grouping/order.
     handler.go:3-13 should follow: standard library first, blank line, everything else. strconv belongs
     with stdlib above your internal imports. goimports should fix this.
  5. Reduce nesting with early returns.
     This file is already mostly doing this well. Keep that pattern for HandleCreateBatch and
     HandleBatchReport.
  6. Handle each error once.
     At the HTTP boundary, “log + write HTTP response” is acceptable because the handler is the terminal
     boundary. Just make sure lower layers like job or storage are not also logging the same error, or
     you’ll get duplicate noise.
  7. Prefer named constants for magic values.
     handler.go:41 uses 32 << 20. Uber style would favor a local const maxMultipartMemory = 32 << 20 for
     readability.
  8. Verify interface compliance if we lean on those interfaces as contract.
     Since Handler depends on BatchCreator and BatchReporter, compile-time assertions can help if that
     contract matters:
     var _ BatchCreator = (*job.Manager)(nil)
     var _ BatchReporter = (*job.Manager)(nil)

  So the main must-fix items for handler.go are: ignored Atoi error, import ordering, cleanup structure,
  and a small scope/readability cleanup. If you want, I can apply those changes next.