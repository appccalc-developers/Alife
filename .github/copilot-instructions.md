# Custom Shortcut Command: /shipit

When I issue the command `/shipit`, perform the following workflow sequentially and seamlessly without requiring step-by-step confirmation:

1. **Code Evaluation**: Review the current workspace changes against the last requirement to ensure the code is clean, production-ready, and free of obvious syntax errors.
2. **Create GitHub Issue**: Use the GitHub CLI (`gh`) or relevant API to create a concise GitHub Issue summarizing the changes made.
3. **Branch Management**:
   - Create a new local feature branch associated with the generated Issue.
   - Naming convention: `feature/issue-[Issue-Number]-[short-description]`.
   - Checkout to this new branch immediately.
4. **Commit & Push**:
   - Stage all current changes (`git add .`).
   - Create a git commit following conventional commits. Naming convention: `feat/fix: # [Issue-Number] [Short description]`.
   - Push the branch to the remote repository.
5. **Create Pull Request**: Generate a Pull Request on GitHub for this branch targeting the main branch, and ensure it links to the created Issue (e.g., using "Closes #[Issue-Number]" in the description).
