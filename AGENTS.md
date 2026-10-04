<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep public waitlist writes in validated server functions and owner reads behind authenticated row policies, because visitor contact data must never be publicly readable.
- Keep studio profile contact fields editable by their owner while billing fields remain server-managed, because an account must not self-assign plan or payment state.
- Keep waitlist owner access in a separate role table checked by the server and row policies, because signup records must not be exposed by client-side identity checks.
