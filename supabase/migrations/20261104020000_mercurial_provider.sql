-- Public Mercurial repos (cloned with hg, no OAuth)
alter type repo_provider add value if not exists 'mercurial';
