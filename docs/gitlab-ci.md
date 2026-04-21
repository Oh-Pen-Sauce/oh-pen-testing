# GitLab CI

```yaml
# .gitlab-ci.yml snippet
oh-pen-testing:
  image: node:22
  stage: test
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
    GITLAB_TOKEN: $OHPEN_BOT_TOKEN  # PAT with api + write_repository
  script:
    - npm install -g @oh-pen-testing/cli@latest
    - opt init --force --languages=typescript,javascript,python
    - node -e "const {loadConfig,writeConfig}=require('@oh-pen-testing/shared'); (async()=>{const c=await loadConfig(process.cwd()); c.scope.authorisation_acknowledged=true; c.git.host='gitlab'; c.git.repo=process.env.CI_PROJECT_PATH; await writeConfig(process.cwd(),c);})();"
    - opt scan
    - opt report --format sarif -o oh-pen-testing.sarif
  artifacts:
    reports:
      sast: oh-pen-testing.sarif
    paths:
      - .ohpentesting/
    expire_in: 30 days
```

The `artifacts.reports.sast` field is the GitLab-native surface — findings appear in the Merge Request security widget automatically.

For a remediation step, add a follow-up job:

```yaml
oh-pen-testing-remediate:
  image: node:22
  stage: deploy
  when: manual
  needs: [oh-pen-testing]
  script:
    - npm install -g @oh-pen-testing/cli@latest
    - opt remediate --all
```

See [docs/github-action.md](./github-action.md) for the equivalent GitHub path.
