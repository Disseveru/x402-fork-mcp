```markdown
# x402-fork-mcp Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `x402-fork-mcp` TypeScript codebase. It covers file organization, import/export styles, commit message practices, and testing approaches. While no specific framework is detected, the repository follows consistent TypeScript and code organization standards, making it easy to maintain and extend.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `myModule.ts`, `userProfile.ts`

### Import Style
- Use **relative imports** for referencing other files or modules.
  - Example:
    ```typescript
    import { myFunction } from './utils';
    ```

### Export Style
- Use **named exports** rather than default exports.
  - Example:
    ```typescript
    // utils.ts
    export function myFunction() { ... }
    ```

    ```typescript
    // anotherFile.ts
    import { myFunction } from './utils';
    ```

### Commit Messages
- Freeform commit messages, usually with an average length of 73 characters.
- No strict prefixing or structure enforced.

## Workflows

### Adding a New Module
**Trigger:** When you need to add new functionality or a feature.
**Command:** `/add-module`

1. Create a new `.ts` file using camelCase naming.
2. Implement your logic using named exports.
3. Use relative imports to bring in dependencies.
4. Write a corresponding test file named `yourModule.test.ts`.
5. Commit your changes with a clear, descriptive message.

### Refactoring Existing Code
**Trigger:** When improving or reorganizing code without changing its behavior.
**Command:** `/refactor`

1. Identify the file(s) to refactor.
2. Update code, maintaining camelCase file naming and named exports.
3. Adjust relative imports as needed.
4. Run relevant tests to ensure nothing is broken.
5. Commit with a message describing the refactor.

### Writing and Running Tests
**Trigger:** When adding new code or updating existing logic.
**Command:** `/test`

1. Create or update a test file with the pattern `*.test.ts`.
2. Write tests for all exported functions or modules.
3. Use the project's test runner (framework unknown; check project docs or scripts).
4. Ensure all tests pass before committing.

## Testing Patterns

- Test files follow the pattern: `*.test.*` (e.g., `myModule.test.ts`).
- Each test file should cover the exported functions or modules from the corresponding source file.
- The specific test framework is not detected; refer to project documentation or existing test files for guidance.

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /add-module  | Scaffold and add a new module                |
| /refactor    | Refactor existing code following conventions |
| /test        | Write and run tests for your code            |
```