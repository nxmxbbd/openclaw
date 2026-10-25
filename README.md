# X Control UI mixed-case account key: proof screenshots

Hosted outside the pull request diff. Each image is the Control UI X replies page, rendered by the repository's Control UI e2e harness with its mock Gateway answering the exact first `x.allowlist.list {}` payload a real built Gateway returned for `channels.x.accounts.Work`.

- `x-page-main.png`: main `c668bc05651`, alert "The X account is not configured." and no selectable account.
- `x-page-branch.png`: the fix branch, the account picker selects `@work_bot (work)` with no alert.
