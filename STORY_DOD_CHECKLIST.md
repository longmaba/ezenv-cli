# Story Definition of Done (DoD) Checklist

## Overview
This checklist ensures that all user stories in the EzEnv CLI project meet the required quality standards before being marked as complete.

## Pre-Development Checklist
- [ ] Story requirements are clear and understood
- [ ] Acceptance criteria are defined and measurable
- [ ] Technical approach is planned and reviewed
- [ ] Dependencies are identified
- [ ] Similar work in progress has been checked to avoid duplication

## Development Standards

### Code Quality
- [ ] Code follows TypeScript standards (no `any` types, proper type safety)
- [ ] Follows project naming conventions (camelCase, PascalCase, kebab-case)
- [ ] No hardcoded values or secrets
- [ ] Code is self-documenting with clear variable/function names
- [ ] Complex logic includes inline comments
- [ ] File organization follows project structure

### Testing Requirements
- [ ] Unit tests written for all new functionality (minimum 80% coverage)
- [ ] Integration tests for API interactions
- [ ] E2E tests for critical user journeys
- [ ] All tests pass locally (`pnpm test`)
- [ ] No skipped or commented-out tests
- [ ] Test names are descriptive and follow convention

### Security Checklist
- [ ] No hardcoded secrets or sensitive data
- [ ] Input validation implemented
- [ ] SQL injection prevention (if applicable)
- [ ] XSS prevention (if applicable)
- [ ] Proper authentication checks
- [ ] Authorization verified
- [ ] Sensitive data encrypted
- [ ] Error messages don't leak sensitive info
- [ ] Rate limiting considered (if applicable)

### Performance Considerations
- [ ] Code doesn't introduce performance regressions
- [ ] Async operations properly handled
- [ ] No memory leaks
- [ ] Efficient algorithms used
- [ ] Database queries optimized (if applicable)

## Pre-Commit Checklist
- [ ] Code builds successfully (`pnpm build`)
- [ ] TypeScript checks pass (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] All tests pass (`pnpm test`)
- [ ] Code coverage meets requirements (80%+)
- [ ] Branch is up to date with main/develop

## Documentation
- [ ] API documentation updated (if applicable)
- [ ] README updated (if applicable)
- [ ] Inline code documentation added for complex logic
- [ ] Breaking changes documented
- [ ] Configuration changes documented

## Pull Request Standards
- [ ] PR title follows format: `feat(scope): description` or `fix(scope): description`
- [ ] PR description includes:
  - [ ] Summary of changes
  - [ ] Link to related issue/story
  - [ ] Testing steps
  - [ ] Screenshots (if UI changes)
- [ ] All CI/CD checks pass
- [ ] Code review requested from appropriate team members
- [ ] Review feedback addressed

## Acceptance Criteria Verification
- [ ] All acceptance criteria from the story are met
- [ ] Feature works as expected in development environment
- [ ] Edge cases handled appropriately
- [ ] Error scenarios handled gracefully
- [ ] User-facing error messages are helpful

## Post-Development
- [ ] Code merged to appropriate branch
- [ ] Story/issue updated with completion status
- [ ] Any follow-up tasks or technical debt logged
- [ ] Team notified of completion

## CLI-Specific Requirements
- [ ] Commands follow consistent naming patterns
- [ ] Help text is clear and comprehensive
- [ ] Error messages guide users to resolution
- [ ] Command output is properly formatted
- [ ] Progress indicators for long-running operations
- [ ] Graceful handling of Ctrl+C interruptions
- [ ] Cross-platform compatibility verified

## Notes
- This checklist should be reviewed and updated as the project evolves
- Not all items apply to every story - use judgment
- For hotfixes, a reduced checklist may be appropriate
- When in doubt, ask for team consensus